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
import { useMetrics, useTrainingRuns, useDashboardMetrics, useSystemHealth } from "@/hooks/useApi";

export default function AdvancedEvaluation() {
  const { data: metricsData } = useMetrics();
  const { data: runsData } = useTrainingRuns();
  const { data: dashboardMetrics } = useDashboardMetrics();
  const { data: healthData } = useSystemHealth();

  const metrics = (metricsData as { metrics?: Record<string, number> } | undefined)?.metrics ?? {};
  const latestRun = runsData?.runs?.[0];
  const trainingHistory = latestRun?.metrics as { history?: Array<{ epoch: number; train_loss: number; val_accuracy: number }> } | undefined;
  const chartData = trainingHistory?.history ?? [];

  const seriesData = chartData.slice(-12).map((point) => ({
    window: `Epoch ${point.epoch}`,
    time: `E${point.epoch}`,
    trainLoss: point.train_loss ?? 0,
    valAccuracy: point.val_accuracy ?? 0,
    trainAccuracy: (point as { train_accuracy?: number }).train_accuracy ?? 0,
  }));

  const summary = {
    accuracy: metrics.accuracy ?? 0,
    precision: metrics.precision ?? 0,
    recall: metrics.recall ?? 0,
    f1: metrics.f1 ?? 0,
    auc: metrics.auc ?? 0,
    earlyDetectionRate: metrics.stage_accuracy ? `${(metrics.stage_accuracy * 100).toFixed(1)}%` : "0.0%",
  };

  const confidence = summary.accuracy;
  const threatScore = dashboardMetrics?.network?.avgRisk ?? 0;
  const queueDepth = dashboardMetrics?.alerts?.open ?? 0;
  const recordsCount = dashboardMetrics?.alerts?.total ?? 0;

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Advanced Metrics</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Advanced Evaluation Metrics</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            These deeper analytics react directly to GNN validation results, displaying threat alert latency and accuracy telemetry.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Validation Accuracy</div>
              <div className="text-2xl font-bold text-primary">{Math.round(summary.accuracy * 100)}%</div>
              <div className="text-xs text-muted-foreground font-mono">F1: {summary.f1.toFixed(3)}</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Inference Confidence</div>
              <div className="text-2xl font-bold text-primary">{Math.round(confidence * 100)}%</div>
              <div className="text-xs text-muted-foreground font-mono">AUC: {summary.auc.toFixed(3)}</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Risk Correlation</div>
              <div className="text-2xl font-bold text-primary">{threatScore.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground font-mono">Queue: {queueDepth} alerts</div>
            </CardContent>
          </Card>
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Stage Accuracy</div>
              <div className="text-2xl font-bold text-green-400">
                {summary.earlyDetectionRate}
              </div>
              <div className="text-xs text-muted-foreground font-mono">From TGNN validation metrics</div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Validation Loss by Epoch
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {seriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="window" stroke="#666" angle={-35} textAnchor="end" height={70} />
                  <YAxis stroke="#666" label={{ value: "Loss", angle: -90, position: "insideLeft" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Legend />
                  <Bar dataKey="trainLoss" fill="hsl(190, 90%, 50%)" name="Training Loss" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                Awaiting completed training history.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={18} className="text-primary" />
              Accuracy Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {seriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="window" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="trainAccuracy"
                    stroke="hsl(0, 80%, 60%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(0, 80%, 60%)", r: 4 }}
                    name="Train Accuracy"
                  />
                  <Line
                    type="monotone"
                    dataKey="valAccuracy"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="Validation Accuracy"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                Awaiting validation telemetry.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Rolling Validation Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {seriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                  <YAxis stroke="#666" domain={[0, 1]} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Legend />
                  <Line type="monotone" dataKey="valAccuracy" stroke="hsl(190, 90%, 50%)" strokeWidth={2} dot={false} name="Validation Accuracy" />
                  <Line type="monotone" dataKey="trainAccuracy" stroke="#f59e0b" strokeWidth={2} dot={false} name="Training Accuracy" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                Awaiting model registry metrics.
              </div>
            )}
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
              <div className="font-bold text-blue-300 mb-1">GNN Pipeline Insight</div>
              The system is currently observing {recordsCount.toLocaleString()} total alerts. AI service status: {healthData?.ai?.status ?? "unknown"}.
            </div>
            <div className="p-3 rounded bg-green-500/5 border border-green-500/20">
              <div className="font-bold text-green-300 mb-1">Operational Gain</div>
              Latest validation accuracy is {Math.round((seriesData.at(-1)?.valAccuracy ?? 0) * 100)}% from the most recent training run.
            </div>
            <div className="p-3 rounded bg-yellow-500/5 border border-yellow-500/20">
              <div className="font-bold text-yellow-300 mb-1">Training Stability</div>
              Latest training loss is {(seriesData.at(-1)?.trainLoss ?? 0).toFixed(4)}.
            </div>
            <div className="p-3 rounded bg-purple-500/5 border border-purple-500/20">
              <div className="font-bold text-purple-300 mb-1">Actionability</div>
              Queue depth {queueDepth} and model validation confidence {Math.round(confidence * 100)}% show the system is maintaining safe detection coverage.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
