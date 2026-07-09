import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db";
import { alerts, predictions, reports, riskScores, trainingRuns } from "@shared/schema";
import { authenticate, createAuditLog, requirePermission, PERMISSIONS, type AuthenticatedRequest } from "../auth";

const router = Router();
const REPORT_DIR = path.resolve(process.env.REPORT_DIR || "reports");

router.use(authenticate, requirePermission(PERMISSIONS.VIEW_REPORTS));

router.get("/", async (_req, res) => {
  const result = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(100);
  res.json({ reports: result });
});

router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const reportType = normalizeReportType(req.body.type);
    const format = normalizeFormat(req.body.format);
    const data = await collectReportData(reportType);
    const generatedAt = new Date().toISOString();
    const title = `${titleCase(reportType)} Report - ${generatedAt}`;
    const filename = `${reportType}-${generatedAt.replace(/[:.]/g, "-")}.${format}`;

    await fs.mkdir(REPORT_DIR, { recursive: true });
    const filePath = path.join(REPORT_DIR, filename);
    await fs.writeFile(filePath, renderReportFile(format, title, data), format === "pdf" ? undefined : "utf8");

    const [report] = await db.insert(reports).values({
      title,
      format,
      filePath,
      content: {
        type: reportType,
        generatedAt,
        summary: data.summary,
      },
      generatedBy: req.user!.userId,
    }).returning();

    await createAuditLog({
      userId: req.user!.userId,
      action: "generate_report",
      resource: "reports",
      resourceId: report.id,
      details: { type: reportType, format },
      ipAddress: req.ip,
    });

    res.status(201).json({ report });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Report generation failed" });
  }
});

router.get("/:id/download", async (req, res) => {
  const [report] = await db.select().from(reports).where(eq(reports.id, req.params.id)).limit(1);
  if (!report?.filePath) {
    res.status(404).json({ error: "Report file not found" });
    return;
  }

  const absolute = path.resolve(report.filePath);
  if (!absolute.startsWith(REPORT_DIR)) {
    res.status(400).json({ error: "Invalid report path" });
    return;
  }

  const contentType = report.format === "pdf"
    ? "application/pdf"
    : report.format === "csv"
      ? "text/csv"
      : "application/json";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(report.filePath)}"`);
  createReadStream(absolute).pipe(res);
});

async function collectReportData(type: string) {
  if (type === "incident") {
    const rows = await db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(100);
    return {
      summary: {
        total: rows.length,
        critical: rows.filter((row) => row.severity === "critical").length,
        open: rows.filter((row) => row.status === "open").length,
      },
      rows,
    };
  }

  if (type === "threat") {
    const rows = await db.select().from(predictions).orderBy(desc(predictions.createdAt)).limit(100);
    return {
      summary: {
        total: rows.length,
        highConfidence: rows.filter((row) => row.confidence >= 0.8).length,
        compromised: rows.filter((row) => row.isCompromised).length,
      },
      rows,
    };
  }

  if (type === "risk") {
    const rows = await db.select().from(riskScores).orderBy(desc(riskScores.computedAt)).limit(100);
    return {
      summary: {
        total: rows.length,
        highRisk: rows.filter((row) => Number(row.nodeRisk ?? 0) >= 0.75).length,
      },
      rows,
    };
  }

  const rows = await db.select().from(trainingRuns).orderBy(desc(trainingRuns.createdAt)).limit(100);
  return {
    summary: {
      total: rows.length,
      running: rows.filter((row) => row.status === "running").length,
      completed: rows.filter((row) => row.status === "completed").length,
      failed: rows.filter((row) => row.status === "failed").length,
    },
    rows,
  };
}

function renderReportFile(format: "pdf" | "csv" | "json", title: string, data: { summary: unknown; rows: unknown[] }) {
  if (format === "json") {
    return JSON.stringify({ title, ...data }, null, 2);
  }
  if (format === "csv") {
    return toCsv(data.rows);
  }
  return renderPdf(title, data);
}

function toCsv(rows: unknown[]) {
  const records = rows.map((row) => row as Record<string, unknown>);
  const headers = Array.from(new Set(records.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.join(","),
    ...records.map((row) =>
      headers.map((header) => csvCell(row[header])).join(","),
    ),
  ];
  return lines.join("\n");
}

function csvCell(value: unknown) {
  const raw = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function renderPdf(title: string, data: { summary: unknown; rows: unknown[] }) {
  const lines = [
    title,
    "",
    `Summary: ${JSON.stringify(data.summary)}`,
    `Records: ${data.rows.length}`,
    "",
    ...data.rows.slice(0, 25).map((row, index) => `${index + 1}. ${JSON.stringify(row).slice(0, 110)}`),
  ];

  const content = [
    "BT",
    "/F1 10 Tf",
    "50 780 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -16 Td",
      `(${escapePdf(line)}) Tj`,
    ]),
    "ET",
  ].filter(Boolean).join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function normalizeReportType(value: unknown) {
  const type = String(value ?? "incident").toLowerCase();
  return ["incident", "threat", "risk", "training"].includes(type) ? type : "incident";
}

function normalizeFormat(value: unknown): "pdf" | "csv" | "json" {
  const format = String(value ?? "json").toLowerCase();
  return format === "pdf" || format === "csv" || format === "json" ? format : "json";
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export default router;
