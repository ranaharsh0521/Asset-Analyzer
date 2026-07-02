import { useSyncExternalStore } from "react";

export type DatasetOption = {
  id: string;
  label: string;
  mode: "batch" | "live";
  description: string;
  source: string;
};

export type LiveTimelinePoint = {
  time: string;
  recordsPerSecond: number;
  throughputMbps: number;
  anomalyRate: number;
  threatScore: number;
  maliciousShare: number;
  maliciousRecords: number;
  benignRecords: number;
  alertsPerMinute: number;
  latencyMs: number;
  droppedPackets: number;
  queueDepth: number;
  confidence: number;
};

export type LiveTrainingPoint = {
  time: string;
  loss: number;
  auc: number;
  precision: number;
  recall: number;
};

export type LiveAttackStage = {
  stage: string;
  probability: number;
  entities: string[];
  description: string;
};

export type LiveExplainabilityWeight = {
  entity: string;
  weight: number;
  type: string;
  role: string;
};

export type LiveRiskNode = {
  node: string;
  risk: number;
  anomalies: number;
  alerts: number;
};

export type LiveEdge = {
  source: string;
  target: string;
  type: string;
  weight: number;
  timestamp: string;
};

export type LiveAlert = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  title: string;
  src: string;
  dst: string;
  protocol: string;
  time: string;
  isNew?: boolean;
};

export type LiveDeviceAttack = {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  details: string;
};

export type LiveDevice = {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  type: "router" | "server" | "workstation" | "laptop" | "mobile" | "printer" | "iot";
  status: "online" | "offline" | "suspicious" | "compromised";
  risk: number;
  openPorts: number[];
  lastSeen: string;
  vendor: string;
  os: string;
  packetsPerSecond: number;
  throughputMbps: number;
  attacks: LiveDeviceAttack[];
};

export type LiveEvaluationSummary = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  earlyDetectionRate: string;
};

export type LiveBaselineModel = {
  name: string;
  accuracy: number;
  f1: number;
};

export type LiveDatasetSnapshot = {
  dataset: DatasetOption;
  lastUpdated: string;
  step: number;
  current: LiveTimelinePoint;
  timeline: LiveTimelinePoint[];
  trainingTimeline: LiveTrainingPoint[];
  attackStages: LiveAttackStage[];
  explainabilityWeights: LiveExplainabilityWeight[];
  riskNodes: LiveRiskNode[];
  edges: LiveEdge[];
  alerts: LiveAlert[];
  devices: LiveDevice[];
  evaluationSummary: LiveEvaluationSummary;
  baselineComparison: LiveBaselineModel[];
};

export const LIVE_DATASET_ID = "ton_iot_live";

export const DATASET_OPTIONS: DatasetOption[] = [
  {
    id: "cicids2017",
    label: "CICIDS2017 (Sampled)",
    mode: "batch",
    description: "Historical enterprise IDS benchmark with replay-friendly flow snapshots.",
    source: "Static CSV batches",
  },
  {
    id: "unsw",
    label: "UNSW-NB15",
    mode: "batch",
    description: "Labeled intrusion traces for offline graph training and validation.",
    source: "Offline packet features",
  },
  {
    id: "darpa",
    label: "DARPA Intrusion Detection",
    mode: "batch",
    description: "Classic intrusion benchmark for baseline comparisons.",
    source: "Archived scenario windows",
  },
  {
    id: LIVE_DATASET_ID,
    label: "TON-IoT Live Replay",
    mode: "live",
    description: "Continuously replayed enterprise and IoT telemetry with live anomaly bursts.",
    source: "Streaming event replay @ 1 second cadence",
  },
];

const TIMELINE_POINTS = 24;
const TRAINING_POINTS = 18;

