import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { aiService } from "../ai-client";
import { broadcastEvent } from "../websocket";
import { publish } from "../redis";
import { notifyUser } from "./notifications";
import { datasets, mlModels, trainingRuns } from "@shared/schema";

type LifecycleTrigger = "dataset_upload" | "packet_capture" | "attack_log" | "manual_admin" | "scheduler";

interface QueueLifecycleParams {
  trigger: LifecycleTrigger;
  startedBy?: string;
  architecture?: typeof trainingRuns.architecture.enumValues[number];
  epochs?: number;
  hyperparameters?: Record<string, unknown>;
}

type AiTrainingStatus = {
  run_id?: string;
  status?: string;
  current_epoch?: number;
  epochs?: number;
  train_loss?: number | null;
  val_loss?: number | null;
  train_accuracy?: number | null;
  val_accuracy?: number | null;
  gpu_utilization?: number | null;
  metrics?: Record<string, unknown>;
  model_path?: string;
  error?: string;
};

const activePolls = new Set<string>();

export async function queueAutonomousTrainingForDataset(datasetId: string, params: QueueLifecycleParams) {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
  if (!dataset) {
    throw new Error("Dataset not found");
  }

  const [existingRun] = await db
    .select()
    .from(trainingRuns)
    .where(and(
      eq(trainingRuns.datasetId, datasetId),
      sql`${trainingRuns.status} in ('queued', 'running')`,
    ))
    .orderBy(desc(trainingRuns.createdAt))
    .limit(1);

  if (existingRun) {
    monitorTrainingRun(existingRun.id, datasetId, params.startedBy);
    return { run: existingRun, queued: false };
  }

  const architecture = params.architecture ?? "gat";
  const epochs = params.epochs ?? Number(process.env.AUTO_TRAIN_EPOCHS ?? 20);
  const aiDatasetSource = dataset.filePath || dataset.source;
  const hyperparameters = {
    autonomous: true,
    trigger: params.trigger,
    datasetSource: aiDatasetSource,
    ...(params.hyperparameters ?? {}),
  };

  const [run] = await db.insert(trainingRuns).values({
    datasetId,
    architecture,
    hyperparameters,
    epochs,
    status: "queued",
    startedBy: params.startedBy,
  }).returning();

  await updateDatasetLifecycle(datasetId, "training_queued", {
    trigger: params.trigger,
    runId: run.id,
  });

  await aiService.startTraining({
    run_id: run.id,
    dataset_id: aiDatasetSource,
    architecture,
    hyperparameters,
    epochs,
  });

  const [running] = await db.update(trainingRuns).set({
    status: "running",
    startedAt: new Date(),
  }).where(eq(trainingRuns.id, run.id)).returning();

  await emitTrainingEvent("training_started", running, { datasetId, trigger: params.trigger });
  monitorTrainingRun(run.id, datasetId, params.startedBy);
  return { run: running, queued: true };
}

export function monitorTrainingRun(runId: string, datasetId: string, startedBy?: string) {
  if (activePolls.has(runId)) return;
  activePolls.add(runId);
  setTimeout(() => pollTrainingRun(runId, datasetId, startedBy), 2500);
}

export async function scanPendingLifecycleDatasets() {
  const pending = await db
    .select()
    .from(datasets)
    .where(sql`${datasets.metadata}->>'lifecycleState' in ('pending', 'training_queued')`)
    .orderBy(desc(datasets.createdAt))
    .limit(10);

  for (const dataset of pending) {
    await queueAutonomousTrainingForDataset(dataset.id, {
      trigger: "scheduler",
      startedBy: dataset.uploadedBy ?? undefined,
    }).catch(() => undefined);
  }

  return { scanned: pending.length };
}

export function startLifecycleScheduler() {
  const enabled = process.env.AUTO_LIFECYCLE_ENABLED !== "false";
  if (!enabled) return;

  const intervalMs = Number(process.env.AUTO_LIFECYCLE_INTERVAL_MS ?? 60000);
  setInterval(() => {
    scanPendingLifecycleDatasets().catch(() => undefined);
  }, intervalMs).unref();
}

async function pollTrainingRun(runId: string, datasetId: string, startedBy?: string) {
  try {
    const status = await aiService.getTrainingStatus(runId) as AiTrainingStatus;
    await syncTrainingStatus(runId, status);

    if (status.status === "completed") {
      activePolls.delete(runId);
      await finalizeTrainingRun(runId, datasetId, status, startedBy);
      return;
    }

    if (status.status === "failed") {
      activePolls.delete(runId);
      await db.update(trainingRuns).set({
        status: "failed",
        errorMessage: status.error ?? "AI training failed",
        completedAt: new Date(),
      }).where(eq(trainingRuns.id, runId));
      await updateDatasetLifecycle(datasetId, "training_failed", { runId, error: status.error });
      await emitTrainingEvent("training_failed", { id: runId }, { datasetId, error: status.error });
      return;
    }

    setTimeout(() => pollTrainingRun(runId, datasetId, startedBy), 5000);
  } catch (error) {
    setTimeout(() => pollTrainingRun(runId, datasetId, startedBy), 10000);
  }
}

async function syncTrainingStatus(runId: string, status: AiTrainingStatus) {
  const update = {
    currentEpoch: Number(status.current_epoch ?? 0),
    trainLoss: nullableNumber(status.train_loss),
    valLoss: nullableNumber(status.val_loss),
    trainAccuracy: nullableNumber(status.train_accuracy),
    valAccuracy: nullableNumber(status.val_accuracy),
    gpuUtilization: nullableNumber(status.gpu_utilization),
    metrics: {
      ...(status.metrics ?? {}),
      history: Array.isArray((status as Record<string, unknown>).history)
        ? (status as Record<string, unknown>).history
        : undefined,
      modelPath: status.model_path,
    },
  };

  const [run] = await db.update(trainingRuns).set(update).where(eq(trainingRuns.id, runId)).returning();
  if (run) {
    await emitTrainingEvent("training_progress", run, {
      currentEpoch: update.currentEpoch,
      epochs: status.epochs ?? run.epochs,
    });
  }
}

