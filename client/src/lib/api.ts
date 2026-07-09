/**
 * Production API client for GNN-IDS platform.
 * All dashboard data flows through this service — no simulated values.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  totpEnabled: boolean;
  permissions: string[];
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  requiresTotp?: boolean;
  email?: string;
  user?: AuthUser;
}

export interface DashboardMetrics {
  alerts: { total: number; critical: number; high: number; open: number };
  network: { total: number; compromised: number; suspicious: number; avgRisk: number };
  ai: Record<string, unknown>;
  timestamp: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  attackType: string | null;
  attackStage: string | null;
  sourceIp: string | null;
  targetIp: string | null;
  protocol: string | null;
  createdAt: string;
}

export interface NetworkNode {
  id: string;
  ipAddress: string;
  macAddress: string | null;
  hostname: string | null;
  nodeType: string;
  status: string;
  riskScore: number;
  openPorts: number[];
  os: string | null;
  vendor: string | null;
  lastSeenAt: string;
  packets: number | null;
  bytes: number | null;
  failedLogins: number | null;
  connectionCount: number | null;
  subnet: string | null;
  department: string | null;
  features: Record<string, number> | null;
}

export interface Topology {
  nodes: Array<{ id: string; label: string; ip: string; type: string; status: string; risk: number }>;
  edges: Array<{ id: string; source: string; target: string; protocol: string; weight: number }>;
}

export interface Prediction {
  id: string;
  attackType: string;
  attackStage: string;
  predictedNextStage: string | null;
  threatLevel: string;
  probability: number;
  confidence: number;
  riskScore: number;
  isCompromised: boolean;
  createdAt: string;
  explanation: {
    node_importance?: Array<{ node_index: number; importance: number; type: string }>;
    top_attack_type?: string;
    predicted_progression?: string;
    expected_next?: string;
  } | null;
  rawFeatures: Record<string, unknown> | null;
  sourceNodeId: string | null;
  targetNodeId: string | null;
}

export interface TrainingRun {
  id: string;
  architecture: string;
  status: string;
  epochs: number;
  currentEpoch: number;
  trainLoss: number | null;
  valLoss: number | null;
  trainAccuracy: number | null;
  valAccuracy: number | null;
  metrics: Record<string, unknown>;
  gpuUtilization: number | null;
  createdAt: string;
}

export interface RiskScore {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  nodeRisk: number | null;
  subnetRisk: number | null;
  departmentRisk: number | null;
  organizationRisk: number | null;
  propagationRisk: number | null;
  businessImpact: number | null;
  factors: Record<string, number> | null;
  computedAt: string;
}

export interface AttackStageSummary {
  latest: Prediction | null;
  stageCounts: Record<string, number>;
  currentStage: string;
  predictedNextStage: string | null;
  threatLevel: string;
  probability: number;
  confidence: number;
  updatedAt: string | null;
}

export interface SystemHealth {
  status: string;
  ai: {
    status?: string;
    model_loaded?: boolean;
    gpu_available?: boolean;
    device?: string;
  };
  timestamp: string;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem("gnn-ids-access-token");
    this.refreshToken = localStorage.getItem("gnn-ids-refresh-token");
  }

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem("gnn-ids-access-token", access);
    localStorage.setItem("gnn-ids-refresh-token", refresh);
    localStorage.setItem("gnn-ids-auth", "true");
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem("gnn-ids-access-token");
    localStorage.removeItem("gnn-ids-refresh-token");
    localStorage.removeItem("gnn-ids-auth");
  }

  getAccessToken() {
    return this.accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.accessToken = data.accessToken;
      localStorage.setItem("gnn-ids-access-token", data.accessToken);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  async login(email: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, totpCode }),
    });
    if (data.accessToken && data.refreshToken) {
      this.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  }

  async register(name: string, email: string, password: string) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  }

  async logout() {
    try {
      await this.request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
    } finally {
      this.clearTokens();
    }
  }

  async getMe(): Promise<AuthUser> {
    return this.request("/api/auth/me");
  }

  async setupTotp() {
    return this.request<{ qrCode: string; secret: string }>("/api/auth/totp/setup", { method: "POST" });
  }

  async verifyTotp(code: string) {
    return this.request("/api/auth/totp/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.request("/api/dashboard/metrics");
  }

  async getAlerts(params?: { severity?: string; status?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.request<{ alerts: Alert[]; count: number }>(`/api/alerts?${qs}`);
  }

  async updateAlert(id: string, status: string) {
    return this.request(`/api/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async getNetworkNodes(params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit ?? 100));
    return this.request<{ nodes: NetworkNode[]; count: number }>(`/api/network/nodes?${qs}`);
  }

  async getTopology(): Promise<Topology> {
    return this.request("/api/network/topology");
  }

  async scanNetwork(params: { scanRange?: string; datasetId?: string; windowSeconds?: number }) {
    return this.request<{ scan: { nodes: number; edges: number } | null; datasetId: string; windowSeconds: number }>("/api/network/scan", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getPredictions(limit = 50) {
    return this.request<{ predictions: Prediction[] }>(`/api/predictions?limit=${limit}`);
  }

  async getAttackStage() {
    return this.request<AttackStageSummary>("/api/attack-stage");
  }

  async predict(features: Record<string, unknown>, graphSnapshot?: Record<string, unknown>) {
    return this.request("/api/predict", {
      method: "POST",
      body: JSON.stringify({ features, graphSnapshot }),
    });
  }

  async explain(nodeId: string, graphSnapshot: Record<string, unknown>) {
    return this.request("/api/explain", {
      method: "POST",
      body: JSON.stringify({ nodeId, graphSnapshot }),
    });
  }

  async getRiskScores(entityType?: string) {
    const qs = entityType ? `?entity_type=${entityType}` : "";
    return this.request<{ scores: RiskScore[] }>(`/api/risk/scores${qs}`);
  }

  async computeRisk(entityType: string, entityId: string, graphSnapshot: Record<string, unknown>) {
    return this.request("/api/risk/compute", {
      method: "POST",
      body: JSON.stringify({ entityType, entityId, graphSnapshot }),
    });
  }

  async getMetrics(modelId?: string) {
    const qs = modelId ? `?model_id=${modelId}` : "";
    return this.request(`/api/metrics${qs}`);
  }

  async getTrainingRuns() {
    return this.request<{ runs: TrainingRun[] }>("/api/training/runs");
  }

  async startTraining(params: {
    datasetId: string;
    architecture: string;
    hyperparameters?: Record<string, unknown>;
    epochs?: number;
  }) {
    return this.request("/api/training/start", {
      method: "POST",
      body: JSON.stringify({
        datasetId: params.datasetId,
        architecture: params.architecture,
        hyperparameters: params.hyperparameters ?? {},
        epochs: params.epochs ?? 50,
      }),
    });
  }

  async getTrainingRun(id: string) {
    return this.request(`/api/training/runs/${id}`);
  }

  async getDatasets() {
    return this.request("/api/datasets");
  }

  async uploadDataset(file: File, source: string, name: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
    formData.append("name", name);

    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const response = await fetch(`${API_BASE}/api/datasets/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }
    return response.json();
  }

  async buildGraph(datasetId: string, windowSeconds = 30) {
    return this.request("/api/graph/build", {
      method: "POST",
      body: JSON.stringify({ datasetId, windowSeconds }),
    });
  }

  async parsePackets(file: File, name: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);

    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const response = await fetch(`${API_BASE}/api/packets/parse`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Packet parsing failed" }));
      throw new Error(error.error || "Packet parsing failed");
    }
    return response.json();
  }

  async getHealth(): Promise<SystemHealth> {
    return this.request("/api/health");
  }

  createWebSocket(onMessage: (data: unknown) => void): WebSocket | null {
    if (!this.accessToken) return null;
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = API_BASE ? new URL(API_BASE).host : window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws?token=${this.accessToken}`);

    ws.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // ignore
      }
    };

    return ws;
  }
}

export const api = new ApiClient();