const DEVICE_TEMPLATES = [
  {
    id: "dev-gateway",
    ip: "192.168.1.1",
    mac: "3c:52:82:9a:11:01",
    hostname: "GW-MAIN",
    type: "router" as const,
    vendor: "Cisco Systems",
    os: "IOS XE 17",
    openPorts: [22, 80, 443, 161],
    baseRisk: 0.24,
  },
  {
    id: "dev-db",
    ip: "10.0.2.100",
    mac: "84:39:be:17:2f:4c",
    hostname: "DB-PRIMARY",
    type: "server" as const,
    vendor: "Dell Inc.",
    os: "Ubuntu 22.04 LTS",
    openPorts: [22, 5432, 8080],
    baseRisk: 0.58,
  },
  {
    id: "dev-web",
    ip: "10.0.0.5",
    mac: "50:eb:f6:9d:44:01",
    hostname: "WEB-SRV-01",
    type: "server" as const,
    vendor: "HP Enterprise",
    os: "Windows Server 2022",
    openPorts: [80, 443, 3389],
    baseRisk: 0.46,
  },
  {
    id: "dev-user",
    ip: "10.0.1.50",
    mac: "44:38:39:af:0e:99",
    hostname: "USER-BOB",
    type: "workstation" as const,
    vendor: "Lenovo",
    os: "Windows 11 Pro",
    openPorts: [135, 139, 445],
    baseRisk: 0.44,
  },
  {
    id: "dev-laptop",
    ip: "10.0.1.88",
    mac: "58:ef:68:22:1a:77",
    hostname: "DEV-LAPTOP",
    type: "laptop" as const,
    vendor: "Apple Inc.",
    os: "macOS Ventura",
    openPorts: [22, 443],
    baseRisk: 0.29,
  },
  {
    id: "dev-printer",
    ip: "10.0.1.12",
    mac: "90:2b:34:11:7a:cc",
    hostname: "HP-PRINTER-01",
    type: "printer" as const,
    vendor: "HP Enterprise",
    os: "Embedded Linux",
    openPorts: [80, 9100],
    baseRisk: 0.16,
  },
  {
    id: "dev-iot",
    ip: "10.0.3.8",
    mac: "2c:54:91:4c:31:1d",
    hostname: "IOT-SENSOR",
    type: "iot" as const,
    vendor: "Samsung Electronics",
    os: "Linux 5.15",
    openPorts: [1883, 8080],
    baseRisk: 0.35,
  },
  {
    id: "dev-ext",
    ip: "198.51.100.42",
    mac: "aa:bb:cc:00:11:42",
    hostname: "EXTERNAL-SCANNER",
    type: "server" as const,
    vendor: "Unknown",
    os: "Unknown",
    openPorts: [53, 80, 443],
    baseRisk: 0.7,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 1) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildAttackStages(
  threatScore: number,
  maliciousShare: number,
  topDevice: LiveDevice,
): LiveAttackStage[] {
  const stageInputs = [
    {
      stage: "Reconnaissance",
      probability: clamp(0.44 + threatScore * 0.44 + maliciousShare * 0.25, 0.18, 0.99),
      entities: [topDevice.ip, "external-scanner"],
      description: "Port fan-out and host discovery remain active.",
    },
    {
      stage: "Weaponization",
      probability: clamp(0.28 + threatScore * 0.38, 0.1, 0.95),
      entities: ["payload-runner.exe", topDevice.hostname.toLowerCase()],
      description: "Payload staging and command preparation are rising.",
    },
    {
      stage: "Delivery",
      probability: clamp(0.22 + threatScore * 0.34 + maliciousShare * 0.28, 0.08, 0.9),
      entities: ["email-gateway", topDevice.hostname.toLowerCase()],
      description: "Delivery traffic is converging on the highest-risk host.",
    },
    {
      stage: "Exploitation",
      probability: clamp(0.18 + threatScore * 0.31, 0.06, 0.88),
      entities: [topDevice.hostname.toLowerCase(), "auth-service"],
      description: "Privilege use and suspicious auth paths are emerging.",
    },
    {
      stage: "Installation",
      probability: clamp(0.12 + threatScore * 0.22, 0.04, 0.8),
      entities: ["registry-persist", "process-cmd.exe"],
      description: "Persistence attempts are present but not dominant.",
    },
    {
      stage: "C2 Communication",
      probability: clamp(0.08 + threatScore * 0.18 + maliciousShare * 0.22, 0.03, 0.76),
      entities: [topDevice.ip, "198.51.100.42"],
      description: "Beacon-like timing patterns are visible in outbound flow.",
    },
  ];

  return stageInputs.map((stage) => ({
    ...stage,
    probability: round(stage.probability, 2),
  }));
}

function normalizeWeights(weights: LiveExplainabilityWeight[]) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0) || 1;

  return weights.map((item) => ({
    ...item,
    weight: round(item.weight / total, 2),
  }));
}

