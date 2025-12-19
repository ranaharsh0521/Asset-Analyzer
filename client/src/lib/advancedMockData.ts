export const ATTACK_STAGES = [
  { stage: "Reconnaissance", probability: 0.92, entities: ["192.168.1.50", "external-scanner"], description: "Port scanning detected" },
  { stage: "Weaponization", probability: 0.78, entities: ["cmd-exec-1", "payload-server"], description: "Exploit payload preparation" },
  { stage: "Delivery", probability: 0.65, entities: ["email-gateway", "user-bob"], description: "Phishing attempt to user" },
  { stage: "Exploitation", probability: 0.34, entities: ["workstation-5", "system-process"], description: "CVE-2024-1234 exploitation" },
  { stage: "Installation", probability: 0.12, entities: ["malware-dropper", "persistence"], description: "Backdoor installation attempt" },
  { stage: "C2 Communication", probability: 0.05, entities: ["attacker-c2", "compromised-host"], description: "Command & Control beacon" },
];

export const ATTENTION_WEIGHTS = [
  { entity: "192.168.1.50", weight: 0.34, type: "IP", role: "attacker" },
  { entity: "user-bob", weight: 0.28, type: "User", role: "target" },
  { entity: "10.0.0.5", weight: 0.19, type: "Host", role: "server" },
  { entity: "process-explorer.exe", weight: 0.12, type: "Process", role: "compromised" },
  { entity: "port-445", weight: 0.07, type: "Port", role: "vector" },
];

export const RISK_HEATMAP = [
  { node: "Server-A (10.0.0.1)", risk: 0.89, anomalies: 12, alerts: 34 },
  { node: "Workstation-5 (10.0.1.5)", risk: 0.76, anomalies: 8, alerts: 18 },
  { node: "DB-Primary (10.0.2.100)", risk: 0.92, anomalies: 15, alerts: 42 },
  { node: "User-Bob (10.0.1.50)", risk: 0.65, anomalies: 5, alerts: 7 },
  { node: "Gateway (192.168.1.1)", risk: 0.34, anomalies: 2, alerts: 3 },
  { node: "External-Attacker", risk: 0.98, anomalies: 28, alerts: 89 },
];

export const EARLY_DETECTION_METRICS = [
  { approach: "Random Forest", avgDetectionTime: 45, earlyWarnings: 12, falsePositives: 234 },
  { approach: "XGBoost Baseline", avgDetectionTime: 38, earlyWarnings: 18, falsePositives: 167 },
  { approach: "Static GCN", avgDetectionTime: 22, earlyWarnings: 34, falsePositives: 89 },
  { approach: "TGN (Ours)", avgDetectionTime: 8, earlyWarnings: 58, falsePositives: 12 },
];

export const HETEROGENEOUS_EDGES = [
  { source: "192.168.1.50", target: "user-bob", type: "NetworkFlow", weight: 0.87, timestamp: "2024-01-19T10:42:15" },
  { source: "user-bob", target: "10.0.0.5", type: "LoginAttempt", weight: 0.65, timestamp: "2024-01-19T10:43:22" },
  { source: "10.0.0.5", target: "process-cmd.exe", type: "ProcessSpawn", weight: 0.92, timestamp: "2024-01-19T10:44:08" },
  { source: "process-cmd.exe", target: "port-445", type: "FileAccess", weight: 0.71, timestamp: "2024-01-19T10:45:33" },
  { source: "192.168.1.50", target: "external-c2", type: "C2Communication", weight: 0.98, timestamp: "2024-01-19T10:46:15" },
];

export const MULTITASK_RESULTS = {
  nodeClassification: { accuracy: 0.94, f1: 0.91 },
  stageClassification: { accuracy: 0.87, f1: 0.84 },
  riskScoring: { correlation: 0.92, mse: 0.028 },
  earlyDetection: { avgTimeGain: "37 minutes", successRate: 0.89 },
};

export const EXPLAINABILITY_EXPLANATION = `
ALERT REASONING for Entity: 192.168.1.50

PREDICTED RISK: 0.98 (CRITICAL)

KEY CONTRIBUTING FACTORS:
1. Attention Score: 0.34 - Highest attention weight in graph
   - Source: Abnormal outbound connection patterns
   - Supporting Evidence: 156 unique destination ports in 2 hours

2. Attack Stage Progression: 0.92 probability of Reconnaissance
   - Stage Indicator: Port scanning signature detected
   - Timeline: Began 2 hours ago, escalating

3. Risk Amplification: Connection to user-bob (high-value target)
   - User Role: Admin access to critical databases
   - Connection Type: Direct network flow with high frequency

4. Temporal Anomaly: 3-sigma deviation in connection frequency
   - Baseline: 5 connections/hour
   - Current: 47 connections/hour
   - Duration: Last 90 minutes

RECOMMENDED SOC ACTION:
- Isolate 192.168.1.50 from network
- Increase monitoring of user-bob login attempts
- Block outbound connections to unknown IPs
- Engage IR team for investigation

CONFIDENCE LEVEL: 97% (Very High)
`;
