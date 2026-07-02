import { Router } from "express";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import multer from "multer";
import { db } from "../db";
import {
  alerts, predictions, riskScores, networkNodes, networkEdges,
  attackGraphs, datasets, trainingRuns, mlModels, reports,
} from "@shared/schema";
import { authenticate, requirePermission, createAuditLog, PERMISSIONS, type AuthenticatedRequest } from "../auth";
import { aiService } from "../ai-client";
import { broadcastEvent } from "../websocket";
import { publish } from "../redis";
import { cacheGet, cacheSet } from "../redis";

const router = Router();
const upload = multer({ dest: "uploads/", limits: { fileSize: 500 * 1024 * 1024 } });

router.use(authenticate);

router.post("/predict", requirePermission(PERMISSIONS.PREDICT), async (req: AuthenticatedRequest, res) => {
  try {
    const { features, graphSnapshot } = req.body;
    const result = await aiService.predict(features, graphSnapshot);

    const [prediction] = await db.insert(predictions).values({
      attackType: result.attack_type,
      attackStage: result.attack_stage,
      predictedNextStage: result.predicted_next_stage,
      threatLevel: result.threat_level,
      probability: result.probability,
      confidence: result.confidence,
      riskScore: result.risk_score,
      isCompromised: result.is_compromised,
      explanation: result.explanation,
      rawFeatures: features,
    }).returning();

    if (result.threat_level !== "low" && result.threat_level !== "info") {
      const [alert] = await db.insert(alerts).values({
        title: `${result.attack_type} detected`,
        description: `Attack stage: ${result.attack_stage}. Confidence: ${(result.confidence * 100).toFixed(1)}%`,
        severity: result.threat_level,
        attackType: result.attack_type,
        attackStage: result.attack_stage,
        mitreTactic: result.mitre_tactic,
        mitreTechnique: result.mitre_technique,
        sourceIp: features.src_ip,
        targetIp: features.dst_ip,
        protocol: features.protocol,
        predictionId: prediction.id,
      }).returning();

      const event = { type: "alert", payload: alert, timestamp: new Date().toISOString() };
      broadcastEvent("alert", alert);
      await publish("gnn-ids:events", event);
    }

    await createAuditLog({
      userId: req.user!.userId,
      action: "predict",
      resource: "predictions",
      resourceId: prediction.id,
      ipAddress: req.ip,
    });

    res.json({ ...result, id: prediction.id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Prediction failed" });
  }
});

router.post("/predict/batch", requirePermission(PERMISSIONS.PREDICT), async (req, res) => {
  try {
    const { records } = req.body;
    const result = await aiService.predictBatch(records);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Batch prediction failed" });
  }
});

router.get("/alerts", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  const severity = req.query.severity as string | undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);

  const conditions = [];
  if (severity) conditions.push(eq(alerts.severity, severity as typeof alerts.severity.enumValues[number]));
  if (status) conditions.push(eq(alerts.status, status as typeof alerts.status.enumValues[number]));

  const result = await db
    .select()
    .from(alerts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(limit);

  res.json({ alerts: result, count: result.length });
});

router.patch("/alerts/:id", requirePermission(PERMISSIONS.MANAGE_ALERTS), async (req: AuthenticatedRequest, res) => {
  const { status } = req.body;
  const [updated] = await db
    .update(alerts)
    .set({
      status,
      assignedTo: req.user!.userId,
      acknowledgedAt: status === "investigating" ? new Date() : undefined,
      resolvedAt: status === "resolved" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(updated);
});

router.get("/dashboard/metrics", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (_req, res) => {
  const cacheKey = "dashboard:metrics";
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const [alertStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      critical: sql<number>`count(*) filter (where ${alerts.severity} = 'critical')::int`,
      high: sql<number>`count(*) filter (where ${alerts.severity} = 'high')::int`,
      open: sql<number>`count(*) filter (where ${alerts.status} = 'open')::int`,
    })
    .from(alerts)
    .where(gte(alerts.createdAt, sql`now() - interval '24 hours'`));

  const [nodeStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      compromised: sql<number>`count(*) filter (where ${networkNodes.status} = 'compromised')::int`,
      suspicious: sql<number>`count(*) filter (where ${networkNodes.status} = 'suspicious')::int`,
      avgRisk: sql<number>`coalesce(avg(${networkNodes.riskScore}), 0)`,
    })
    .from(networkNodes);

  let aiMetrics = {};
  try {
    aiMetrics = await aiService.getMetrics();
  } catch {
    aiMetrics = {};
  }

  const metrics = {
    alerts: alertStats,
    network: nodeStats,
    ai: aiMetrics,
    timestamp: new Date().toISOString(),
  };

  await cacheSet(cacheKey, metrics, 10);
  res.json(metrics);
});

router.get("/network/nodes", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "100", 10), 500);

  const result = await db
    .select()
    .from(networkNodes)
    .where(status ? eq(networkNodes.status, status as typeof networkNodes.status.enumValues[number]) : undefined)
    .orderBy(desc(networkNodes.riskScore))
    .limit(limit);

  res.json({ nodes: result, count: result.length });
});

