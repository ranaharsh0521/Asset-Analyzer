import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BarChart3, TrendingDown, Gauge } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLiveDatasetFeed } from "@/lib/liveDataset";

export default function AdvancedEvaluation() {
  const liveFeed = useLiveDatasetFeed();
  const earlyDetectionSeries = liveFeed.trainingTimeline.slice(-8).map((point) => ({
    window: point.time,
    avgDetectionTime: Math.max(4, Math.round(28 - point.auc * 18)),
    falsePositives: Math.max(8, Math.round((1 - point.precision) * 120)),
    earlyWarnings: Math.round(point.recall * 52),
  }));

  const summary = liveFeed.evaluationSummary;

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Advanced Metrics</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Advanced Evaluation Metrics</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            These deeper analytics now react to the live replay dataset, surfacing how quickly the
            model can issue warnings as the stream pressure rises or stabilizes.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Live Accuracy</div>
              <div className="text-2xl font-bold text-primary">{Math.round(summary.accuracy * 100)}%</div>
              <div className="text-xs text-muted-foreground">F1: {summary.f1}</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Detection Confidence</div>
              <div className="text-2xl font-bold text-primary">{Math.round(liveFeed.current.confidence * 100)}%</div>
              <div className="text-xs text-muted-foreground">AUC: {summary.auc}</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Risk Correlation</div>
              <div className="text-2xl font-bold text-primary">{(liveFeed.current.threatScore * 0.93).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Queue: {liveFeed.current.queueDepth}</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Early Detection Gain</div>
              <div className="text-2xl font-bold text-green-400">
                {Math.max(8, Math.round(34 - liveFeed.current.latencyMs / 3))} min
              </div>
              <div className="text-xs text-muted-foreground">Success: {summary.earlyDetectionRate}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Early Detection Time Gains
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earlyDetectionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="window" stroke="#666" angle={-35} textAnchor="end" height={70} />
                <YAxis stroke="#666" label={{ value: "Minutes", angle: -90, position: "insideLeft" }} />
                <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                <Legend />
                <Bar dataKey="avgDetectionTime" fill="hsl(190, 90%, 50%)" name="Avg Detection Time" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={18} className="text-primary" />
              Alert Fatigue Reduction
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earlyDetectionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="window" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="falsePositives"
                  stroke="hsl(0, 80%, 60%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(0, 80%, 60%)", r: 4 }}
                  name="False Positives"
                />
                <Line
                  type="monotone"
                  dataKey="earlyWarnings"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Early Warnings"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Rolling Live Replay Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liveFeed.trainingTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                <YAxis stroke="#666" domain={[0, 1]} />
                <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                <Legend />
                <Line type="monotone" dataKey="auc" stroke="hsl(190, 90%, 50%)" strokeWidth={2} dot={false} name="AUC" />
                <Line type="monotone" dataKey="precision" stroke="#f59e0b" strokeWidth={2} dot={false} name="Precision" />
                <Line type="monotone" dataKey="recall" stroke="#22c55e" strokeWidth={2} dot={false} name="Recall" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge size={18} className="text-primary" />
              SOC Metric Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-sm text-muted-foreground">
            <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20">
              <div className="font-bold text-blue-300 mb-1">Live Window Insight</div>
              The replay is currently processing {liveFeed.current.recordsPerSecond.toLocaleString()} records per second at {liveFeed.current.latencyMs} ms latency.
            </div>
            <div className="p-3 rounded bg-green-500/5 border border-green-500/20">
              <div className="font-bold text-green-300 mb-1">Operational Gain</div>
              Early warning capacity is holding at roughly {earlyDetectionSeries.at(-1)?.earlyWarnings ?? 0} actionable warnings per evaluation window.
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20">
              <div className="font-bold text-yellow-300 mb-1">Alert Fatigue Control</div>
              False positives are trending around {earlyDetectionSeries.at(-1)?.falsePositives ?? 0} per window as the stream conditions change.
            </div>
            <div className="p-3 rounded bg-purple-500/5 border border-purple-500/20">
              <div className="font-bold text-purple-300 mb-1">Actionability</div>
              Queue depth {liveFeed.current.queueDepth} and confidence {Math.round(liveFeed.current.confidence * 100)}% show the model is still keeping pace with the live replay.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
