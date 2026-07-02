import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Play, RotateCcw, Save, Database, BrainCircuit, Activity, Wifi, Gauge } from "lucide-react";
import { TrainingTerminal, type LogEntry } from "@/components/viz/TrainingTerminal";
import { useToast } from "@/hooks/use-toast";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStartTraining, useTrainingRuns } from "@/hooks/useApi";

const DATASET_MAP: Record<string, string> = {
  ton_iot_live: "ton_iot",
  cicids2017: "cicids2017",
  unsw: "unsw_nb15",
  darpa: "nsl_kdd",
};

const LIVE_DATASET_ID = "unsw";
const DATASET_OPTIONS = [
  { id: "unsw", label: "UNSW-NB15", mode: "batch" as const, description: "Real intrusion detection benchmark", source: "UNSW Canberra" },
  { id: "ton_iot_live", label: "TON-IoT", mode: "live" as const, description: "IoT/IIoT telemetry dataset", source: "UNSW CERT" },
  { id: "cicids2017", label: "CICIDS2017", mode: "batch" as const, description: "Enterprise network flows", source: "Canadian Institute" },
  { id: "darpa", label: "NSL-KDD", mode: "batch" as const, description: "Classic KDD cup dataset", source: "NSL-KDD" },
];

function getDatasetOption(id: string) {
  return DATASET_OPTIONS.find((o) => o.id === id) ?? DATASET_OPTIONS[0];
}

function sliderToLR(val: number): string {
  return (0.0001 * Math.pow(100, val / 100)).toFixed(4);
}

function sliderToHiddenDim(val: number): number {
  const dims = [32, 64, 128, 256, 512];
  return dims[Math.round((val / 100) * (dims.length - 1))];
}

