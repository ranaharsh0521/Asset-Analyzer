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
import { queueAutonomousTrainingForDataset } from "../services/lifecycle";
import { syncNetworkFromDataset } from "../sync-network";


const router = Router();
const upload = multer({ dest: "uploads/", limits: { fileSize: 500 * 1024 * 1024 } });
const SUPPORTED_INGEST_EXTENSIONS = new Set(["csv", "flow", "pcap", "pcapng", "json", "jsonl", "log"]);

type ParsedPacketAnalysis = {
  filename?: string;
  file_path?: string;
  flow_count?: number;
  snapshot_count?: number;
  protocols?: string[];
  latest_snapshot?: {
    nodes?: Array<{
      id: string;
      ip: string;
      type?: string;
      packets?: number;
      bytes?: number;
      connections?: number;
      failed_logins?: number;
      ports?: number[];
    }>;
    edges?: Array<{
      source: string;
      target: string;
      protocol?: string;
      bytes?: number;
      packets?: number;
      timestamp?: string;
    }>;
    node_count?: number;
    edge_count?: number;
    node_features?: number[][];
    [key: string]: unknown;
  };
  predictions?: Array<{
    attack_type?: string;
    attack_stage?: string;
    predicted_next_stage?: string;
    threat_level?: string;
    probability?: number;
    confidence?: number;
    risk_score?: number;
    is_compromised?: boolean;
    explanation?: Record<string, unknown>;
    mitre_tactic?: string;
    mitre_technique?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type PacketSnapshotNode = NonNullable<NonNullable<ParsedPacketAnalysis["latest_snapshot"]>["nodes"]>[number];

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

    broadcastEvent("prediction", prediction);

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

router.get("/attack-stage", requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (_req, res) => {
  const recent = await db.select().from(predictions).orderBy(desc(predictions.createdAt)).limit(100);
  const stageCounts = recent.reduce<Record<string, number>>((acc, prediction) => {
    acc[prediction.attackStage] = (acc[prediction.attackStage] ?? 0) + 1;
    return acc;
  }, {});
  const latest = recent[0] ?? null;

  res.json({
    latest,
    stageCounts,
    currentStage: latest?.attackStage ?? "normal",
    predictedNextStage: latest?.predictedNextStage ?? null,
    threatLevel: latest?.threatLevel ?? "info",
    probability: latest?.probability ?? 0,
    confidence: latest?.confidence ?? 0,
    updatedAt: latest?.createdAt ?? null,
  });
});

router.get("/training/runs", requirePermission(PERMISSIONS.TRAIN), async (_req, res) => {
  const runs = await db.select().from(trainingRuns).orderBy(desc(trainingRuns.createdAt)).limit(20);
  res.json({ runs });
});

router.post("/training/start", requirePermission(PERMISSIONS.TRAIN), async (req: AuthenticatedRequest, res) => {
  try {
    const { datasetId, architecture, hyperparameters, epochs } = req.body;
    const dataset = await resolveDataset(datasetId);
    const result = await queueAutonomousTrainingForDataset(dataset.id, {
      trigger: "manual_admin",
      startedBy: req.user!.userId,
      architecture,
      hyperparameters,
      epochs,
    });
    res.status(202).json(result);
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

router.get("/datasets/:id/stats", requirePermission(PERMISSIONS.MANAGE_DATASETS), async (req, res) => {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, req.params.id)).limit(1);
  if (!dataset) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  res.json({
    id: dataset.id,
    name: dataset.name,
    source: dataset.source,
    fileType: dataset.fileType,
    recordCount: dataset.recordCount ?? 0,
    featureCount: dataset.featureCount ?? 0,
    status: dataset.status,
    metadata: dataset.metadata ?? {},
    createdAt: dataset.createdAt,
    processedAt: dataset.processedAt,
  });
});

router.get("/datasets/:id/preview", requirePermission(PERMISSIONS.MANAGE_DATASETS), async (req, res) => {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, req.params.id)).limit(1);
  if (!dataset?.filePath) {
    res.status(404).json({ error: "Dataset file not found" });
    return;
  }

  const preview = await previewDatasetFile(dataset.filePath, dataset.fileType);
  res.json({ datasetId: dataset.id, preview });
});

router.get("/datasets/:id/download", requirePermission(PERMISSIONS.MANAGE_DATASETS), async (req, res) => {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, req.params.id)).limit(1);
  if (!dataset?.filePath) {
    res.status(404).json({ error: "Dataset file not found" });
    return;
  }

  const fs = await import("fs");
  if (!fs.existsSync(dataset.filePath)) {
    res.status(404).json({ error: "Dataset file missing on disk" });
    return;
  }
  res.download(dataset.filePath, `${dataset.name}.${dataset.fileType}`);
});

