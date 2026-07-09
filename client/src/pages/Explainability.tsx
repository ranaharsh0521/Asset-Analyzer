import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Eye, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePredictions, useTopology } from "@/hooks/useApi";

function buildRealExplanation(latestPrediction: any, topology: any, importantNodes: any[]) {
  if (!latestPrediction) return "No live predictions available. Trigger model studio training or submit feature inputs for real-time GNN analysis.";

  const topWeight = importantNodes[0];
  const primaryNode = topology?.nodes?.find((n: any) => n.id === latestPrediction.targetNodeId) || topology?.nodes?.[0];

  return `
ALERT REASONING for Entity: ${topWeight?.entity ?? primaryNode?.label ?? "Unknown entity"}

PREDICTED RISK: ${latestPrediction.riskScore.toFixed(2)} (${latestPrediction.threatLevel.toUpperCase()})

LAST UPDATE: ${new Date(latestPrediction.createdAt).toLocaleString()}

KEY CONTRIBUTING FACTORS:
1. Attention Score: ${topWeight ? topWeight.weight.toFixed(2) : "0.00"} - GNN GAT Layer attention highlight
   - Entity Identifier: ${topWeight?.entity ?? "Unknown"}
   - Role / Status: ${topWeight?.role ?? "Active"}

2. Attack Stage Progression: ${latestPrediction.attackStage.toUpperCase()} -> ${latestPrediction.predictedNextStage || "unknown"}
   - Stage Confidence: ${Math.round(latestPrediction.confidence * 100)}%
   - Probability Score: ${Math.round(latestPrediction.probability * 100)}%

3. Streaming Telemetry Pressure
   - Threat Level: ${latestPrediction.threatLevel}
   - Compromise Indicator: ${latestPrediction.isCompromised ? "Compromised" : "Suspicious"}

RECOMMENDED SOC ACTION:
- Investigate target asset immediately
- Isolate suspicious connections linked to ${topWeight?.entity ?? "primary target"}
- Block ports involved in ${latestPrediction.attackType} attack signature
`.trim();
}

export default function Explainability() {
  const { data: predictionsData } = usePredictions();
  const { data: topology } = useTopology();

  const predictions = predictionsData?.predictions ?? [];
  const latestPrediction = predictions[0];

  const explanationNodes = (latestPrediction?.explanation?.node_importance as Array<{
    node_index: number;
    importance: number;
    type: string;
  }>) ?? [];

  const importantNodes = explanationNodes.map((item) => {
    const topologyNode = topology?.nodes?.[item.node_index];
    return {
      entity: topologyNode?.label || topologyNode?.ip || `Node #${item.node_index}`,
      weight: item.importance,
      type: topologyNode?.type || "IP address",
      role: topologyNode?.status || "Active Host",
    };
  }).sort((a, b) => b.weight - a.weight);

  const explanation = buildRealExplanation(latestPrediction, topology, importantNodes);

  const chartData = importantNodes.map((node) => ({
    name: node.entity.slice(0, 16),
    weight: Math.round(node.weight * 100),
  }));

  const criticalNodes = topology?.nodes?.slice(0, 4) ?? [];
  const criticalEdges = topology?.edges?.slice(0, 4) ?? [];

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Model Explainability</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Model Explainability</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Attention and explanation panels listen to GNN prediction details, showing which nodes
            contributed most heavily to the latest classification decisions.
          </p>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              Attention Weight Distribution: Important Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                    <Bar dataKey="weight" fill="hsl(190, 90%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-12 text-center text-sm font-mono text-muted-foreground border rounded-lg border-dashed">
                Awaiting model predictions to construct attention weights.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain size={18} className="text-primary" />
              Entity Importance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {importantNodes.length > 0 ? (
              importantNodes.map((entity) => (
                <div key={entity.entity} className="space-y-1">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-foreground">{entity.entity}</div>
                      <div className="text-xs text-muted-foreground">Type: {entity.type} | Role: {entity.role}</div>
                    </div>
                    <div className="text-lg font-bold text-primary">{Math.round(entity.weight * 100)}%</div>
                  </div>
                  <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/50 to-primary h-full transition-all" style={{ width: `${entity.weight * 100}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs font-mono text-muted-foreground">
                No GNN attention embeddings currently loaded.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Alert Reasoning for SOC Investigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black/50 p-6 rounded-lg border border-border/50 font-mono text-sm text-foreground whitespace-pre-wrap max-h-96 overflow-auto">
              {explanation}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>Live Subgraph Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/30 rounded border border-primary/30">
                <div className="text-xs text-muted-foreground mb-2">NODES IN CRITICAL SUBGRAPH</div>
                <div className="space-y-2 font-mono text-sm">
                  {criticalNodes.length > 0 ? (
                    criticalNodes.map((node) => (
                      <div key={node.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span>{node.label || node.ip}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground text-xs">No nodes in topology.</div>
                  )}
                </div>
              </div>
              <div className="p-4 bg-black/30 rounded border border-primary/30">
                <div className="text-xs text-muted-foreground mb-2">EDGES IN CRITICAL SUBGRAPH</div>
                <div className="space-y-2 font-mono text-sm">
                  {criticalEdges.length > 0 ? (
                    criticalEdges.map((edge, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span>{edge.protocol.toUpperCase()} ({edge.weight.toFixed(2)})</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground text-xs">No edges in topology.</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
