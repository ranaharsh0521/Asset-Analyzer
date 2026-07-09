import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  alerts,
  auditLogs,
  datasets,
  mlModels,
  notifications,
  roles,
  sessions,
  systemLogs,
  trainingRuns,
  users,
} from "@shared/schema";
import {
  authenticate,
  createAuditLog,
  hashPassword,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from "../auth";
import { aiService } from "../ai-client";
import { getConnectedClients } from "../websocket";
import { notifyUser } from "../services/notifications";
import { queueAutonomousTrainingForDataset } from "../services/lifecycle";

const router = Router();

router.use(authenticate, requirePermission(PERMISSIONS.ADMIN));

router.get("/summary", async (_req, res) => {
  const [userStats] = await db.select({ total: sql<number>`count(*)::int` }).from(users);
  const [datasetStats] = await db.select({ total: sql<number>`count(*)::int` }).from(datasets);
  const [modelStats] = await db.select({
    total: sql<number>`count(*)::int`,
    active: sql<number>`count(*) filter (where ${mlModels.isActive} = true)::int`,
  }).from(mlModels);
  const [alertStats] = await db.select({
    open: sql<number>`count(*) filter (where ${alerts.status} = 'open')::int`,
    critical: sql<number>`count(*) filter (where ${alerts.severity} = 'critical')::int`,
  }).from(alerts);

  let ai = { status: "unavailable" };
  try {
    ai = await aiService.health();
  } catch {
    // AI health is reported as unavailable.
  }

  res.json({
    users: userStats,
    datasets: datasetStats,
    models: modelStats,
    alerts: alertStats,
    websocketClients: getConnectedClients(),
    ai,
    timestamp: new Date().toISOString(),
  });
});

router.get("/users", async (_req, res) => {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      roleId: users.roleId,
      role: roles.name,
      isActive: users.isActive,
      totpEnabled: users.totpEnabled,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(desc(users.createdAt));

  res.json({ users: result });
});

router.post("/users", async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role } = req.body;
    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role ?? "analyst")).limit(1);
    if (!roleRow) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const [user] = await db.insert(users).values({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await hashPassword(password),
      roleId: roleRow.id,
      emailVerified: true,
    }).returning();

    await createAuditLog({
      userId: req.user!.userId,
      action: "admin_create_user",
      resource: "users",
      resourceId: user.id,
      ipAddress: req.ip,
    });

    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "User creation failed" });
  }
});

router.patch("/users/:id", async (req: AuthenticatedRequest, res) => {
  const { name, email, role, isActive } = req.body;
  let roleId: string | undefined;

  if (role) {
    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role)).limit(1);
    if (!roleRow) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    roleId = roleRow.id;
  }

  const [updated] = await db.update(users).set({
    name,
    email: email ? String(email).toLowerCase() : undefined,
    roleId,
    isActive,
    updatedAt: new Date(),
  }).where(eq(users.id, req.params.id)).returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await createAuditLog({
    userId: req.user!.userId,
    action: "admin_update_user",
    resource: "users",
    resourceId: updated.id,
    details: { name, email, role, isActive },
    ipAddress: req.ip,
  });

  res.json({ user: updated });
});

router.get("/roles", async (_req, res) => {
  const result = await db.select().from(roles).orderBy(roles.name);
  res.json({ roles: result });
});

router.get("/sessions", async (_req, res) => {
  const result = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      email: users.email,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .orderBy(desc(sessions.createdAt))
    .limit(200);

  res.json({ sessions: result });
});

router.get("/audit-logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const result = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  res.json({ logs: result });
});

router.get("/system-logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const result = await db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(limit);
  res.json({ logs: result });
});

router.get("/api-monitoring", async (_req, res) => {
  const [auditStats] = await db.select({
    totalRequests: sql<number>`count(*)::int`,
    authEvents: sql<number>`count(*) filter (where ${auditLogs.resource} = 'sessions')::int`,
    predictionEvents: sql<number>`count(*) filter (where ${auditLogs.resource} = 'predictions')::int`,
  }).from(auditLogs);

  const [trainingStats] = await db.select({
    running: sql<number>`count(*) filter (where ${trainingRuns.status} = 'running')::int`,
    failed: sql<number>`count(*) filter (where ${trainingRuns.status} = 'failed')::int`,
    completed: sql<number>`count(*) filter (where ${trainingRuns.status} = 'completed')::int`,
  }).from(trainingRuns);

  res.json({
    audit: auditStats,
    training: trainingStats,
    websocketClients: getConnectedClients(),
    timestamp: new Date().toISOString(),
  });
});

