import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Eye, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildLiveExplanation, useLiveDatasetFeed } from "@/lib/liveDataset";

export default function Explainability() {
  const liveFeed = useLiveDatasetFeed();
  const explanation = buildLiveExplanation(liveFeed);

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Model Explainability</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Model Explainability</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Attention and explanation panels now listen to the live replay dataset, so analysts can
            see which entities matter most in the current stream rather than in a fixed demo snapshot.
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
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liveFeed.explainabilityWeights.map((weight) => ({ name: weight.entity.slice(0, 16), weight: Math.round(weight.weight * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#666" />
                  <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Bar dataKey="weight" fill="hsl(190, 90%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
            {liveFeed.explainabilityWeights.map((entity) => (
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
            ))}
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
                  {liveFeed.riskNodes.slice(0, 4).map((node) => (
                    <div key={node.node} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{node.node}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-black/30 rounded border border-primary/30">
                <div className="text-xs text-muted-foreground mb-2">EDGES IN CRITICAL SUBGRAPH</div>
                <div className="space-y-2 font-mono text-sm">
                  {liveFeed.edges.slice(0, 4).map((edge) => (
                    <div key={`${edge.source}-${edge.target}-${edge.type}`} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{edge.type} ({edge.weight.toFixed(2)})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