router.get("/network/edges", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || "200", 10), 1000);
  const result = await db
    .select()
    .from(networkEdges)
    .orderBy(desc(networkEdges.timestamp))
    .limit(limit);

  res.json({ edges: result, count: result.length });
});

router.get("/network/topology", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (_req, res) => {
  const nodes = await db.select().from(networkNodes).orderBy(desc(networkNodes.riskScore)).limit(100);
  const nodeIds = nodes.map((n) => n.id);
  const edges = nodeIds.length
    ? await db.select().from(networkEdges).orderBy(desc(networkEdges.timestamp)).limit(300)
    : [];

  res.json({
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.hostname || n.ipAddress,
      ip: n.ipAddress,
      type: n.nodeType,
      status: n.status,
      risk: n.riskScore,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      protocol: e.protocol,
      weight: e.weight,
    })),
  });
});

router.get("/risk/scores", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  const entityType = req.query.entity_type as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);

  const result = await db
    .select()
    .from(riskScores)
    .where(entityType ? eq(riskScores.entityType, entityType) : undefined)
    .orderBy(desc(riskScores.computedAt))
    .limit(limit);

  res.json({ scores: result });
});

router.post("/risk/compute", requirePermission(PERMISSIONS.PREDICT), async (req, res) => {
  try {
    const { entityType, entityId, graphSnapshot } = req.body;
    const result = await aiService.computeRisk(entityType, entityId, graphSnapshot);

    const [score] = await db.insert(riskScores).values({
      entityType,
      entityId,
      entityName: result.entity_name,
      nodeRisk: result.node_risk,
      subnetRisk: result.subnet_risk,
      departmentRisk: result.department_risk,
      organizationRisk: result.organization_risk,
      propagationRisk: result.propagation_risk,
      businessImpact: result.business_impact,
      factors: result.factors,
    }).returning();

    broadcastEvent("risk_update", score);
    res.json(score);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Risk computation failed" });
  }
});

router.post("/explain", requirePermission(PERMISSIONS.PREDICT), async (req, res) => {
  try {
    const { nodeId, graphSnapshot } = req.body;
    const result = await aiService.explain(nodeId, graphSnapshot);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Explainability failed" });
  }
});

router.get("/predictions", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  const result = await db.select().from(predictions).orderBy(desc(predictions.createdAt)).limit(limit);
  res.json({ predictions: result });
});

router.get("/training/runs", requirePermission(PERMISSIONS.TRAIN), async (_req, res) => {
  const runs = await db.select().from(trainingRuns).orderBy(desc(trainingRuns.createdAt)).limit(20);
  res.json({ runs });
});

