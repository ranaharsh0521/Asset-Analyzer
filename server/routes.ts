import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAIResponse, analyzeThreat, type ChatMessage } from "./ai";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
// AI Chat endpoint - Live data aware
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const messages: ChatMessage[] = req.body.messages || [];
      const context = req.body.context || {};
      
      console.log('[LIVE] Chat context:', { alerts: context.alertsCount, risk: context.topRisk });
      
      const response = await getAIResponse(messages);
      res.json({ response });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "AI service unavailable" });
    }
  });

// AI Threat Analysis endpoint - Live data
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { alertData, networkData, fullAlerts } = req.body;
      console.log('[LIVE] Analysis:', { alerts: fullAlerts?.length, data: alertData?.slice(0,100) });
      
      const analysis = await analyzeThreat(alertData, networkData);
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Threat analysis failed" });
    }
  });

  return httpServer;
}
