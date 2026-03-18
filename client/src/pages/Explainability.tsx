import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENTION_WEIGHTS, EXPLAINABILITY_EXPLANATION } from "@/lib/advancedMockData";
import { Brain, Eye, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Explainability() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Model Explainability</h1>
          <p className="text-muted-foreground font-mono text-sm">Attention Mechanism & Decision Transparency for SOC Teams</p>
        </div>

        {/* Attention Weights Visualization */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              Attention Weight Distribution: Important Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ATTENTION_WEIGHTS.map(w => ({ name: w.entity.slice(0,15), weight: Math.round(w.weight*100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#666" />
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="weight" fill="hsl(190, 90%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Entity Importance Breakdown */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain size={18} className="text-primary" />
              Entity Importance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ATTENTION_WEIGHTS.map((entity, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-mono text-sm font-bold text-foreground">{entity.entity}</div>
                    <div className="text-xs text-muted-foreground">Type: {entity.type} | Role: {entity.role}</div>
                  </div>
                  <div className="text-lg font-bold text-primary">{Math.round(entity.weight*100)}%</div>
                </div>
                <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary/50 to-primary h-full transition-all" 
                    style={{width: `${entity.weight*100}%`}}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SOC-Readable Alert Explanation */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Alert Reasoning for SOC Investigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black/50 p-6 rounded-lg border border-border/50 font-mono text-sm text-foreground whitespace-pre-wrap max-h-96 overflow-auto">
              {EXPLAINABILITY_EXPLANATION}
            </div>
          </CardContent>
        </Card>

        {/* Subgraph Explanation */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle>Subgraph Responsible for Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/30 rounded border border-primary/30">
                <div className="text-xs text-muted-foreground mb-2">NODES IN CRITICAL SUBGRAPH</div>
                <div className="space-y-2 font-mono text-sm">
                  {["192.168.1.50 (Attacker)", "user-bob (Target)", "10.0.0.5 (Server)", "process-cmd.exe"].map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{node}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-black/30 rounded border border-primary/30">
                <div className="text-xs text-muted-foreground mb-2">EDGES IN CRITICAL SUBGRAPH</div>
                <div className="space-y-2 font-mono text-sm">
                  {["NetworkFlow (0.87)", "LoginAttempt (0.65)", "ProcessSpawn (0.92)", "FileAccess (0.71)"].map((edge, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{edge}</span>
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