export default function Experiment() {
  const { toast } = useToast();
  const startTrainingMutation = useStartTraining();
  const { data: runsData } = useTrainingRuns();
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lrSlider, setLrSlider] = useState(30);
  const [hiddenSlider, setHiddenSlider] = useState(60);
  const [selectedDataset, setSelectedDataset] = useState("unsw");
  const [graphStrategy, setGraphStrategy] = useState<"static" | "temporal">("temporal");
  const [modelVariant, setModelVariant] = useState<"gcn" | "gat" | "graphsage" | "tgn">("tgn");

  const latestRun = runsData?.runs?.[0];
  const trainingHistory = latestRun?.metrics as { history?: Array<{ epoch: number; train_loss: number; val_accuracy: number }> } | undefined;
  const chartData = trainingHistory?.history ?? [];
  const feedSnapshot = {
    current: { recordsPerSecond: 0, throughputMbps: 0, anomalyRate: 0, alertsPerMinute: 0, confidence: latestRun?.valAccuracy ?? 0, latencyMs: 12, queueDepth: 0, maliciousShare: 0, droppedPackets: 0, threatScore: 0, benignRecords: 0, maliciousRecords: 0 },
    timeline: chartData.map((h) => ({ time: `E${h.epoch}`, recordsPerSecond: h.train_loss * 1000, anomalyRate: h.val_accuracy * 100, threatScore: h.val_accuracy, benignRecords: 0, maliciousRecords: 0 })),
    trainingTimeline: chartData.map((h) => ({ time: `E${h.epoch}`, loss: h.train_loss, auc: h.val_accuracy, precision: h.val_accuracy, recall: h.val_accuracy })),
    lastUpdated: latestRun?.createdAt ?? new Date().toISOString(),
  };
  const dataset = getDatasetOption(selectedDataset);
  const isLiveDataset = dataset.mode === "live";
  const liveFeed = feedSnapshot;

  const handleReset = () => {
    setSelectedDataset("unsw");
    setGraphStrategy("temporal");
    setModelVariant("tgn");
    setLrSlider(30);
    setHiddenSlider(60);
    setLogs([]);
    setProgress(0);
    setIsTraining(false);
    toast({
      title: "Configuration reset",
      description: "Model Studio switched back to the live replay dataset and default hyperparameters.",
    });
  };

  const handleSaveConfig = () => {
    toast({
      title: "Configuration saved",
      description: `${dataset.label} | ${graphStrategy} graph | lr=${sliderToLR(lrSlider)} | hidden=${sliderToHiddenDim(hiddenSlider)}`,
    });
  };

  const startTraining = async () => {
    setIsTraining(true);
    setLogs([]);
    setProgress(0);

    const datasetId = DATASET_MAP[selectedDataset] ?? "unsw_nb15";
    setLogs([{ text: `[INFO] Starting TGNN training on ${datasetId}...`, time: new Date().toLocaleTimeString() }]);

    try {
      await startTrainingMutation.mutateAsync({
        datasetId,
        architecture: modelVariant === "tgn" ? "gat" : modelVariant,
        hyperparameters: {
          learning_rate: parseFloat(sliderToLR(lrSlider)),
          hidden_dim: sliderToHiddenDim(hiddenSlider),
        },
        epochs: 50,
      });
      setLogs((prev) => [...prev, { text: "[INFO] Training queued on AI service", time: new Date().toLocaleTimeString() }]);
      setProgress(100);
      toast({ title: "Training started", description: `TGNN ${modelVariant.toUpperCase()} training on ${datasetId}` });
    } catch (err) {
      setLogs((prev) => [...prev, { text: `[ERROR] ${err instanceof Error ? err.message : "Training failed"}`, time: new Date().toLocaleTimeString() }]);
      toast({ title: "Training failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="page-kicker">Model Studio</div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Experiment Laboratory</h1>
            <p className="text-muted-foreground font-mono text-sm max-w-2xl">
              Train against historical datasets or attach the new live replay dataset so telemetry,
              anomaly pressure, and model quality move in real time while you tune the graph model.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleReset}>
              <RotateCcw size={16} /> Reset
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSaveConfig}>
              <Save size={16} /> Save Config
            </Button>
            <Button
              onClick={startTraining}
              disabled={isTraining}
              className="gap-2 min-w-[150px] bg-primary text-primary-foreground"
            >
              {isTraining ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {isTraining ? "Running..." : "Start Training"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dataset Feed</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge className={isLiveDataset ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}>
                  {dataset.mode === "live" ? "LIVE" : "BATCH"}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{dataset.label}</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{dataset.description}</div>
            </CardContent>
          </Card>

          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Records / Sec</div>
              <div className="mt-2 text-2xl font-bold font-mono text-primary">
                {liveFeed.current.recordsPerSecond.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {liveFeed.current.throughputMbps} Mbps stream throughput
              </div>
            </CardContent>
          </Card>

          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Anomaly Rate</div>
              <div className="mt-2 text-2xl font-bold font-mono text-orange-300">
                {liveFeed.current.anomalyRate.toFixed(2)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {liveFeed.current.alertsPerMinute} alerts / min
              </div>
            </CardContent>
          </Card>

          <Card className="metric-surface rounded-[1.35rem]">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Inference Health</div>
              <div className="mt-2 text-2xl font-bold font-mono text-cyan-200">
                {Math.round(liveFeed.current.confidence * 100)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {liveFeed.current.latencyMs} ms latency | queue {liveFeed.current.queueDepth}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="panel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={18} className="text-primary" />
                  Dataset
                </CardTitle>
                <CardDescription>Select the training source and attach the live replay when needed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Dataset</Label>
                  <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATASET_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="panel-subtle p-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-mono text-primary mb-2">
                    <Wifi size={14} />
                    {isLiveDataset ? "Live dataset attached" : "Historical dataset selected"}
                  </div>
                  <p>{dataset.source}</p>
                  <p className="mt-2">{dataset.description}</p>
                </div>

                <div className="space-y-2">
                  <Label>Graph Construction Strategy</Label>
                  <RadioGroup value={graphStrategy} onValueChange={(value) => setGraphStrategy(value as "static" | "temporal")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="static" id="static" />
                      <Label htmlFor="static">Static Snapshot</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="temporal" id="temporal" />
                      <Label htmlFor="temporal">Continuous Temporal (TGN)</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card className="panel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit size={18} className="text-primary" />
                  Model Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>GNN Variant</Label>
                  <Select value={modelVariant} onValueChange={(value) => setModelVariant(value as "gcn" | "gat" | "graphsage" | "tgn")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gcn">Graph Convolutional Network (GCN)</SelectItem>
                      <SelectItem value="gat">Graph Attention Network (GAT)</SelectItem>
                      <SelectItem value="graphsage">GraphSAGE</SelectItem>
                      <SelectItem value="tgn">Temporal Graph Network (TGN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Learning Rate</Label>
                      <span className="text-muted-foreground font-mono">{sliderToLR(lrSlider)}</span>
                    </div>
                    <Slider value={[lrSlider]} onValueChange={([value]) => setLrSlider(value)} max={100} step={1} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Hidden Dimension</Label>
                      <span className="text-muted-foreground font-mono">{sliderToHiddenDim(hiddenSlider)}</span>
                    </div>
                    <Slider value={[hiddenSlider]} onValueChange={([value]) => setHiddenSlider(value)} max={100} step={1} />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Features to Include</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feat-time" defaultChecked />
                      <Label htmlFor="feat-time" className="text-xs">Timestamp</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feat-port" defaultChecked />
                      <Label htmlFor="feat-port" className="text-xs">Port No.</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feat-bytes" defaultChecked />
                      <Label htmlFor="feat-bytes" className="text-xs">Packet Size</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="feat-proto" defaultChecked />
                      <Label htmlFor="feat-proto" className="text-xs">Protocol</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="panel-card overflow-hidden">
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-card/20">
                <span className="font-mono text-sm text-muted-foreground">Console Output</span>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-primary">{dataset.label}</span>
                  {isTraining && <span className="text-emerald-300 animate-pulse">TRAINING IN PROGRESS</span>}
                </div>
              </div>
              <div className="flex-1 p-0">
                <TrainingTerminal logs={logs} className="h-[320px] border-none rounded-none" />
              </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="panel-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    Live Dataset Throughput
                  </CardTitle>
                  <CardDescription>
                    {isLiveDataset
                      ? "Streaming telemetry from the newly added live replay dataset."
                      : "Live replay stream used as an operational validation lane beside the selected offline dataset."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={liveFeed.timeline}>
                      <defs>
                        <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(186 95% 55%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(186 95% 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#233041" />
                      <XAxis dataKey="time" stroke="#6b7280" minTickGap={24} />
                      <YAxis stroke="#6b7280" />
                      <Tooltip contentStyle={{ backgroundColor: "#08111b", borderColor: "#1f2d3d" }} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="recordsPerSecond"
                        stroke="hsl(186 95% 55%)"
                        fill="url(#throughputFill)"
                        strokeWidth={2}
                        name="Records / Sec"
                      />
                      <Line
                        type="monotone"
                        dataKey="throughputMbps"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                        name="Mbps"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="panel-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge size={18} className="text-primary" />
                    Training Quality Window
                  </CardTitle>
                  <CardDescription>
                    Live view of the rolling quality metrics used to evaluate the currently tuned model.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={liveFeed.trainingTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#233041" />
                      <XAxis dataKey="time" stroke="#6b7280" minTickGap={24} />
                      <YAxis stroke="#6b7280" domain={[0, 1]} />
                      <Tooltip contentStyle={{ backgroundColor: "#08111b", borderColor: "#1f2d3d" }} />
                      <Legend />
                      <Line type="monotone" dataKey="auc" stroke="hsl(186 95% 55%)" strokeWidth={2} dot={false} name="AUC" />
                      <Line type="monotone" dataKey="precision" stroke="#f59e0b" strokeWidth={2} dot={false} name="Precision" />
                      <Line type="monotone" dataKey="recall" stroke="#22c55e" strokeWidth={2} dot={false} name="Recall" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="panel-card">
              <CardHeader>
                <CardTitle>Current Stream Snapshot</CardTitle>
                <CardDescription>
                  The same live dataset feed is shared with Mission Control and the downstream analytics pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="panel-subtle p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Malicious Share</div>
                  <div className="mt-2 text-2xl font-mono font-bold text-red-300">
                    {Math.round(liveFeed.current.maliciousShare * 100)}%
                  </div>
                </div>
                <div className="panel-subtle p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dropped Packets</div>
                  <div className="mt-2 text-2xl font-mono font-bold text-yellow-300">
                    {liveFeed.current.droppedPackets}
                  </div>
                </div>
                <div className="panel-subtle p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Threat Score</div>
                  <div className="mt-2 text-2xl font-mono font-bold text-cyan-200">
                    {(liveFeed.current.threatScore * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="panel-subtle p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last Update</div>
                  <div className="mt-2 text-2xl font-mono font-bold text-white">
                    {liveFeed.lastUpdated}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