function buildExplainabilityWeights(
  devices: LiveDevice[],
  current: LiveTimelinePoint,
): LiveExplainabilityWeight[] {
  const primary = devices[0];
  const secondary = devices[1] ?? primary;
  const vectorPort = primary.openPorts[0] ?? 443;

  return normalizeWeights([
    {
      entity: primary.ip,
      weight: 0.29 + current.threatScore * 0.08,
      type: "IP",
      role: "primary source",
    },
    {
      entity: secondary.hostname.toLowerCase(),
      weight: 0.22 + current.maliciousShare * 0.1,
      type: "Host",
      role: "critical target",
    },
    {
      entity: `port-${vectorPort}`,
      weight: 0.17,
      type: "Port",
      role: "entry vector",
    },
    {
      entity: "auth-service",
      weight: 0.15,
      type: "Service",
      role: "lateral pivot",
    },
    {
      entity: "payload-runner.exe",
      weight: 0.14 + current.anomalyRate / 100,
      type: "Process",
      role: "suspicious execution",
    },
  ]);
}

function toSeverity(risk: number): LiveAlert["severity"] {
  if (risk >= 0.85) {
    return "CRITICAL";
  }
  if (risk >= 0.7) {
    return "HIGH";
  }
  if (risk >= 0.48) {
    return "MEDIUM";
  }
  return "INFO";
}

function toAttackSeverity(risk: number): LiveDeviceAttack["severity"] {
  if (risk >= 0.85) {
    return "critical";
  }
  if (risk >= 0.7) {
    return "high";
  }
  if (risk >= 0.5) {
    return "medium";
  }
  return "low";
}

function buildDevices(current: LiveTimelinePoint, step: number) {
  const phase = step / 2.6;

  const devices = DEVICE_TEMPLATES.map((template, index) => {
    const localWave = (Math.sin(phase + index * 0.85) + 1) / 2;
    const risk = clamp(
      template.baseRisk + current.threatScore * 0.26 + localWave * 0.28 + randomBetween(-0.04, 0.04),
      0.08,
      0.99,
    );

    const status: LiveDevice["status"] =
      risk > 0.84 ? "compromised" : risk > 0.62 ? "suspicious" : "online";

    const packetsPerSecond = Math.round(
      current.recordsPerSecond * (0.05 + localWave * 0.09 + index * 0.004),
    );
    const throughputMbps = round(
      current.throughputMbps * (0.08 + localWave * 0.11 + index * 0.005),
      1,
    );

    const attacks: LiveDeviceAttack[] =
      status === "online"
        ? []
        : [
            {
              type:
                status === "compromised"
                  ? "Lateral movement detected"
                  : "Suspicious authentication burst",
              severity: toAttackSeverity(risk),
              timestamp: current.time,
              details: `${template.hostname} is receiving abnormal traffic at ${packetsPerSecond.toLocaleString()} pps.`,
            },
            {
              type: "Anomalous east-west flow",
              severity: toAttackSeverity(risk - 0.1),
              timestamp: current.time,
              details: `Live stream confidence ${Math.round(current.confidence * 100)}% with queue depth ${current.queueDepth}.`,
            },
          ];

    return {
      ...template,
      status,
      risk: round(risk, 2),
      lastSeen: current.time,
      packetsPerSecond,
      throughputMbps,
      attacks,
    };
  });

  return devices.sort((left, right) => right.risk - left.risk);
}

function buildAlerts(
  devices: LiveDevice[],
  current: LiveTimelinePoint,
  attackStages: LiveAttackStage[],
  step: number,
) {
  return devices.slice(0, 8).map((device, index) => {
    const stage = attackStages[index % attackStages.length];
    const severity = toSeverity(device.risk);

    return {
      id: `${device.id}-${step}-${index}`,
      severity,
      title:
        severity === "CRITICAL"
          ? `${stage.stage} escalation on ${device.hostname}`
          : `${stage.stage} signal targeting ${device.hostname}`,
      src: index % 2 === 0 ? "198.51.100.42" : device.ip,
      dst: index % 2 === 0 ? device.ip : "10.0.0.5",
      protocol: device.openPorts.includes(443) ? "HTTPS" : device.openPorts.includes(22) ? "SSH" : "TCP",
      time: current.time,
      isNew: index === 0,
    };
  });
}