router.post("/training/start", requirePermission(PERMISSIONS.TRAIN), async (req: AuthenticatedRequest, res) => {
  try {
    const { datasetId, architecture, hyperparameters, epochs } = req.body;

    const [run] = await db.insert(trainingRuns).values({
      datasetId,
      architecture,
      hyperparameters: hyperparameters ?? {},
      epochs: epochs ?? 50,
      status: "queued",
      startedBy: req.user!.userId,
    }).returning();

    const aiResult = await aiService.startTraining({
      run_id: run.id,
      dataset_id: datasetId,
      architecture,
      hyperparameters,
      epochs,
    });

    await db.update(trainingRuns).set({ status: "running", startedAt: new Date() }).where(eq(trainingRuns.id, run.id));

    res.status(202).json({ run, ai: aiResult });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Training start failed" });
  }
});

router.get("/training/runs/:id", requirePermission(PERMISSIONS.TRAIN), async (req, res) => {
  const [run] = await db.select().from(trainingRuns).where(eq(trainingRuns.id, req.params.id)).limit(1);
  if (!run) {
    res.status(404).json({ error: "Training run not found" });
    return;
  }

  let aiStatus = {};
  try {
    aiStatus = await aiService.getTrainingStatus(run.id);
  } catch {
    aiStatus = {};
  }

  res.json({ run, ai: aiStatus });
});

router.get("/metrics", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
  try {
    const modelId = req.query.model_id as string | undefined;
    const metrics = await aiService.getMetrics(modelId);
    res.json(metrics);
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Metrics unavailable" });
  }
});

router.get("/datasets", requirePermission(PERMISSIONS.MANAGE_DATASETS), async (_req, res) => {
  const result = await db.select().from(datasets).orderBy(desc(datasets.createdAt));
  res.json({ datasets: result });
});

router.post("/datasets/upload", requirePermission(PERMISSIONS.MANAGE_DATASETS), upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fs = await import("fs/promises");
    const fileBuffer = await fs.readFile(req.file.path);

    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), req.file.originalname);
    formData.append("source", req.body.source || "upload");
    formData.append("name", req.body.name || req.file.originalname);

    const aiResult = await aiService.ingestDataset(formData);

    const [dataset] = await db.insert(datasets).values({
      name: req.body.name || req.file.originalname,
      source: req.body.source || "upload",
      filePath: aiResult.file_path,
      fileType: req.file.mimetype.includes("csv") ? "csv" : req.file.originalname.split(".").pop() || "unknown",
      recordCount: aiResult.record_count ?? 0,
      status: "processing",
      uploadedBy: req.user!.userId,
      metadata: aiResult,
    }).returning();

    res.status(201).json({ dataset, ai: aiResult });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

router.post("/graph/build", requirePermission(PERMISSIONS.PREDICT), async (req, res) => {
  try {
    const { datasetId, windowSeconds } = req.body;
    const result = await aiService.buildGraph(datasetId, windowSeconds ?? 30);

    const [graph] = await db.insert(attackGraphs).values({
      name: `Graph ${windowSeconds}s window`,
      windowSeconds: windowSeconds ?? 30,
      nodeCount: result.node_count,
      edgeCount: result.edge_count,
      snapshotData: result.snapshot,
      datasetId,
    }).returning();

    broadcastEvent("graph_update", graph);
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Graph build failed" });
  }
});

router.get("/models", requirePermission(PERMISSIONS.TRAIN), async (_req, res) => {
  const models = await db.select().from(mlModels).orderBy(desc(mlModels.createdAt));
  res.json({ models });
});

router.get("/health", async (_req, res) => {
  let aiHealth = { status: "unavailable", model_loaded: false };
  try {
    aiHealth = await aiService.health();
  } catch {
    // AI service down
  }

  res.json({
    status: "healthy",
    ai: aiHealth,
    timestamp: new Date().toISOString(),
  });
});

export default router;
