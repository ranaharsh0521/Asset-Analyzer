import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAttackStage, usePredictions, useTopology } from "@/hooks/useApi";

const ATTACK_STAGES = [
  { stage: "reconnaissance", label: "Reconnaissance", description: "Information gathering, scanning, and profiling targets." },
  { stage: "scanning", label: "Scanning", description: "Probing network ports and identifying active services." },
  { stage: "credential_attack", label: "Credential Attack", description: "Brute-force logins or credential harvesting attempts." },
  { stage: "privilege_escalation", label: "Privilege Escalation", description: "Gaining administrative access or elevated rights." },
  { stage: "lateral_movement", label: "Lateral Movement", description: "Pivoting across subnets and compromising adjacent systems." },
  { stage: "persistence", label: "Persistence", description: "Establishing backdoor connections and registry locks." },
  { stage: "data_exfiltration", label: "Data Exfiltration", description: "Compressing and copying sensitive data outside the network." },
  { stage: "impact", label: "Impact", description: "Disrupting operations, deleting backups, or encrypting files." },
];

export default function AttackIntelligence() {
  const { data: predictionsData } = usePredictions();
  const { data: topology } = useTopology();
  const { data: attackStage } = useAttackStage();

  const predictions = predictionsData?.predictions ?? [];
  const latestPrediction = attackStage?.latest ?? predictions[0];

  const mappedStages = ATTACK_STAGES.map((s) => {
    let probability = 0;
    let entities: string[] = [];

    if (latestPrediction && latestPrediction.attackStage === s.stage) {
      probability = latestPrediction.probability;
      const features = (latestPrediction.rawFeatures ?? {}) as Record<string, any>;
      entities = [features.src_ip || features.src || "", features.dst_ip || features.dst || ""].filter(Boolean);
    } else if (latestPrediction && latestPrediction.predictedNextStage === s.stage) {
      probability = latestPrediction.probability * 0.6;
    } else {
      const hist = predictions.find((p) => p.attackStage === s.stage);
      if (hist) {
        probability = hist.probability * 0.4;
        const features = (hist.rawFeatures ?? {}) as Record<string, any>;
        entities = [features.src_ip || features.src || "", features.dst_ip || features.dst || ""].filter(Boolean);
      }
    }

    return {
      stage: s.label,
      probability,
      entities: entities.length > 0 ? entities : ["-"],
      description: s.description,
    };
  });

  const nodeMap = new Map(topology?.nodes?.map((n) => [n.id, n.label || n.ip]) ?? []);
  const mappedEdges = (topology?.edges ?? []).slice(0, 10).map((edge) => ({
    source: nodeMap.get(edge.source) || edge.source,
    target: nodeMap.get(edge.target) || edge.target,
    type: edge.protocol.toUpperCase(),
    weight: edge.weight,
    timestamp: new Date().toLocaleTimeString(),
  }));

  const leadStage = mappedStages.find((s) => s.probability > 0.5) || mappedStages[0];
  const primaryNode = topology?.nodes?.find((n) => n.id === latestPrediction?.targetNodeId) ?? topology?.nodes?.[0];

  const maliciousCount = predictions.filter(
    (p) => p.threatLevel === "critical" || p.threatLevel === "high" || p.threatLevel === "medium"
  ).length;
  const maliciousShare = predictions.length ? maliciousCount / predictions.length : 0;

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Threat Journey</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Threat Journey Intelligence</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Attack progression is mapped directly from live graph network predictions. The storyline
            below tracks the GNN-IDS prediction telemetry.
          </p>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Predicted Attack Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-4 mb-6">
              {mappedStages.map((stage, index) => (
                <div key={stage.stage} className="flex-1 text-center border-b md:border-b-0 pb-4 md:pb-0">
                  <div
                    className={`relative mb-3 p-3 rounded border ${
                      stage.probability > 0.8
                        ? "bg-red-500/10 border-red-500/50"
                        : stage.probability > 0.5
                          ? "bg-yellow-500/10 border-yellow-500/50"
                          : "bg-green-500/10 border-green-500/50"
                    }`}
                  >
                    <div className="text-lg font-bold text-primary mb-1">{Math.round(stage.probability * 100)}%</div>
                    <div className="text-xs font-mono text-muted-foreground">{stage.stage}</div>

                    {index < mappedStages.length - 1 && (
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
                        <div className="w-8 h-0.5 bg-gradient-to-r from-yellow-500 to-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{stage.entities.join(", ")}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mappedStages.map((stage) => ({ name: stage.stage.slice(0, 4), risk: Math.round(stage.probability * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Line type="monotone" dataKey="risk" stroke="hsl(190, 90%, 50%)" strokeWidth={3} dot={{ fill: "hsl(190, 90%, 50%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Attack Path Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mappedEdges.length > 0 ? (
                mappedEdges.map((edge, index) => (
                  <div key={`${edge.source}-${edge.target}-${index}`} className="p-4 rounded border border-border/50 bg-black/20 font-mono text-xs">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-foreground mb-1">
                          <span className="text-blue-400">{edge.source}</span>
                          <span className="text-muted-foreground mx-2">→</span>
                          <span className="text-blue-400">{edge.target}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {edge.type} | Weight: {edge.weight.toFixed(2)} | {edge.timestamp}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-6 w-12 bg-gradient-to-r from-primary/20 to-primary/50 rounded flex items-center justify-center">
                          <span className="text-primary font-bold">{Math.round(edge.weight * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground font-mono">
                  No active traffic edges detected in topology.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm text-muted-foreground">
            <div className="p-3 rounded bg-red-500/5 border border-red-500/20 text-red-300">
              <div className="font-bold mb-1">CRITICAL: {leadStage?.stage ?? "Reconnaissance"} is the lead stage</div>
              {leadStage?.description ?? "Stage signal unavailable."} Target: {primaryNode ? (primaryNode.label || primaryNode.ip) : "unknown node"}.
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20 text-yellow-300">
              <div className="font-bold mb-1">WARNING: Hostile Activity Ratio</div>
              {Math.round(maliciousShare * 100)}% of recent network events are classified as suspicious or malicious by the GNN.
            </div>
            <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20 text-blue-300">
              <div className="font-bold mb-1">INFO: Modeling Confidence</div>
              The live dataset is evaluated at {latestPrediction ? Math.round(latestPrediction.confidence * 100) : 0}% confidence score.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
