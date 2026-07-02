import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Shield } from "lucide-react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { useLiveDatasetFeed } from "@/lib/liveDataset";

export default function RiskAssessment() {
  const liveFeed = useLiveDatasetFeed();
  const sortedRisks = [...liveFeed.riskNodes].sort((left, right) => right.risk - left.risk);

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Risk Intelligence</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Network Risk Radar</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Risk scoring now updates from the live replay dataset, so the most exposed entities below
            track the current stream instead of a one-time static snapshot.
          </p>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-primary" />
              Network Nodes Risk Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedRisks.map((node) => {
                const riskColor = node.risk > 0.85 ? "bg-red-500/10 border-red-500/50" :
                  node.risk > 0.7 ? "bg-yellow-500/10 border-yellow-500/50" :
                    node.risk > 0.5 ? "bg-orange-500/10 border-orange-500/50" :
                      "bg-green-500/10 border-green-500/50";

                const textColor = node.risk > 0.85 ? "text-red-400" :
                  node.risk > 0.7 ? "text-yellow-400" :
                    node.risk > 0.5 ? "text-orange-400" :
                      "text-green-400";

                return (
                  <div key={node.node} className={`p-4 rounded-2xl border ${riskColor}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-mono font-bold text-foreground mb-1">{node.node}</div>
                        <div className="text-xs text-muted-foreground">Anomalies: {node.anomalies} | Alerts: {node.alerts}</div>
                      </div>
                      <div className={`text-2xl font-bold font-mono ${textColor}`}>{Math.round(node.risk * 100)}%</div>
                    </div>
                    <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          node.risk > 0.85 ? "bg-red-500" :
                          node.risk > 0.7 ? "bg-yellow-500" :
                          node.risk > 0.5 ? "bg-orange-500" :
                          "bg-green-500"
                        }`}
                        style={{ width: `${node.risk * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Risk Score vs Anomaly Count
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="anomalies" stroke="#666" label={{ value: "Anomaly Count", position: "bottom", offset: 40 }} />
                <YAxis dataKey="risk" stroke="#666" label={{ value: "Risk Score", angle: -90, position: "insideLeft" }} domain={[0, 1]} />
                <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="Nodes" data={sortedRisks} fill="hsl(190, 90%, 50%)" shape="circle" isAnimationActive={true} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              SOC Action Items - Prioritized by Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedRisks.slice(0, 4).map((node, index) => (
              <div key={node.node} className="panel-subtle p-4 font-mono text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-foreground font-bold">{index + 1}. {node.node}</span>
                  <span className="text-primary font-bold">{Math.round(node.risk * 100)}% Risk</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {node.alerts} active alerts | {node.anomalies} anomalies detected
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-bold">HIGH PRIORITY</span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">Needs Immediate Investigation</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
