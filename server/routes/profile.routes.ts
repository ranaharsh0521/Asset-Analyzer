import { randomBytes } from "crypto";
import { desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db";
import { apiKeys, sessions, users } from "@shared/schema";
import {
  authenticate,
  createAuditLog,
  hashPassword,
  hashToken,
  revokeAllUserSessions,
  verifyPassword,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthenticatedRequest, res) => {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    emailVerified: users.emailVerified,
    totpEnabled: users.totpEnabled,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userSessions = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, req.user!.userId))
    .orderBy(desc(sessions.createdAt));

  const keys = await getMaskedApiKeys(req.user!.userId);
  res.json({ user, sessions: userSessions, devices: userSessions, apiKeys: keys });
});

router.patch("/", async (req: AuthenticatedRequest, res) => {
  const { name, email } = req.body;
  const [updated] = await db.update(users).set({
    name,
    email: email ? String(email).toLowerCase() : undefined,
    updatedAt: new Date(),
  }).where(eq(users.id, req.user!.userId)).returning();

  await createAuditLog({
    userId: req.user!.userId,
    action: "update_profile",
    resource: "users",
    resourceId: req.user!.userId,
    ipAddress: req.ip,
  });

  res.json({ user: updated });
});

router.post("/password", async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is invalid" });
    return;
  }

  await db.update(users).set({
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));
  await revokeAllUserSessions(user.id);

  await createAuditLog({
    userId: req.user!.userId,
    action: "change_password",
    resource: "users",
    resourceId: user.id,
    ipAddress: req.ip,
  });

  res.json({ message: "Password changed. All sessions were revoked." });
});

router.get("/sessions", async (req: AuthenticatedRequest, res) => {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, req.user!.userId))
    .orderBy(desc(sessions.createdAt));
  res.json({ sessions: result, devices: result });
});

router.delete("/sessions/:id", async (req: AuthenticatedRequest, res) => {
  await db.delete(sessions).where(eq(sessions.id, req.params.id));
  await createAuditLog({
    userId: req.user!.userId,
    action: "revoke_session",
    resource: "sessions",
    resourceId: req.params.id,
    ipAddress: req.ip,
  });
  res.status(204).send();
});

router.delete("/sessions", async (req: AuthenticatedRequest, res) => {
  await db.delete(sessions).where(eq(sessions.userId, req.user!.userId));
  await createAuditLog({
    userId: req.user!.userId,
    action: "revoke_all_sessions",
    resource: "sessions",
    ipAddress: req.ip,
  });
  res.status(204).send();
});

router.get("/api-keys", async (req: AuthenticatedRequest, res) => {
  res.json({ apiKeys: await getMaskedApiKeys(req.user!.userId) });
});

router.post("/api-keys", async (req: AuthenticatedRequest, res) => {
  const { name, scopes, expiresAt } = req.body;
  const rawKey = `gids_${randomBytes(32).toString("hex")}`;
  const [key] = await db.insert(apiKeys).values({
    userId: req.user!.userId,
    name: name || "API key",
    keyHash: hashToken(rawKey),
    keyPrefix: rawKey.slice(0, 14),
    scopes: Array.isArray(scopes) ? scopes : ["predict", "view_dashboard"],
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  }).returning();

  await createAuditLog({
    userId: req.user!.userId,
    action: "create_api_key",
    resource: "api_keys",
    resourceId: key.id,
    ipAddress: req.ip,
  });

  res.status(201).json({ apiKey: maskKey(key), token: rawKey });
});

router.delete("/api-keys/:id", async (req: AuthenticatedRequest, res) => {
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, req.params.id));
  await createAuditLog({
    userId: req.user!.userId,
    action: "revoke_api_key",
    resource: "api_keys",
    resourceId: req.params.id,
    ipAddress: req.ip,
  });
  res.status(204).send();
});

async function getMaskedApiKeys(userId: string) {
  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
  return keys.map(maskKey);
}

function maskKey(key: typeof apiKeys.$inferSelect) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.keyPrefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    isActive: key.isActive,
    createdAt: key.createdAt,
  };
}

export default router;
