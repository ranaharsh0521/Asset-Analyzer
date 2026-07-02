import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { NetworkGraph } from "@/components/viz/NetworkGraph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ShieldAlert, Network as NetworkIcon, Globe, Lock, LogOut, RadioTower, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDashboardMetrics, useAlerts, useTopology, usePredictions } from "@/hooks/useApi";
import { api } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { label: string; border: string; bg: string; text: string; dot: string }> = {
  critical: { label: "CRITICAL", border: "border-red-500/60", bg: "bg-red-500/8", text: "text-red-400", dot: "bg-red-500" },
  high: { label: "HIGH", border: "border-orange-500/60", bg: "bg-orange-500/8", text: "text-orange-400", dot: "bg-orange-500" },
  medium: { label: "MEDIUM", border: "border-yellow-500/60", bg: "bg-yellow-500/8", text: "text-yellow-400", dot: "bg-yellow-500" },
  low: { label: "LOW", border: "border-blue-500/60", bg: "bg-blue-500/8", text: "text-blue-400", dot: "bg-blue-500" },
  info: { label: "INFO", border: "border-blue-500/60", bg: "bg-blue-500/8", text: "text-blue-400", dot: "bg-blue-500" },
};

export default function Dashboard({ onLogout }: { onLogout?: () => void }) {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: alertsData, isLoading: alertsLoading } = useAlerts();
  const { data: topology } = useTopology();
  const { data: predictionsData } = usePredictions();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeline, setTimeline] = useState<Array<{ time: string; alerts: number; risk: number; predictions: number }>>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!metrics) return;
    setTimeline((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
          alerts: metrics.alerts?.total ?? 0,
          risk: Math.round((metrics.network?.avgRisk ?? 0) * 100),
          predictions: predictionsData?.predictions?.length ?? 0,
        },
      ];
      return next.slice(-24);
    });
  }, [metrics, predictionsData]);

  useEffect(() => {
    const ws = api.createWebSocket((msg: unknown) => {
      const event = msg as { type: string };
      if (event.type === "alert" || event.type === "prediction") {
        // React Query refetch handles updates via refetchInterval
      }
    });
    return () => ws?.close();
  }, []);

  const alerts = alertsData?.alerts ?? [];
  const threatLevel = (metrics?.alerts?.critical ?? 0) > 0 ? "CRITICAL"
    : (metrics?.alerts?.high ?? 0) > 0 ? "ELEVATED" : "LOW";
  const isThreatElevated = threatLevel !== "LOW";
  const activeNodes = metrics?.network?.total ?? 0;
  const avgRisk = metrics?.network?.avgRisk ?? 0;
  const topRiskNodes = topology?.nodes?.slice(0, 5) ?? [];

  if (metricsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                Real-time TGNN-powered threat detection. All metrics sourced from live PostgreSQL
                and Temporal Graph Neural Network inference on UNSW-NB15 / TON-IoT datasets.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_auto]">
              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI Model</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  TGNN GAT Active
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {(metrics?.ai as { model_loaded?: boolean })?.model_loaded ? "Model loaded" : "Awaiting training"}
                </div>
              </div>

              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Threat Status</div>
                <div className={cn(
                  "mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono border",
                  isThreatElevated ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/20 text-green-400",
                )}>
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isThreatElevated ? "bg-red-500" : "bg-green-500")} />
                  {isThreatElevated ? `${threatLevel} ALERT` : "ALL SYSTEMS NORMAL"}
                </div>
              </div>

              <div className="panel-subtle p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Time</div>
                <div className="mt-2 text-2xl font-mono font-bold text-white">{currentTime.toLocaleTimeString()}</div>
              </div>

              <div className="panel-subtle p-4">
                <Button variant="ghost" size="sm" onClick={onLogout} className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground hover:bg-destructive/10">
                  <LogOut className="w-4 h-4 mr-2" /> Secure Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Network Nodes" value={activeNodes.toLocaleString()} icon={NetworkIcon} trend={`${metrics?.network?.compromised ?? 0} compromised`} color="text-blue-400" />
          <MetricCard title="Threat Posture" value={threatLevel} icon={ShieldAlert} color={isThreatElevated ? "text-red-400" : "text-green-400"} />
          <MetricCard title="Avg Risk Score" value={`${Math.round(avgRisk * 100)}%`} icon={RadioTower} trend={`${metrics?.network?.suspicious ?? 0} suspicious`} color="text-cyan-300" />
          <MetricCard title="Open Alerts (24h)" value={String(metrics?.alerts?.open ?? 0)} icon={Lock} color="text-orange-400" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="panel-card xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity size={18} className="text-primary" /> Live SOC Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#223041" />
                  <XAxis dataKey="time" stroke="#6b7280" minTickGap={24} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: "#08111b", borderColor: "#1f2d3d" }} />
                  <Legend />
                  <Area type="monotone" dataKey="alerts" stroke="hsl(186 95% 55%)" fill="hsl(186 95% 55% / 0.2)" name="Alerts" />
                  <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} dot={false} name="Risk %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader><CardTitle>High-Risk Nodes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {topRiskNodes.map((node, index) => (
                <div key={node.id} className="panel-subtle p-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-mono text-sm text-white">{index + 1}. {node.label}</div>
                      <div className="text-xs text-muted-foreground">{node.ip} | {node.status}</div>
                    </div>
                    <div className="text-lg font-mono font-bold text-primary">{Math.round(node.risk * 100)}%</div>
                  </div>
                </div>
              ))}
              {!topRiskNodes.length && <p className="text-sm text-muted-foreground">No network nodes synced yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[520px]">
          <div className="panel-card lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2"><Globe size={16} className="text-primary" /> Live Threat Topology</h3>
              <span className="text-xs font-mono text-muted-foreground">{topology?.nodes?.length ?? 0} nodes | {topology?.edges?.length ?? 0} edges</span>
            </div>
            <div className="flex-1 relative">
              <NetworkGraph active={true} alertMode={isThreatElevated} topology={topology} />
            </div>
          </div>

          <div className="panel-card flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/50 flex justify-between items-center shrink-0">
              <h3 className="font-semibold flex items-center gap-2"><ShieldAlert size={16} className="text-destructive" /> Alert Stream</h3>
              <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2 font-mono text-xs">
              {alertsLoading && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
              <AnimatePresence initial={false}>
                {alerts.map((alert) => {
                  const severityStyle = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <motion.div key={alert.id} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
                      className={cn("p-3 rounded-2xl border", severityStyle.border, severityStyle.bg)}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn("flex items-center gap-1 font-bold", severityStyle.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", severityStyle.dot)} />
                          {severityStyle.label}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-foreground/90 mb-1 font-semibold truncate">{alert.title}</div>
                      <div className="text-muted-foreground truncate">
                        {alert.sourceIp} → {alert.targetIp}
                        {alert.protocol && <span className="ml-2 px-1 py-0.5 bg-white/5 rounded text-[9px]">{alert.protocol}</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {!alerts.length && !alertsLoading && (
                <p className="text-center text-muted-foreground py-8">No active alerts</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, color }: {
  title: string; value: string; icon: typeof Activity; trend?: string; color: string;
}) {
  return (
    <Card className="metric-surface rounded-[1.5rem] hover:bg-card/60 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h4 className={cn("text-2xl font-bold font-mono", color)}>{value}</h4>
          </div>
          <div className={cn("p-2 rounded-xl bg-background/50 border border-white/5", color)}>
            <Icon size={20} />
          </div>
        </div>
        {trend && <div className="mt-4 text-xs font-mono text-muted-foreground">{trend}</div>}
      </CardContent>
    </Card>
  );
}
