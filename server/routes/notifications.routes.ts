import { desc, eq, and } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db";
import { notifications } from "@shared/schema";
import { authenticate, type AuthenticatedRequest } from "../auth";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthenticatedRequest, res) => {
  const result = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, req.user!.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  res.json({ notifications: result, unread: result.filter((item) => !item.isRead).length });
});

router.patch("/:id/read", async (req: AuthenticatedRequest, res) => {
  const [updated] = await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({ notification: updated });
});

router.patch("/read-all", async (req: AuthenticatedRequest, res) => {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.user!.userId));
  res.json({ message: "Notifications marked as read" });
});

export default router;