router.delete("/datasets/:id", requirePermission(PERMISSIONS.MANAGE_DATASETS), async (req: AuthenticatedRequest, res) => {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, req.params.id)).limit(1);
  if (!dataset) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  await db.delete(datasets).where(eq(datasets.id, req.params.id));
  if (dataset.filePath) {
    const fs = await import("fs/promises");
    await fs.unlink(dataset.filePath).catch(() => undefined);
  }
  await createAuditLog({
    userId: req.user!.userId,
    action: "delete_dataset",
    resource: "datasets",
    resourceId: dataset.id,
    ipAddress: req.ip,
  });
  res.status(204).send();
});

router.post("/datasets/upload", requirePermission(PERMISSIONS.MANAGE_DATASETS), upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    validateUpload(req.file);

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
      fileType: getFileExtension(req.file.originalname),
      recordCount: aiResult.record_count ?? 0,
      status: "processing",
      uploadedBy: req.user!.userId,
      metadata: {
        ...aiResult,
        lifecycleState: "pending",
      },
    }).returning();

    let lifecycle = null;
    try {
      lifecycle = await queueAutonomousTrainingForDataset(dataset.id, {
        trigger: "dataset_upload",
        startedBy: req.user!.userId,
      });
    } catch (err) {
      // Don't block upload response; lifecycle will still retry via scheduler polling.
      broadcastEvent("lifecycle_error", {
        datasetId: dataset.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await createAuditLog({
      userId: req.user!.userId,
      action: "upload_dataset",
      resource: "datasets",
      resourceId: dataset.id,
      details: { fileType: dataset.fileType, lifecycleQueued: Boolean(lifecycle) },
      ipAddress: req.ip,
    });

    res.status(201).json({ dataset, ai: aiResult, lifecycle });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

router.post("/packets/parse", requirePermission(PERMISSIONS.PREDICT), upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No packet capture file uploaded" });
      return;
    }
    validateUpload(req.file);

    const fs = await import("fs/promises");
    const fileBuffer = await fs.readFile(req.file.path);

    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), req.file.originalname);
    formData.append("name", req.body.name || req.file.originalname);

    const parsed = await aiService.parsePackets(formData) as ParsedPacketAnalysis;
    const [dataset] = await db.insert(datasets).values({
      name: req.body.name || req.file.originalname,
      source: "packet_capture",
      filePath: String(parsed.file_path ?? ""),
      fileType: getFileExtension(req.file.originalname),
      recordCount: Number(parsed.flow_count ?? 0),
      featureCount: Array.isArray(parsed.latest_snapshot?.node_features)
        ? Number(parsed.latest_snapshot?.node_features?.[0]?.length ?? 0)
        : 0,
      status: "processing",
      uploadedBy: req.user!.userId,
      metadata: {
        filename: parsed.filename,
        flowCount: parsed.flow_count ?? 0,
        snapshotCount: parsed.snapshot_count ?? 0,
        protocols: parsed.protocols ?? [],
        lifecycleState: "pending",
      },
    }).returning();
    const persisted = await persistPacketAnalysis(parsed, dataset.id);

    let lifecycle = null;
    try {
      lifecycle = await queueAutonomousTrainingForDataset(dataset.id, {
        trigger: "packet_capture",
        startedBy: req.user!.userId,
      });
    } catch (err) {
      broadcastEvent("lifecycle_error", {
        datasetId: dataset.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.status(202).json({ ...parsed, dataset, persisted, lifecycle });

    await createAuditLog({
      userId: req.user!.userId,
      action: "parse_packets",
      resource: "datasets",
      resourceId: dataset.id,
      details: {
        filename: req.file.originalname,
        flowCount: parsed.flow_count ?? 0,
        predictionCount: persisted.predictions,
        graphId: persisted.graphId,
      },
      ipAddress: req.ip,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Packet parsing failed" });
  }
});

router.post("/network/scan", requirePermission(PERMISSIONS.PREDICT), async (req: AuthenticatedRequest, res) => {
  try {
    const datasetId = String(req.body.datasetId ?? "unsw_nb15");
    const windowSeconds = Number(req.body.windowSeconds ?? 30);
    const result = await syncNetworkFromDataset(datasetId, windowSeconds);

    await createAuditLog({
      userId: req.user!.userId,
      action: "network_scan",
      resource: "network_nodes",
      details: { datasetId, windowSeconds, scanRange: req.body.scanRange, result },
      ipAddress: req.ip,
    });

    broadcastEvent("network_topology", result);
    res.json({ scan: result, datasetId, windowSeconds });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Network scan failed" });
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

async function persistPacketAnalysis(parsed: ParsedPacketAnalysis, datasetId?: string) {
  const snapshot = parsed.latest_snapshot;
  let graphId: string | null = null;
  const nodeIdMap = new Map<string, string>();

  if (snapshot) {
    const [graph] = await db.insert(attackGraphs).values({
      name: `Packet capture ${parsed.filename ?? "analysis"}`,
      windowSeconds: Number(snapshot.window_seconds ?? 30),
      nodeCount: Number(snapshot.node_count ?? snapshot.nodes?.length ?? 0),
      edgeCount: Number(snapshot.edge_count ?? snapshot.edges?.length ?? 0),
      snapshotData: snapshot,
      datasetId,
    }).returning();
    graphId = graph.id;

    for (const node of snapshot.nodes ?? []) {
      const databaseId = await upsertNetworkNodeFromSnapshot(node);
      nodeIdMap.set(node.id, databaseId);
    }

    for (const edge of (snapshot.edges ?? []).slice(0, 1000)) {
      const sourceNodeId = nodeIdMap.get(edge.source);
      const targetNodeId = nodeIdMap.get(edge.target);
      if (!sourceNodeId || !targetNodeId) continue;

      await db.insert(networkEdges).values({
        sourceNodeId,
        targetNodeId,
        protocol: mapProtocol(edge.protocol ?? "other"),
        packetCount: Number(edge.packets ?? 0),
        weight: Math.min(Number(edge.bytes ?? 0) / 1000, 10),
        features: {
          bytes: Number(edge.bytes ?? 0),
          sourceCode: 1,
        },
        timestamp: edge.timestamp ? new Date(edge.timestamp) : new Date(),
      });
    }

    broadcastEvent("graph_update", { id: graphId, snapshot });
    await publish("gnn-ids:events", {
      type: "graph_update",
      payload: { id: graphId, snapshot },
      timestamp: new Date().toISOString(),
    });
  }

  const storedPredictions = [];
  for (const result of parsed.predictions ?? []) {
    const [prediction] = await db.insert(predictions).values({
      attackType: String(result.attack_type ?? "Unknown"),
      attackStage: mapAttackStage(result.attack_stage),
      predictedNextStage: result.predicted_next_stage ? mapAttackStage(result.predicted_next_stage) : undefined,
      threatLevel: mapThreatLevel(result.threat_level),
      probability: clamp01(result.probability),
      confidence: clamp01(result.confidence),
      riskScore: clamp01(result.risk_score),
      isCompromised: Boolean(result.is_compromised),
      explanation: result.explanation ?? {},
      rawFeatures: {
        captureFilename: parsed.filename,
        flowCount: parsed.flow_count ?? 0,
        snapshotCount: parsed.snapshot_count ?? 0,
      },
      graphSnapshotId: graphId ?? undefined,
    }).returning();

    storedPredictions.push(prediction);
    broadcastEvent("prediction", prediction);
    await publish("gnn-ids:events", {
      type: "prediction",
      payload: prediction,
      timestamp: new Date().toISOString(),
    });

    if (prediction.threatLevel !== "low" && prediction.threatLevel !== "info") {
      const [alert] = await db.insert(alerts).values({
        title: `${prediction.attackType} detected in ${parsed.filename ?? "packet capture"}`,
        description: `Packet-derived TGNN prediction at ${prediction.attackStage}. Confidence: ${(prediction.confidence * 100).toFixed(1)}%`,
        severity: prediction.threatLevel,
        attackType: prediction.attackType,
        attackStage: prediction.attackStage,
        mitreTactic: String(result.mitre_tactic ?? ""),
        mitreTechnique: String(result.mitre_technique ?? ""),
        predictionId: prediction.id,
        metadata: {
          source: "packet_parser",
          captureFilename: parsed.filename,
          graphId,
        },
      }).returning();

      broadcastEvent("alert", alert);
      await publish("gnn-ids:events", {
        type: "alert",
        payload: alert,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    graphId,
    nodes: nodeIdMap.size,
    edges: snapshot?.edges?.length ?? 0,
    predictions: storedPredictions.length,
  };
}

async function upsertNetworkNodeFromSnapshot(node: PacketSnapshotNode) {
  const riskScore = Math.min(
    (Number(node.failed_logins ?? 0) * 0.15) +
      (Number(node.connections ?? 0) / 100) +
      (Number(node.packets ?? 0) / 10000),
    1,
  );
  const status = Number(node.failed_logins ?? 0) > 3
    ? "compromised"
    : Number(node.failed_logins ?? 0) > 0 || riskScore > 0.7
      ? "suspicious"
      : "online";

  const existing = await db
    .select()
    .from(networkNodes)
    .where(eq(networkNodes.externalId, node.id))
    .limit(1);

  const values = {
    ipAddress: node.ip,
    hostname: `HOST-${node.ip.split(".").pop() ?? node.id.slice(0, 6)}`,
    nodeType: mapNodeType(node.type ?? "host"),
    status: status as typeof networkNodes.status.enumValues[number],
    riskScore,
    packets: Number(node.packets ?? 0),
    bytes: Number(node.bytes ?? 0),
    failedLogins: Number(node.failed_logins ?? 0),
    connectionCount: Number(node.connections ?? 0),
    openPorts: node.ports ?? [],
    subnet: node.ip.includes(".") ? `${node.ip.split(".").slice(0, 3).join(".")}.0/24` : undefined,
    features: {
      packetParserSource: 1,
    },
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing.length) {
    const [updated] = await db
      .update(networkNodes)
      .set(values)
      .where(eq(networkNodes.id, existing[0].id))
      .returning();
    return updated.id;
  }

  const [inserted] = await db.insert(networkNodes).values({
    externalId: node.id,
    ...values,
  }).returning();
  return inserted.id;
}

function mapNodeType(type: string): typeof networkNodes.nodeType.enumValues[number] {
  const normalized = type.toLowerCase();
  const allowed = networkNodes.nodeType.enumValues;
  return allowed.includes(normalized as typeof allowed[number])
    ? normalized as typeof allowed[number]
    : "host";
}

function mapProtocol(protocol: string): typeof networkEdges.protocol.enumValues[number] {
  const normalized = protocol.toLowerCase();
  const allowed = networkEdges.protocol.enumValues;
  return allowed.includes(normalized as typeof allowed[number])
    ? normalized as typeof allowed[number]
    : "other";
}

function mapAttackStage(stage: unknown): typeof predictions.attackStage.enumValues[number] {
  const normalized = String(stage ?? "normal").toLowerCase().replace(/\s+/g, "_");
  const allowed = predictions.attackStage.enumValues;
  return allowed.includes(normalized as typeof allowed[number])
    ? normalized as typeof allowed[number]
    : "normal";
}

function mapThreatLevel(level: unknown): typeof predictions.threatLevel.enumValues[number] {
  const normalized = String(level ?? "info").toLowerCase();
  const allowed = predictions.threatLevel.enumValues;
  return allowed.includes(normalized as typeof allowed[number])
    ? normalized as typeof allowed[number]
    : "info";
}

function clamp01(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(numeric, 1));
}

async function resolveDataset(datasetIdOrSource: string) {
  if (isUuid(datasetIdOrSource)) {
    const [byId] = await db.select().from(datasets).where(eq(datasets.id, datasetIdOrSource)).limit(1);
    if (byId) return byId;
  }

  const [bySource] = await db.select().from(datasets).where(eq(datasets.source, datasetIdOrSource)).limit(1);
  if (bySource) return bySource;

  const knownSources: Record<string, { name: string; source: string; fileType: string }> = {
    unsw_nb15: { name: "UNSW-NB15", source: "unsw_nb15", fileType: "csv" },
    cicids2017: { name: "CICIDS2017", source: "cicids2017", fileType: "csv" },
    ton_iot: { name: "TON-IoT", source: "ton_iot", fileType: "csv" },
    nsl_kdd: { name: "NSL-KDD", source: "nsl_kdd", fileType: "csv" },
  };
  const definition = knownSources[datasetIdOrSource];
  if (!definition) {
    throw new Error(`Dataset not found: ${datasetIdOrSource}`);
  }

  const [created] = await db.insert(datasets).values({
    ...definition,
    status: "pending",
    metadata: { autoRegistered: true, lifecycleState: "pending" },
  }).returning();
  return created;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateUpload(file: Express.Multer.File) {
  const extension = getFileExtension(file.originalname);
  if (!SUPPORTED_INGEST_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported upload type .${extension}. Supported: ${Array.from(SUPPORTED_INGEST_EXTENSIONS).join(", ")}`);
  }
  if (file.size <= 0) {
    throw new Error("Uploaded file is empty");
  }
}

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "unknown";
}

async function previewDatasetFile(filePath: string, fileType: string) {
  const fs = await import("fs/promises");
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const content = buffer.subarray(0, bytesRead).toString("utf8");
    if (fileType === "json" || fileType === "jsonl" || fileType === "log") {
      return content.split(/\r?\n/).filter(Boolean).slice(0, 20);
    }
    if (fileType === "pcap" || fileType === "pcapng") {
      return {
        binary: true,
        sizeBytes: (await fs.stat(filePath)).size,
        message: "PCAP preview is available after packet parsing through graph snapshots and extracted flow records.",
      };
    }
    const lines = content.split(/\r?\n/).filter(Boolean).slice(0, 21);
    const headers = lines[0]?.split(",").map((value) => value.trim()) ?? [];
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, values[index] ?? ""]));
    });
    return { headers, rows };
  } finally {
    await handle.close();
  }
}

export default router;
