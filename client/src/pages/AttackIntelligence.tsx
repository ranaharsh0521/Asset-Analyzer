import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLiveDatasetFeed } from "@/lib/liveDataset";

export default function AttackIntelligence() {
  const liveFeed = useLiveDatasetFeed();
  const leadStage = liveFeed.attackStages[0];
  const primaryNode = liveFeed.riskNodes[0];

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Threat Journey</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Threat Journey Intelligence</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Attack progression is now estimated directly from the live replay dataset, so the storyline
            below tracks the same telemetry pulse driving Model Studio and Mission Control.
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
            <div className="flex justify-between items-start gap-2 mb-6">
              {liveFeed.attackStages.map((stage, index) => (
                <div key={stage.stage} className="flex-1 text-center">
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

                    {index < liveFeed.attackStages.length - 1 && (
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2">
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
                <LineChart data={liveFeed.attackStages.map((stage) => ({ name: stage.stage.slice(0, 4), risk: Math.round(stage.probability * 100) }))}>
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
              {liveFeed.edges.map((edge) => (
                <div key={`${edge.source}-${edge.target}-${edge.timestamp}`} className="p-4 rounded border border-border/50 bg-black/20 font-mono text-xs">
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
              ))}
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
              {leadStage?.description ?? "Stage signal unavailable"} Primary target: {primaryNode?.node ?? "unknown node"}.
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20 text-yellow-300">
              <div className="font-bold mb-1">WARNING: Live replay shows sustained hostile share</div>
              {Math.round(liveFeed.current.maliciousShare * 100)}% of current records are classified as malicious or suspicious.
            </div>
            <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20 text-blue-300">
              <div className="font-bold mb-1">INFO: Attack graph remains multi-stage</div>
              The live dataset is still surfacing transitions across {liveFeed.attackStages.length} modeled attack phases.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
