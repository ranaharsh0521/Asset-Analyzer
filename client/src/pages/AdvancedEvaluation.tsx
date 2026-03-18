import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EARLY_DETECTION_METRICS, MULTITASK_RESULTS } from "@/lib/advancedMockData";
import { Zap, BarChart3, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function AdvancedEvaluation() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Advanced Evaluation Metrics</h1>
          <p className="text-muted-foreground font-mono text-sm">SOC-Level Performance Analysis & Early Detection Gains</p>
        </div>

        {/* Multi-Task Learning Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Node Classification</div>
              <div className="text-2xl font-bold text-primary">{Math.round(MULTITASK_RESULTS.nodeClassification.accuracy * 100)}%</div>
              <div className="text-xs text-muted-foreground">F1: {MULTITASK_RESULTS.nodeClassification.f1}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Stage Classification</div>
              <div className="text-2xl font-bold text-primary">{Math.round(MULTITASK_RESULTS.stageClassification.accuracy * 100)}%</div>
              <div className="text-xs text-muted-foreground">F1: {MULTITASK_RESULTS.stageClassification.f1}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Risk Correlation</div>
              <div className="text-2xl font-bold text-primary">{MULTITASK_RESULTS.riskScoring.correlation}</div>
              <div className="text-xs text-muted-foreground">MSE: {MULTITASK_RESULTS.riskScoring.mse}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Early Detection Gain</div>
              <div className="text-2xl font-bold text-green-400">{MULTITASK_RESULTS.earlyDetection.avgTimeGain}</div>
              <div className="text-xs text-muted-foreground">Success: {Math.round(MULTITASK_RESULTS.earlyDetection.successRate * 100)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Early Detection Time Comparison */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Early Detection Time Gains (Minutes Before Attack Escalation)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EARLY_DETECTION_METRICS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="approach" stroke="#666" angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#666" label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                <Legend />
                <Bar dataKey="avgDetectionTime" fill="hsl(190, 90%, 50%)" name="Avg Detection Time" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* False Positive Reduction */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={18} className="text-primary" />
              Alert Fatigue Reduction: False Positives Per Week
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={EARLY_DETECTION_METRICS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="approach" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="falsePositives" 
                  stroke="hsl(0, 80%, 60%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(0, 80%, 60%)', r: 5 }}
                  name="False Positives"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Early Warning Count */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Early Warning Capabilities (Predictions per week with &gt;80% confidence)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {EARLY_DETECTION_METRICS.map((metric, i) => (
                <div key={i} className="p-4 rounded border border-border/50 bg-black/20">
                  <div className="font-mono font-bold text-foreground mb-3">{metric.approach}</div>
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Early Warnings</div>
                      <div className="text-3xl font-bold text-primary">{metric.earlyWarnings}</div>
                      <div className="text-xs text-muted-foreground mt-1">predictions/week</div>
                    </div>
                    <div className="flex-1 h-16 bg-gradient-to-t from-primary/30 to-primary/5 rounded flex items-end justify-center">
                      <div 
                        className="w-8 bg-primary rounded-t"
                        style={{height: `${(metric.earlyWarnings / 60) * 100}%`}}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SOC Metrics Summary */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle>Why Early Detection Matters More Than Raw Accuracy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-sm text-muted-foreground">
            <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20">
              <div className="font-bold text-blue-300 mb-1">📊 METRIC INSIGHT 1: Dwell Time Reduction</div>
              Average attacker dwell time: 207 days. Early detection with TGN reduces this to &lt;2 hours, preventing lateral movement.
            </div>
            <div className="p-3 rounded bg-green-500/5 border border-green-500/20">
              <div className="font-bold text-green-300 mb-1">✓ METRIC INSIGHT 2: Cost Savings</div>
              Each successful early detection saves $1.5M in breach costs (data loss, downtime, remediation).
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20">
              <div className="font-bold text-yellow-300 mb-1">⚠ METRIC INSIGHT 3: Alert Fatigue</div>
              Reducing false positives from 234/week to 12/week improves SOC mean-time-to-respond from 6hrs to 15min.
            </div>
            <div className="p-3 rounded bg-purple-500/5 border border-purple-500/20">
              <div className="font-bold text-purple-300 mb-1">🎯 METRIC INSIGHT 4: Actionability</div>
              TGN provides attack stage prediction, enabling targeted containment instead of panic-based isolation.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
