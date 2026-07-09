import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth.routes";
import apiRoutes from "./routes/api.routes";
import adminRoutes from "./routes/admin.routes";
import profileRoutes from "./routes/profile.routes";
import reportRoutes from "./routes/reports.routes";
import notificationRoutes from "./routes/notifications.routes";
import { setupSecurity } from "./middleware/security";
import { setupWebSocket } from "./websocket";
import { seedDatabase } from "./seed";
import { syncNetworkFromDataset } from "./sync-network";
import { startLifecycleScheduler } from "./services/lifecycle";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupSecurity(app);

  app.use("/api/auth", authRoutes);
  app.use("/api", apiRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/notifications", notificationRoutes);

  try {
    await seedDatabase();
    await syncNetworkFromDataset();
    startLifecycleScheduler();
  } catch (error) {
    console.warn("[routes] Initialization skipped (database/AI may not be ready):", error);
  }

  setupWebSocket(httpServer);

  return httpServer;
}