function buildRiskNodes(devices: LiveDevice[]) {
  return devices.slice(0, 6).map((device) => ({
    node: `${device.hostname} (${device.ip})`,
    risk: device.risk,
    anomalies: Math.max(1, Math.round(device.risk * 18)),
    alerts: Math.max(1, Math.round(device.risk * 48)),
  }));
}

function buildEdges(devices: LiveDevice[], attackStages: LiveAttackStage[], current: LiveTimelinePoint) {
  const [primary, secondary, tertiary] = devices;
  const fallback = primary ?? devices[0];

  return [
    {
      source: "198.51.100.42",
      target: primary?.ip ?? "10.0.1.50",
      type: "NetworkFlow",
      weight: round(attackStages[0]?.probability ?? 0.5, 2),
      timestamp: current.time,
    },
    {
      source: primary?.hostname.toLowerCase() ?? "user-bob",
      target: secondary?.hostname.toLowerCase() ?? "auth-service",
      type: "LoginAttempt",
      weight: round(attackStages[2]?.probability ?? 0.42, 2),
      timestamp: current.time,
    },
    {
      source: secondary?.hostname.toLowerCase() ?? "web-srv-01",
      target: tertiary?.hostname.toLowerCase() ?? "db-primary",
      type: "ProcessSpawn",
      weight: round(attackStages[3]?.probability ?? 0.36, 2),
      timestamp: current.time,
    },
    {
      source: fallback?.hostname.toLowerCase() ?? "gw-main",
      target: `port-${fallback?.openPorts[0] ?? 443}`,
      type: "FileAccess",
      weight: round(current.threatScore, 2),
      timestamp: current.time,
    },
    {
      source: primary?.ip ?? "10.0.1.50",
      target: "198.51.100.42",
      type: "C2Communication",
      weight: round(attackStages[5]?.probability ?? 0.24, 2),
      timestamp: current.time,
    },
  ];
}

function buildEvaluationSummary(current: LiveTimelinePoint, training: LiveTrainingPoint[]) {
  const latestTraining = training[training.length - 1];
  const accuracy = clamp(0.88 + latestTraining.auc * 0.08, 0.89, 0.98);
  const precision = clamp(latestTraining.precision + 0.03, 0.84, 0.97);
  const recall = clamp(latestTraining.recall + 0.02, 0.86, 0.98);
  const f1 = clamp((2 * precision * recall) / (precision + recall), 0.85, 0.98);

  return {
    accuracy: round(accuracy, 3),
    precision: round(precision, 3),
    recall: round(recall, 3),
    f1: round(f1, 3),
    auc: round(latestTraining.auc, 3),
    earlyDetectionRate: `${Math.round(82 + current.confidence * 14)}% (< 1.5s)`,
  };
}

function buildBaselineComparison(summary: LiveEvaluationSummary) {
  return [
    { name: "Random Forest", accuracy: 0.85, f1: 0.82 },
    { name: "Logistic Reg", accuracy: 0.72, f1: 0.68 },
    { name: "GCN (Static)", accuracy: 0.88, f1: 0.86 },
    { name: "TON-IoT Live", accuracy: summary.accuracy, f1: summary.f1 },
  ];
}

