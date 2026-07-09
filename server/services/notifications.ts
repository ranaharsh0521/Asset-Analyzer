import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { notifications, users } from "@shared/schema";
import { broadcastEvent } from "../websocket";
import { publish } from "../redis";

type NotificationChannel = "websocket" | "email" | "push";

interface NotifyUserParams {
  userId: string;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
  channels?: NotificationChannel[];
}

export async function notifyUser(params: NotifyUserParams) {
  const [notification] = await db.insert(notifications).values({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    metadata: {
      channels: params.channels ?? ["websocket"],
      ...(params.metadata ?? {}),
    },
  }).returning();

  broadcastEvent("notification", notification);
  await publish("gnn-ids:events", {
    type: "notification",
    payload: notification,
    timestamp: new Date().toISOString(),
  });

  const channels = params.channels ?? ["websocket"];
  if (channels.includes("email")) {
    await sendEmailNotification(params.userId, params.title, params.message);
  }
  if (channels.includes("push")) {
    await sendPushNotification(notification);
  }

  return notification;
}

async function sendEmailNotification(userId: string, title: string, message: string) {
  const host = process.env.SMTP_HOST;
  if (!host) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "noreply@gnn-ids.local",
    to: user.email,
    subject: title,
    text: message,
  });
}

async function sendPushNotification(notification: typeof notifications.$inferSelect) {
  const webhookUrl = process.env.PUSH_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: notification.metadata,
    }),
  }).catch(() => undefined);
}