router.get("/models", async (_req, res) => {
  const models = await db.select().from(mlModels).orderBy(desc(mlModels.createdAt));
  const active = models.find((model) => model.isActive) ?? null;
  const best = [...models].sort((a, b) => scoreModel(b.metrics) - scoreModel(a.metrics))[0] ?? null;
  res.json({ models, active, best });
});

router.post("/models/:id/promote", async (req: AuthenticatedRequest, res) => {
  const [model] = await db.select().from(mlModels).where(eq(mlModels.id, req.params.id)).limit(1);
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  await aiService.deployModel(model.filePath);
  await db.update(mlModels).set({ isActive: false }).where(eq(mlModels.isActive, true));
  const [active] = await db.update(mlModels).set({
    isActive: true,
    hyperparameters: {
      ...(model.hyperparameters ?? {}),
      deploymentStatus: "production",
      promotedBy: req.user!.userId,
      promotedAt: new Date().toISOString(),
    },
  }).where(eq(mlModels.id, model.id)).returning();

  await createAuditLog({
    userId: req.user!.userId,
    action: "promote_model",
    resource: "ml_models",
    resourceId: model.id,
    ipAddress: req.ip,
  });

  res.json({ model: active });
});

router.post("/models/:id/rollback", async (req: AuthenticatedRequest, res) => {
  const [model] = await db.select().from(mlModels).where(eq(mlModels.id, req.params.id)).limit(1);
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  if (model.isActive) {
    res.status(400).json({ error: "Model is already active" });
    return;
  }

  await aiService.deployModel(model.filePath);
  await db.update(mlModels).set({ isActive: false }).where(eq(mlModels.isActive, true));
  const [rolledBack] = await db.update(mlModels).set({
    isActive: true,
    hyperparameters: {
      ...(model.hyperparameters ?? {}),
      deploymentStatus: "rollback",
      rolledBackBy: req.user!.userId,
      rolledBackAt: new Date().toISOString(),
    },
  }).where(eq(mlModels.id, model.id)).returning();

  await createAuditLog({
    userId: req.user!.userId,
    action: "rollback_model",
    resource: "ml_models",
    resourceId: model.id,
    ipAddress: req.ip,
  });

  res.json({ model: rolledBack });
});

router.get("/models/compare/:left/:right", async (req, res) => {
  const [left] = await db.select().from(mlModels).where(eq(mlModels.id, req.params.left)).limit(1);
  const [right] = await db.select().from(mlModels).where(eq(mlModels.id, req.params.right)).limit(1);
  if (!left || !right) {
    res.status(404).json({ error: "Both models are required for comparison" });
    return;
  }

  res.json({
    left,
    right,
    scores: {
      left: scoreModel(left.metrics),
      right: scoreModel(right.metrics),
      winner: scoreModel(left.metrics) >= scoreModel(right.metrics) ? left.id : right.id,
    },
  });
});

router.post("/datasets/:id/train", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await queueAutonomousTrainingForDataset(req.params.id, {
      trigger: "manual_admin",
      startedBy: req.user!.userId,
      architecture: req.body.architecture,
      epochs: req.body.epochs,
      hyperparameters: req.body.hyperparameters,
    });
    res.status(202).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Training queue failed" });
  }
});

router.post("/notifications", async (req: AuthenticatedRequest, res) => {
  const { userId, title, message, type, channels } = req.body;
  const notification = await notifyUser({
    userId,
    title,
    message,
    type: type ?? "admin",
    channels: channels ?? ["websocket"],
    metadata: { sentBy: req.user!.userId },
  });
  res.status(201).json({ notification });
});

router.get("/notifications", async (_req, res) => {
  const result = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(200);
  res.json({ notifications: result });
});

function scoreModel(metrics: Record<string, number> | null | undefined) {
  const values = metrics ?? {};
  return (
    Number(values.f1 ?? 0) * 0.35 +
    Number(values.accuracy ?? 0) * 0.25 +
    Number(values.recall ?? 0) * 0.15 +
    Number(values.precision ?? 0) * 0.15 +
    Number(values.auc ?? 0) * 0.1
  );
}

export default router;