function createCurrentPoint(step: number): LiveTimelinePoint {
  const phase = step / 2.4;
  const recordsPerSecond = Math.max(
    1800,
    Math.round(
      5200 +
        Math.sin(phase) * 1100 +
        Math.cos(phase / 1.8) * 540 +
        randomBetween(-180, 180),
    ),
  );
  const throughputMbps = round(
    38 + Math.sin(phase / 1.3) * 9 + Math.cos(phase / 2.8) * 5 + randomBetween(-1.2, 1.2),
    1,
  );
  const anomalyRate = round(
    clamp(1.4 + (Math.sin(phase * 1.7) + 1) * 2.7 + randomBetween(-0.4, 0.5), 0.8, 8.9),
    2,
  );
  const maliciousShare = round(
    clamp(0.04 + anomalyRate / 18 + randomBetween(-0.01, 0.015), 0.03, 0.34),
    2,
  );
  const threatScore = round(
    clamp(0.24 + anomalyRate / 11 + maliciousShare * 0.28 + randomBetween(-0.03, 0.03), 0.18, 0.98),
    2,
  );
  const maliciousRecords = Math.round(recordsPerSecond * maliciousShare);
  const benignRecords = Math.max(0, recordsPerSecond - maliciousRecords);

  return {
    time: formatTime(),
    recordsPerSecond,
    throughputMbps: Math.max(8, throughputMbps),
    anomalyRate,
    threatScore,
    maliciousShare,
    maliciousRecords,
    benignRecords,
    alertsPerMinute: Math.round(8 + anomalyRate * 4 + randomBetween(-1, 2)),
    latencyMs: round(12 + anomalyRate * 3.4 + randomBetween(-1.5, 1.5), 1),
    droppedPackets: Math.max(0, Math.round(20 + anomalyRate * 22 + randomBetween(-8, 14))),
    queueDepth: Math.max(1, Math.round(5 + anomalyRate * 6 + randomBetween(-1, 3))),
    confidence: round(clamp(0.76 + threatScore * 0.18 + randomBetween(-0.015, 0.015), 0.72, 0.99), 2),
  };
}

function createTrainingPoint(step: number, current: LiveTimelinePoint): LiveTrainingPoint {
  const phase = step / 2.2;

  return {
    time: current.time,
    loss: round(clamp(0.82 - step * 0.008 + Math.sin(phase / 1.7) * 0.035, 0.16, 0.9), 4),
    auc: round(clamp(0.79 + step * 0.004 + current.confidence * 0.12 + randomBetween(-0.006, 0.006), 0.8, 0.985), 3),
    precision: round(clamp(0.74 + step * 0.0035 + current.threatScore * 0.12 + randomBetween(-0.01, 0.01), 0.76, 0.97), 3),
    recall: round(clamp(0.77 + step * 0.0038 + current.confidence * 0.1 + randomBetween(-0.01, 0.01), 0.78, 0.98), 3),
  };
}

function buildSnapshot(step: number, previous: LiveDatasetSnapshot | null): LiveDatasetSnapshot {
  const current = createCurrentPoint(step);
  const trainingPoint = createTrainingPoint(step, current);
  const timeline = [...(previous?.timeline ?? []), current].slice(-TIMELINE_POINTS);
  const trainingTimeline = [...(previous?.trainingTimeline ?? []), trainingPoint].slice(-TRAINING_POINTS);
  const devices = buildDevices(current, step);
  const attackStages = buildAttackStages(current.threatScore, current.maliciousShare, devices[0]);
  const riskNodes = buildRiskNodes(devices);
  const explainabilityWeights = buildExplainabilityWeights(devices, current);
  const edges = buildEdges(devices, attackStages, current);
  const alerts = buildAlerts(devices, current, attackStages, step);
  const evaluationSummary = buildEvaluationSummary(current, trainingTimeline);

  return {
    dataset: DATASET_OPTIONS.find((dataset) => dataset.id === LIVE_DATASET_ID) ?? DATASET_OPTIONS[0],
    lastUpdated: current.time,
    step,
    current,
    timeline,
    trainingTimeline,
    attackStages,
    explainabilityWeights,
    riskNodes,
    edges,
    alerts,
    devices,
    evaluationSummary,
    baselineComparison: buildBaselineComparison(evaluationSummary),
  };
}

function createInitialSnapshot() {
  let snapshot: LiveDatasetSnapshot | null = null;

  for (let step = 1; step <= TIMELINE_POINTS; step += 1) {
    snapshot = buildSnapshot(step, snapshot);
  }

  return snapshot as LiveDatasetSnapshot;
}

let state = createInitialSnapshot();
const listeners = new Set<() => void>();
let tickerStarted = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function ensureTicker() {
  if (tickerStarted || typeof window === "undefined") {
    return;
  }

  tickerStarted = true;
  window.setInterval(() => {
    state = buildSnapshot(state.step + 1, state);
    emit();
  }, 1000);
}

function subscribe(listener: () => void) {
  ensureTicker();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  ensureTicker();
  return state;
}

