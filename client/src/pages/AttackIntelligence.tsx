import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTACK_STAGES, HETEROGENEOUS_EDGES } from "@/lib/advancedMockData";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AttackIntelligence() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Attack Stage Classification</h1>
          <p className="text-muted-foreground font-mono text-sm">Multi-task Learning: Predict Attack Progression Stages</p>
        </div>

        {/* Attack Stage Chain */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Predicted Attack Progression Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start gap-2 mb-6">
              {ATTACK_STAGES.map((stage, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`relative mb-3 p-3 rounded border ${
                    stage.probability > 0.8 ? "bg-red-500/10 border-red-500/50" :
                    stage.probability > 0.5 ? "bg-yellow-500/10 border-yellow-500/50" :
                    "bg-green-500/10 border-green-500/50"
                  }`}>
                    <div className="text-lg font-bold text-primary mb-1">{Math.round(stage.probability*100)}%</div>
                    <div className="text-xs font-mono text-muted-foreground">{stage.stage}</div>
                    
                    {i < ATTACK_STAGES.length - 1 && (
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2">
                        <div className="w-8 h-0.5 bg-gradient-to-r from-yellow-500 to-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {stage.entities.join(", ")}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Attack Chain Timeline */}
            <div className="mt-8 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ATTACK_STAGES.map((s, i) => ({ name: s.stage.slice(0,4), risk: Math.round(s.probability*100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Line type="monotone" dataKey="risk" stroke="hsl(190, 90%, 50%)" strokeWidth={3} dot={{ fill: 'hsl(190, 90%, 50%)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Heterogeneous Edge Details */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Attack Path: Heterogeneous Edge Sequence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {HETEROGENEOUS_EDGES.map((edge, i) => (
                <div key={i} className="p-4 rounded border border-border/50 bg-black/20 font-mono text-xs">
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
                        <span className="text-primary font-bold">{Math.round(edge.weight*100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Key Intelligence Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm text-muted-foreground">
            <div className="p-3 rounded bg-red-500/5 border border-red-500/20 text-red-300">
              <div className="font-bold mb-1">CRITICAL: Attack likely in Reconnaissance Phase</div>
              Attacker IP 192.168.1.50 performing systematic port scanning across internal network.
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20 text-yellow-300">
              <div className="font-bold mb-1">WARNING: High-Risk User Targeted</div>
              Admin user (user-bob) is primary target for lateral movement exploitation.
            </div>
            <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20 text-blue-300">
              <div className="font-bold mb-1">INFO: Multi-Stage Attack Pattern Detected</div>
              Temporal sequence matches known APT TTPs (Tactics, Techniques, Procedures).
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
