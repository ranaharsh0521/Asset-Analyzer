import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
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
import { Download, Share2, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMetrics, usePredictions, useTrainingRuns } from "@/hooks/useApi";

export default function Evaluation() {
  const { toast } = useToast();
  const { data: metricsData, isLoading, error, refetch } = useMetrics();
  const { data: runsData } = useTrainingRuns();
  const { data: predictionsData } = usePredictions();
  const metrics = (metricsData as { metrics?: Record<string, number> } | undefined)?.metrics ?? {};
  const latestRun = runsData?.runs?.[0];
  const trainingHistory = latestRun?.metrics as { history?: Array<{ epoch: number; train_loss: number; val_accuracy: number }> } | undefined;
  const predictions = predictionsData?.predictions ?? [];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link copied", description: "Report URL copied to clipboard." });
    }).catch(() => {
      toast({ title: "Share", description: "Copy this URL: " + window.location.href });
    });
  };

  const handleExportPDF = () => {
    toast({ title: "Exporting PDF...", description: "Opening print dialog. Choose Save as PDF.", duration: 3000 });
    setTimeout(() => window.print(), 500);
  };

  const evalMetrics = {
    accuracy: metrics.accuracy ?? 0,
    precision: metrics.precision ?? 0,
    recall: metrics.recall ?? 0,
    f1: metrics.f1 ?? 0,
    auc: metrics.auc ?? 0,
    earlyDetectionRate: metrics.stage_accuracy ? `${(metrics.stage_accuracy * 100).toFixed(1)}%` : "N/A",
  };

  const trainingTimeline = (trainingHistory?.history ?? []).slice(-24).map((point) => ({
    time: `E${point.epoch}`,
    trainLoss: point.train_loss,
    confidence: point.val_accuracy,
    benignRecords: 0,
    maliciousRecords: 0,
  }));
  const predictionTimeline = predictions.slice().reverse().slice(-24).map((prediction) => {
    const benign = prediction.threatLevel === "low" || prediction.threatLevel === "info";
    return {
      time: new Date(prediction.createdAt).toLocaleTimeString("en-US", { hour12: false }),
      confidence: prediction.confidence,
      benignRecords: benign ? 1 : 0,
      maliciousRecords: benign ? 0 : 1,
    };
  });
  const timelineChart = trainingTimeline.length > 0 ? trainingTimeline : predictionTimeline;
  const rocData: Array<{ fpr: number; tpr: number }> = [];
  const confusionBins = ((metricsData as { metrics?: { confusion_matrix?: { attack?: number[] } } } | undefined)?.metrics?.confusion_matrix?.attack) ?? [];



  if (error) {
    return (
      <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="panel-card p-6">
            <div className="text-destructive font-bold mb-2">Failed to load evaluation metrics</div>
            <div className="text-sm text-muted-foreground font-mono mb-4">{error instanceof Error ? error.message : String(error)}</div>
            <Button onClick={() => refetch()} variant="default">Retry</Button>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground font-mono">Loading evaluation metrics...</span>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="page-kicker">Performance Intelligence</div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Model Performance Hub</h1>
            <p className="text-muted-foreground font-mono text-sm max-w-2xl">
              Live replay telemetry now feeds the performance window here, so the evaluation cards
              and live-stream charts update as the new dataset moves through the system.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}>
              <Share2 size={14} /> Share Report
            </Button>
            <Button variant="default" size="sm" className="gap-2 bg-primary text-primary-foreground" onClick={handleExportPDF}>
              <Download size={14} /> Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(evalMetrics).map(([key, value]) => (
            <Card key={key} className="metric-surface rounded-[1.35rem] border-primary/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="text-2xl font-mono font-bold text-primary">
                  {typeof value === "number" ? value.toFixed(3) : value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="panel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RadioTower size={18} className="text-primary" />
                Live Replay Throughput and Confidence
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {timelineChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineChart}>
                    <defs>
                      <linearGradient id="evalRecordsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(186 95% 55%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(186 95% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                    <Legend />
                    <Area type="monotone" dataKey="trainLoss" stroke="hsl(186 95% 55%)" fill="url(#evalRecordsFill)" strokeWidth={2} name="Training Loss" />
                    <Line type="monotone" dataKey="confidence" stroke="#22c55e" strokeWidth={2} dot={false} name="Confidence" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                  Training and prediction time series are not available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader>
              <CardTitle>Live Traffic Class Mix</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {timelineChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                    <Legend />
                    <Line type="monotone" dataKey="benignRecords" stroke="#22c55e" strokeWidth={2} dot={false} name="Benign" />
                    <Line type="monotone" dataKey="maliciousRecords" stroke="#ef4444" strokeWidth={2} dot={false} name="Malicious" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                  Timeline series not available from backend metrics endpoint.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="panel-card">
            <CardHeader>
              <CardTitle>ROC Curve Analysis</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {rocData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rocData}>
                    <defs>
                      <linearGradient id="colorTpr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="fpr" stroke="#666" label={{ value: "False Positive Rate", position: "insideBottom", offset: -5 }} />
                    <YAxis stroke="#666" label={{ value: "True Positive Rate", angle: -90, position: "insideLeft" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                    <Area type="monotone" dataKey="tpr" stroke="hsl(190, 90%, 50%)" fillOpacity={1} fill="url(#colorTpr)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                  ROC points not available from backend metrics endpoint.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader>
              <CardTitle>Baseline Comparison</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: "TGNN", accuracy: metrics.accuracy ?? 0, f1: metrics.f1 ?? 0 }]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" domain={[0, 1]} stroke="#666" />
                  <YAxis dataKey="name" type="category" width={110} stroke="#999" tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Accuracy" />
                  <Bar dataKey="f1" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} name="F1 Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>Live Window Confusion Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              <div className="space-y-4">
                <div className="h-24 bg-green-500/20 border border-green-500/50 rounded flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-green-400">{"—"}</span>
                  <span className="text-xs text-muted-foreground uppercase">True Negatives</span>
                </div>
                <div className="h-24 bg-red-500/10 border border-red-500/30 rounded flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-red-300">{"—"}</span>
                  <span className="text-xs text-muted-foreground uppercase">False Negatives</span>
                </div>
              </div>
              <div className="space-y-4 pt-12">
                <div className="h-24 bg-yellow-500/10 border border-yellow-500/30 rounded flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-yellow-300">{"—"}</span>
                  <span className="text-xs text-muted-foreground uppercase">False Positives</span>
                </div>
                <div className="h-24 bg-primary/20 border border-primary/50 rounded flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{"—"}</span>
                  <span className="text-xs text-muted-foreground uppercase">True Positives</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
