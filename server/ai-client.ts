const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export class AIServiceClient {
  private baseUrl: string;

  constructor(baseUrl = AI_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  async health(): Promise<{ status: string; model_loaded: boolean; gpu_available: boolean }> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error("AI service unavailable");
    return res.json();
  }

  async predict(features: Record<string, unknown>, graphSnapshot?: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}/api/v1/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features, graph_snapshot: graphSnapshot }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Prediction failed" }));
      throw new Error(err.detail || "Prediction failed");
    }
    return res.json();
  }

  async predictBatch(records: Record<string, unknown>[]) {
    const res = await fetch(`${this.baseUrl}/api/v1/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error("Batch prediction failed");
    return res.json();
  }

  async explain(nodeId: string, graphSnapshot: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}/api/v1/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, graph_snapshot: graphSnapshot }),
    });
    if (!res.ok) throw new Error("Explainability request failed");
    return res.json();
  }

  async startTraining(params: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}/api/v1/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Training start failed");
    return res.json();
  }

  async getTrainingStatus(runId: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/train/${runId}`);
    if (!res.ok) throw new Error("Training status unavailable");
    return res.json();
  }

  async ingestDataset(formData: FormData) {
    const res = await fetch(`${this.baseUrl}/api/v1/datasets/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Dataset upload failed");
    return res.json();
  }

  async buildGraph(datasetId: string, windowSeconds: number) {
    const res = await fetch(`${this.baseUrl}/api/v1/graph/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: datasetId, window_seconds: windowSeconds }),
    });
    if (!res.ok) throw new Error("Graph build failed");
    return res.json();
  }

  async computeRisk(entityType: string, entityId: string, graphSnapshot: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}/api/v1/risk/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, graph_snapshot: graphSnapshot }),
    });
    if (!res.ok) throw new Error("Risk computation failed");
    return res.json();
  }

  async getMetrics(modelId?: string) {
    const url = modelId
      ? `${this.baseUrl}/api/v1/metrics?model_id=${modelId}`
      : `${this.baseUrl}/api/v1/metrics`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Metrics unavailable");
    return res.json();
  }
}

export const aiService = new AIServiceClient();
