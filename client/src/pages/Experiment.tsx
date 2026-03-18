import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Play, RotateCcw, Save, Database, BrainCircuit, Activity } from "lucide-react";
import { TrainingTerminal, type LogEntry } from "@/components/viz/TrainingTerminal";
import { MOCK_LOGS } from "@/lib/mockData";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// Map slider 0-100 to learning-rate 0.0001 – 0.01 (log scale)
function sliderToLR(val: number): string {
  return (0.0001 * Math.pow(100, val / 100)).toFixed(4);
}
// Map slider 0-100 to hidden dim 32 – 512
function sliderToHiddenDim(val: number): number {
  const dims = [32, 64, 128, 256, 512];
  return dims[Math.round((val / 100) * (dims.length - 1))];
}

export default function Experiment() {
  const { toast } = useToast();
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  // Bug fix: LogEntry carries a timestamp captured when the line was pushed
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Bug fix: slider display values were hardcoded; now stored in state
  const [lrSlider, setLrSlider] = useState(30);
  const [hiddenSlider, setHiddenSlider] = useState(60);

  const handleReset = () => {
    setLrSlider(30);
    setHiddenSlider(60);
    setLogs([]);
    setProgress(0);
    setIsTraining(false);
    toast({ title: "Configuration Reset", description: "All hyperparameters restored to defaults." });
  };

  const handleSaveConfig = () => {
    toast({
      title: "Configuration Saved",
      description: `LR: ${sliderToLR(lrSlider)} | Hidden Dim: ${sliderToHiddenDim(hiddenSlider)}`,
    });
  };

  const startTraining = () => {
    setIsTraining(true);
    setLogs([]);
    setProgress(0);

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex >= MOCK_LOGS.length) {
        clearInterval(interval);
        setIsTraining(false);
        return;
      }

      setLogs(prev => [
        ...prev,
        { text: MOCK_LOGS[currentLogIndex], time: new Date().toLocaleTimeString() },
      ]);
      setProgress(prev => Math.min(prev + (100 / MOCK_LOGS.length), 100));
      currentLogIndex++;
    }, 800);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Experiment Laboratory</h1>
            <p className="text-muted-foreground font-mono text-sm">Configure Model Hyperparameters & Train GNN</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleReset}><RotateCcw size={16} /> Reset</Button>
            <Button variant="outline" className="gap-2" onClick={handleSaveConfig}><Save size={16} /> Save Config</Button>
            <Button
              onClick={startTraining}
              disabled={isTraining}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 min-w-[140px]"
            >
              {isTraining ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Play size={16} />}
              {isTraining ? "Running..." : "Start Training"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">

            {/* Dataset Config */}
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database size={18} className="text-primary" /> Dataset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Dataset</Label>
                  <Select defaultValue="cicids2017">
                    <SelectTrigger><SelectValue placeholder="Select dataset" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cicids2017">CICIDS2017 (Sampled)</SelectItem>
                      <SelectItem value="unsw">UNSW-NB15</SelectItem>
                      <SelectItem value="darpa">DARPA Intrusion Detection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Graph Construction Strategy</Label>
                  <RadioGroup defaultValue="temporal">
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

            {/* Model Architecture */}
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BrainCircuit size={18} className="text-primary" /> Model Architecture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>GNN Variant</Label>
                  <Select defaultValue="tgn">
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Slider
                      value={[lrSlider]}
                      onValueChange={([v]) => setLrSlider(v)}
                      max={100}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <Label>Hidden Dimension</Label>
                      <span className="text-muted-foreground font-mono">{sliderToHiddenDim(hiddenSlider)}</span>
                    </div>
                    <Slider
                      value={[hiddenSlider]}
                      onValueChange={([v]) => setHiddenSlider(v)}
                      max={100}
                      step={1}
                    />
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

          {/* Terminal & Visualization */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="flex-1 bg-black/50 border-border/50 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-card/20">
                <span className="font-mono text-sm text-muted-foreground">Console Output</span>
                {isTraining && <span className="text-xs text-primary animate-pulse">TRAINING IN PROGRESS...</span>}
              </div>
              <div className="flex-1 p-0">
                <TrainingTerminal logs={logs} className="h-full border-none rounded-none" />
              </div>
            </Card>

            {/* Simulated Live Loss Chart (Placeholder) */}
            <div className="h-48 rounded-lg border border-border/50 bg-card/30 p-4 relative overflow-hidden flex items-center justify-center">
              {!isTraining && logs.length === 0 ? (
                <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Activity className="opacity-20" size={48} />
                  Start training to view live metrics
                </div>
              ) : (
                <div className="w-full h-full flex items-end gap-1 px-4 pb-4">
                  {/* Simulated Bar Chart */}
                  {Array.from({ length: 40 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.random() * 80 + 10}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="flex-1 bg-primary/20 hover:bg-primary/50 rounded-t-sm"
                    />
                  ))}
                  <div className="absolute top-2 right-4 font-mono text-xs text-primary">
                    Loss: {(0.9 - (progress / 100) * 0.7).toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
