import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { NetworkGraph } from "@/components/viz/NetworkGraph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldAlert, Cpu, Network as NetworkIcon, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeNodes: 1420,
    threatLevel: "LOW",
    packetsPerSecond: 450,
    anomalies: 2
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        activeNodes: prev.activeNodes + Math.floor(Math.random() * 10) - 5,
        threatLevel: Math.random() > 0.9 ? "ELEVATED" : "LOW",
        packetsPerSecond: 400 + Math.floor(Math.random() * 200),
        anomalies: prev.anomalies + (Math.random() > 0.95 ? 1 : 0)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Security Operations Center</h1>
            <p className="text-muted-foreground font-mono text-sm">Real-time GNN-IDS Monitoring Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM SECURE
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">{new Date().toLocaleTimeString()}</div>
              <div className="text-xs text-muted-foreground">UTC {new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </header>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Network Nodes" 
            value={stats.activeNodes.toLocaleString()} 
            icon={NetworkIcon} 
            trend="+12%" 
            color="text-blue-400"
          />
          <MetricCard 
            title="Threat Level" 
            value={stats.threatLevel} 
            icon={ShieldAlert} 
            color={stats.threatLevel === "LOW" ? "text-green-400" : "text-red-400"}
          />
          <MetricCard 
            title="Traffic (PPS)" 
            value={stats.packetsPerSecond.toString()} 
            icon={Activity} 
            trend="+5%" 
            color="text-purple-400"
          />
          <MetricCard 
            title="Anomalies Detected" 
            value={stats.anomalies.toString()} 
            icon={Lock} 
            color="text-orange-400"
          />
        </div>

        {/* Main Content: Graph & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
          {/* Main Graph Visualization */}
          <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                Live Temporal Graph Structure
              </h3>
              <div className="flex gap-2">
                 <span className="text-xs font-mono text-muted-foreground">IP-IP / IP-User Edges</span>
              </div>
            </div>
            <div className="flex-1 relative">
              <NetworkGraph active={true} alertMode={stats.threatLevel === "ELEVATED"} />
            </div>
          </div>

          {/* Recent Alerts Panel */}
          <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm flex flex-col">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldAlert size={16} className="text-destructive" />
                Recent Alerts
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 font-mono text-xs">
              {Array.from({length: 5}).map((_, i) => (
                <div key={i} className="p-3 rounded border border-border/50 bg-black/20 hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex justify-between mb-1">
                    <span className="text-destructive font-bold">CRITICAL</span>
                    <span className="text-muted-foreground">10:42:{10 + i}</span>
                  </div>
                  <div className="text-foreground/80 mb-1">Botnet Communication Pattern</div>
                  <div className="text-muted-foreground truncate">Src: 192.168.1.{100+i} to Dst: 45.33.22.11</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, color }: any) {
  return (
    <Card className="bg-card/40 border-border/50 backdrop-blur-sm hover:bg-card/60 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h4 className={cn("text-2xl font-bold font-mono", color)}>{value}</h4>
          </div>
          <div className={cn("p-2 rounded-lg bg-background/50 border border-white/5", color)}>
            <Icon size={20} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 text-xs font-mono text-muted-foreground">
            <span className="text-green-400">{trend}</span> from last hour
          </div>
        )}
      </CardContent>
    </Card>
  );
}