export function useLiveDatasetFeed() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getDatasetOption(datasetId: string) {
  return DATASET_OPTIONS.find((dataset) => dataset.id === datasetId) ?? DATASET_OPTIONS[0];
}

export function buildTrainingRunLogs(options: {
  datasetId: string;
  graphStrategy: "static" | "temporal";
  modelVariant: "gcn" | "gat" | "graphsage" | "tgn";
  learningRate: string;
  hiddenDim: number;
  snapshot: LiveDatasetSnapshot;
}) {
  const dataset = getDatasetOption(options.datasetId);
  const recentTraining = options.snapshot.trainingTimeline.slice(-6);
  const strategyLabel =
    options.graphStrategy === "temporal" ? "Continuous Temporal (TGN-ready)" : "Static Snapshot";

  return [
    "[INFO] Initializing GNN-IDS training session...",
    `[INFO] Loading dataset: ${dataset.label}`,
    dataset.mode === "live"
      ? `[INFO] Subscribed to live replay feed at ${options.snapshot.current.recordsPerSecond.toLocaleString()} records/sec`
      : `[INFO] Reading historical batches from ${dataset.source}`,
    `[INFO] Dataset descriptor: ${dataset.description}`,
    `[INFO] Graph construction mode: ${strategyLabel}`,
    `[INFO] Model: ${options.modelVariant.toUpperCase()}`,
    `[INFO] Hyperparameters: lr=${options.learningRate}, hidden_dim=${options.hiddenDim}`,
    `[SUCCESS] Stream health OK | throughput=${options.snapshot.current.throughputMbps} Mbps | alerts/min=${options.snapshot.current.alertsPerMinute}`,
    "--------------------------------------------------",
    ...recentTraining.map((point, index) => {
      const epoch = index + 1;
      return `Epoch ${epoch}/6 | Loss: ${point.loss.toFixed(4)} | AUC: ${point.auc.toFixed(3)} | Precision: ${point.precision.toFixed(3)} | Recall: ${point.recall.toFixed(3)}`;
    }),
  ];
}

export function buildLiveExplanation(snapshot: LiveDatasetSnapshot) {
  const primaryNode = snapshot.riskNodes[0];
  const topWeight = snapshot.explainabilityWeights[0];
  const topStage = snapshot.attackStages[0];

  return `
ALERT REASONING for Entity: ${topWeight?.entity ?? "Unknown entity"}

PREDICTED RISK: ${primaryNode ? primaryNode.risk.toFixed(2) : "0.00"} (${toSeverity(primaryNode?.risk ?? 0)})

LIVE DATASET: ${snapshot.dataset.label}
LAST UPDATE: ${snapshot.lastUpdated}

KEY CONTRIBUTING FACTORS:
1. Attention Score: ${topWeight ? topWeight.weight.toFixed(2) : "0.00"} - strongest contributor in the live graph
   - Entity Type: ${topWeight?.type ?? "Unknown"}
   - Operational Role: ${topWeight?.role ?? "Unknown"}

2. Attack Stage Progression: ${topStage ? Math.round(topStage.probability * 100) : 0}% probability of ${topStage?.stage ?? "Reconnaissance"}
   - Stage Indicator: ${topStage?.description ?? "Pattern not available"}
   - Current Queue Depth: ${snapshot.current.queueDepth}

3. Streaming Telemetry Pressure
   - Records / Second: ${snapshot.current.recordsPerSecond.toLocaleString()}
   - Malicious Share: ${Math.round(snapshot.current.maliciousShare * 100)}%
   - Alert Velocity: ${snapshot.current.alertsPerMinute} alerts / min

4. Operational Confidence
   - Detection Confidence: ${Math.round(snapshot.current.confidence * 100)}%
   - Inference Latency: ${snapshot.current.latencyMs} ms
   - Dropped Packets: ${snapshot.current.droppedPackets}

RECOMMENDED SOC ACTION:
- Investigate ${primaryNode?.node ?? "the highest-risk node"} immediately
- Isolate suspicious east-west flows linked to ${topWeight?.entity ?? "the top entity"}
- Watch for transition from ${topStage?.stage ?? "reconnaissance"} to exploitation
- Keep the live replay feed attached during analyst triage

CONFIDENCE LEVEL: ${Math.round(snapshot.current.confidence * 100)}% (Live)
`.trim();
}