async function finalizeTrainingRun(
  runId: string,
  datasetId: string,
  status: AiTrainingStatus,
  startedBy?: string,
) {
  const metrics = numericMetrics(status.metrics ?? {});
  const candidatePath = status.model_path;
  if (!candidatePath) {
    throw new Error("AI training completed without a model path");
  }
  const [run] = await db.select().from(trainingRuns).where(eq(trainingRuns.id, runId)).limit(1);

  const [candidateModel] = await db.insert(mlModels).values({
    name: "TGNN Candidate",
    version: makeVersion(),
    architecture: run?.architecture ?? "gat",
    datasetId,
    filePath: candidatePath,
    metrics,
    hyperparameters: {
      runId,
      deploymentStatus: "candidate",
      lifecycle: "autonomous",
    },
    createdBy: startedBy,
    isActive: false,
  }).returning();

  const [activeModel] = await db
    .select()
    .from(mlModels)
    .where(eq(mlModels.isActive, true))
    .orderBy(desc(mlModels.createdAt))
    .limit(1);

  const candidateScore = scoreMetrics(metrics);
  const activeScore = scoreMetrics(activeModel?.metrics ?? {});
  const shouldPromote = !activeModel || candidateScore > activeScore;

  let deployed = null;
  if (shouldPromote) {
    deployed = await aiService.deployModel(candidatePath);
    await db.update(mlModels).set({ isActive: false }).where(eq(mlModels.isActive, true));
    const [productionModel] = await db.update(mlModels).set({
      name: "TGNN Production",
      filePath: deployed.active_path ?? candidatePath,
      hyperparameters: {
        runId,
        deploymentStatus: "production",
        previousModelId: activeModel?.id,
        candidateScore,
        activeScore,
      },
      isActive: true,
    }).where(eq(mlModels.id, candidateModel.id)).returning();

    await db.update(trainingRuns).set({
      modelId: productionModel.id,
      status: "completed",
      completedAt: new Date(),
      metrics: {
        ...status.metrics,
        deployed: true,
        candidateScore,
        activeScore,
      },
    }).where(eq(trainingRuns.id, runId));

    await updateDatasetLifecycle(datasetId, "model_promoted", {
      runId,
      modelId: productionModel.id,
      candidateScore,
      activeScore,
    });

    if (startedBy) {
      await notifyUser({
        userId: startedBy,
        title: "TGNN model promoted",
        message: `Autonomous training deployed ${productionModel.version} because it outperformed the current production model.`,
        type: "model_promoted",
        channels: ["websocket", "email"],
        metadata: { runId, modelId: productionModel.id },
      });
    }

    await emitTrainingEvent("model_promoted", productionModel, { runId, candidateScore, activeScore });
  } else {
    await db.update(mlModels).set({
      hyperparameters: {
        runId,
        deploymentStatus: "archived",
        activeModelId: activeModel.id,
        candidateScore,
        activeScore,
      },
    }).where(eq(mlModels.id, candidateModel.id));

    await db.update(trainingRuns).set({
      modelId: candidateModel.id,
      status: "completed",
      completedAt: new Date(),
      metrics: {
        ...status.metrics,
        deployed: false,
        candidateScore,
        activeScore,
      },
    }).where(eq(trainingRuns.id, runId));

    await updateDatasetLifecycle(datasetId, "candidate_archived", {
      runId,
      modelId: candidateModel.id,
      candidateScore,
      activeScore,
    });

    await emitTrainingEvent("candidate_archived", candidateModel, { runId, candidateScore, activeScore });
  }
}

async function updateDatasetLifecycle(datasetId: string, lifecycleState: string, details: Record<string, unknown>) {
  const [dataset] = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
  if (!dataset) return;

  await db.update(datasets).set({
    status: lifecycleState.includes("failed")
      ? "failed"
      : lifecycleState === "model_promoted" || lifecycleState === "candidate_archived"
        ? "ready"
        : "processing",
    metadata: {
      ...(dataset.metadata ?? {}),
      lifecycleState,
      lifecycleUpdatedAt: new Date().toISOString(),
      ...details,
    },
    processedAt: lifecycleState === "model_promoted" || lifecycleState === "candidate_archived"
      ? new Date()
      : dataset.processedAt,
  }).where(eq(datasets.id, datasetId));
}

async function emitTrainingEvent(type: string, payload: unknown, metadata: Record<string, unknown> = {}) {
  const message = {
    type: "training_progress",
    payload: { type, data: payload, metadata },
    timestamp: new Date().toISOString(),
  };
  broadcastEvent("training_progress", message.payload);
  await publish("gnn-ids:events", message);
}

function scoreMetrics(metrics: Record<string, unknown>) {
  const accuracy = Number(metrics.accuracy ?? 0);
  const f1 = Number(metrics.f1 ?? 0);
  const recall = Number(metrics.recall ?? 0);
  const precision = Number(metrics.precision ?? 0);
  const auc = Number(metrics.auc ?? metrics.roc_auc ?? 0);
  return (f1 * 0.35) + (accuracy * 0.25) + (recall * 0.15) + (precision * 0.15) + (auc * 0.1);
}

function numericMetrics(metrics: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(metrics)
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => [key, Number(value)]),
  );
}

function makeVersion() {
  return `v${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function nullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
