import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { NetworkGraph } from "@/components/viz/NetworkGraph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ShieldAlert, Network as NetworkIcon, Globe, Lock, Wifi, LogOut, RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
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
import { useLiveDatasetFeed } from "@/lib/liveDataset";

const SEVERITY_STYLES = {
  CRITICAL: { label: "CRITICAL", border: "border-red-500/60", bg: "bg-red-500/8", text: "text-red-400", dot: "bg-red-500" },
  HIGH: { label: "HIGH", border: "border-orange-500/60", bg: "bg-orange-500/8", text: "text-orange-400", dot: "bg-orange-500" },
  MEDIUM: { label: "MEDIUM", border: "border-yellow-500/60", bg: "bg-yellow-500/8", text: "text-yellow-400", dot: "bg-yellow-500" },
  INFO: { label: "INFO", border: "border-blue-500/60", bg: "bg-blue-500/8", text: "text-blue-400", dot: "bg-blue-500" },
} as const;

export default function Dashboard({ onLogout }: { onLogout?: () => void }) {
  const liveFeed = useLiveDatasetFeed();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeNodes = 1200 + liveFeed.devices.length * 38 + liveFeed.current.queueDepth;
  const threatLevel = liveFeed.current.threatScore > 0.7 ? "CRITICAL" : liveFeed.current.threatScore > 0.52 ? "ELEVATED" : "LOW";
  const isThreatElevated = threatLevel !== "LOW";

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <header className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="page-kicker">SOC Live View</div>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl mb-3">Cyber Defense Command Center</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Mission Control is now pinned to the shared live replay dataset. The same telemetry
                pulse driving Model Studio also powers the topology, alert stream, and risk charting here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_auto]">
              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dataset Feed</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {liveFeed.dataset.label}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{liveFeed.dataset.source}</div>
              </div>

              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Threat Status</div>
                <div
                  className={cn(
                    "mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono border transition-colors duration-700",
                    isThreatElevated
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-green-500/10 border-green-500/20 text-green-400",
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isThreatElevated ? "bg-red-500" : "bg-green-500")} />
                  {isThreatElevated ? `${threatLevel} ALERT` : "ALL SYSTEMS NORMAL"}
                </div>
              </div>

              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Time</div>
                <div className="mt-2 text-2xl font-mono font-bold text-white">{currentTime.toLocaleTimeString()}</div>
                <div className="text-xs text-muted-foreground">UTC {currentTime.toLocaleDateString()}</div>
              </div>

              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Operator Control</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Secure Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Nodes" value={activeNodes.toLocaleString()} icon={NetworkIcon} trend="+ live" color="text-blue-400" />
          <MetricCard title="Threat Posture" value={threatLevel} icon={ShieldAlert} color={isThreatElevated ? "text-red-400" : "text-green-400"} />
          <MetricCard title="Traffic Flow" value={`${liveFeed.current.throughputMbps} Mbps`} icon={RadioTower} trend={`${liveFeed.current.recordsPerSecond.toLocaleString()} rps`} color="text-cyan-300" />
          <MetricCard title="Signals Flagged" value={liveFeed.current.alertsPerMinute.toString()} icon={Lock} color="text-orange-400" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="panel-card xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                Live Dataset Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={liveFeed.timeline}>
                  <defs>
                    <linearGradient id="recordsFillMission" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(186 95% 55%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(186 95% 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#223041" />
                  <XAxis dataKey="time" stroke="#6b7280" minTickGap={24} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: "#08111b", borderColor: "#1f2d3d" }} />
                  <Legend />
                  <Area type="monotone" dataKey="recordsPerSecond" stroke="hsl(186 95% 55%)" fill="url(#recordsFillMission)" strokeWidth={2} name="Records / Sec" />
                  <Line type="monotone" dataKey="anomalyRate" stroke="#f59e0b" strokeWidth={2} dot={false} name="Anomaly Rate %" />
                  <Line type="monotone" dataKey="threatScore" stroke="#ef4444" strokeWidth={2} dot={false} name="Threat Score" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi size={18} className="text-primary" />
                Hot Nodes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveFeed.riskNodes.slice(0, 5).map((node, index) => (
                <div key={node.node} className="panel-subtle p-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-mono text-sm text-white">{index + 1}. {node.node}</div>
                      <div className="text-xs text-muted-foreground">
                        {node.anomalies} anomalies | {node.alerts} alerts
                      </div>
                    </div>
                    <div className="text-lg font-mono font-bold text-primary">{Math.round(node.risk * 100)}%</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[520px]">
          <div className="panel-card lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                Live Threat Topology
              </h3>
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Wifi size={12} className="text-green-400 animate-pulse" /> Shared with live dataset replay
              </span>
            </div>
            <div className="flex-1 relative">
              <NetworkGraph active={true} alertMode={isThreatElevated} />
            </div>
          </div>

          <div className="panel-card flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/50 flex justify-between items-center shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldAlert size={16} className="text-destructive" />
                Alert Stream
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                LIVE
              </span>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2 font-mono text-xs">
              <AnimatePresence initial={false}>
                {liveFeed.alerts.map((alert) => {
                  const severityStyle = SEVERITY_STYLES[alert.severity];

                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: -14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "p-3 rounded-2xl border transition-colors cursor-pointer hover:bg-white/5",
                        severityStyle.border,
                        severityStyle.bg,
                        alert.isNew && "ring-1 ring-offset-0 ring-primary/40",
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn("flex items-center gap-1 font-bold", severityStyle.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", severityStyle.dot, alert.isNew && "animate-ping")} />
                          {severityStyle.label}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{alert.time}</span>
                      </div>
                      <div className="text-foreground/90 mb-1 font-semibold truncate">{alert.title}</div>
                      <div className="text-muted-foreground truncate">
                        {alert.src} → {alert.dst}
                        <span className="ml-2 px-1 py-0.5 bg-white/5 rounded text-[9px]">{alert.protocol}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>Traffic Mix Window</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liveFeed.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#223041" />
                <XAxis dataKey="time" stroke="#6b7280" minTickGap={24} />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: "#08111b", borderColor: "#1f2d3d" }} />
                <Legend />
                <Line type="monotone" dataKey="benignRecords" stroke="#22c55e" strokeWidth={2} dot={false} name="Benign Records" />
                <Line type="monotone" dataKey="maliciousRecords" stroke="#ef4444" strokeWidth={2} dot={false} name="Malicious Records" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
  trend?: string;
  color: string;
}) {
  return (
    <Card className="metric-surface rounded-[1.5rem] hover:bg-card/60 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h4 className={cn("text-2xl font-bold font-mono", color)}>{value}</h4>
          </div>
          <div className={cn("p-2 rounded-xl bg-background/50 border border-white/5 shadow-inner", color)}>
            <Icon size={20} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 text-xs font-mono text-muted-foreground">
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
