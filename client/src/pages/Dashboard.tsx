import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { NetworkGraph } from "@/components/viz/NetworkGraph";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ShieldAlert, Network as NetworkIcon, Globe, Lock, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Alert generation engine ────────────────────────────────────────────────

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  src: string;
  dst: string;
  protocol: string;
  time: string;
  isNew?: boolean;
}

const ATTACK_TYPES = [
  "Botnet C2 Beacon",
  "Port Scan Detected",
  "Brute Force – SSH",
  "DDoS Amplification",
  "SQL Injection Attempt",
  "Lateral Movement",
  "Data Exfiltration",
  "Privilege Escalation",
  "DNS Tunnelling",
  "Ransomware Signature",
  "Zero-Day Exploit",
  "ARP Spoofing",
  "Credential Stuffing",
  "Malware Dropper",
];
const PROTOCOLS = ["TCP", "UDP", "ICMP", "HTTP", "HTTPS", "DNS", "SMB", "FTP"];
const EXTERNAL_IPS = [
  "45.33.22.11", "185.220.101.34", "94.102.49.193",
  "198.51.100.42", "203.0.113.99", "91.108.4.55",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomIP(internal = true) {
  return internal
    ? `192.168.${randInt(0, 5)}.${randInt(1, 254)}`
    : EXTERNAL_IPS[randInt(0, EXTERNAL_IPS.length - 1)];
}
function randomSeverity(): Severity {
  const r = Math.random();
  if (r < 0.15) return "CRITICAL";
  if (r < 0.45) return "HIGH";
  if (r < 0.75) return "MEDIUM";
  return "INFO";
}
function generateAlert(): Alert {
  return {
    id: `${Date.now()}-${Math.random()}`,
    severity: randomSeverity(),
    title: ATTACK_TYPES[randInt(0, ATTACK_TYPES.length - 1)],
    src: randomIP(Math.random() > 0.4),
    dst: Math.random() > 0.5 ? randomIP(true) : randomIP(false),
    protocol: PROTOCOLS[randInt(0, PROTOCOLS.length - 1)],
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    isNew: true,
  };
}

const SEVERITY_STYLES: Record<Severity, { label: string; border: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { label: "CRITICAL", border: "border-red-500/60", bg: "bg-red-500/8", text: "text-red-400", dot: "bg-red-500" },
  HIGH: { label: "HIGH", border: "border-orange-500/60", bg: "bg-orange-500/8", text: "text-orange-400", dot: "bg-orange-500" },
  MEDIUM: { label: "MEDIUM", border: "border-yellow-500/60", bg: "bg-yellow-500/8", text: "text-yellow-400", dot: "bg-yellow-500" },
  INFO: { label: "INFO", border: "border-blue-500/60", bg: "bg-blue-500/8", text: "text-blue-400", dot: "bg-blue-500" },
};

// seed with 5 initial alerts
function seedAlerts(): Alert[] {
  return Array.from({ length: 5 }, generateAlert).map(a => ({ ...a, isNew: false }));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeNodes: 1420,
    threatLevel: "LOW",
    packetsPerSecond: 450,
    anomalies: 2,
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [alerts, setAlerts] = useState<Alert[]>(seedAlerts);
  const alertsRef = useRef<Alert[]>([]);
  alertsRef.current = alerts;

  // live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // stats simulator (every 2 s)
  useEffect(() => {
    const t = setInterval(() => {
      setStats(prev => ({
        activeNodes: prev.activeNodes + randInt(-5, 10),
        threatLevel: Math.random() > 0.88 ? "ELEVATED" : "LOW",
        packetsPerSecond: 400 + randInt(0, 200),
        anomalies: prev.anomalies + (Math.random() > 0.93 ? 1 : 0),
      }));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // real-time alert generator — new alert every 3-7 s
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = randInt(3000, 7000);
      timeoutId = setTimeout(() => {
        const newAlert = generateAlert();
        setAlerts(prev => {
          // keep newest 20, mark old ones not-new
          const updated = [newAlert, ...prev.map(a => ({ ...a, isNew: false }))].slice(0, 20);
          return updated;
        });
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  const isThreatElevated = stats.threatLevel === "ELEVATED";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Security Operations Center</h1>
            <p className="text-muted-foreground font-mono text-sm">Real-time GNN-IDS Monitoring Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border transition-colors duration-700",
              isThreatElevated
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-green-500/10 border-green-500/20 text-green-400"
            )}>
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isThreatElevated ? "bg-red-500" : "bg-green-500")} />
              {isThreatElevated ? "THREAT ELEVATED" : "SYSTEM SECURE"}
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">{currentTime.toLocaleTimeString()}</div>
              <div className="text-xs text-muted-foreground">UTC {currentTime.toLocaleDateString()}</div>
            </div>
          </div>
        </header>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Network Nodes" value={stats.activeNodes.toLocaleString()} icon={NetworkIcon} trend="+12%" color="text-blue-400" />
          <MetricCard title="Threat Level" value={stats.threatLevel} icon={ShieldAlert} color={isThreatElevated ? "text-red-400" : "text-green-400"} />
          <MetricCard title="Traffic (PPS)" value={stats.packetsPerSecond.toString()} icon={Activity} trend="+5%" color="text-purple-400" />
          <MetricCard title="Anomalies Detected" value={stats.anomalies.toString()} icon={Lock} color="text-orange-400" />
        </div>

        {/* Graph + Live Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">

          {/* Network Graph */}
          <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe size={16} className="text-primary" />
                Live Temporal Graph Structure
              </h3>
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Wifi size={12} className="text-green-400 animate-pulse" /> IP-IP / IP-User Edges
              </span>
            </div>
            <div className="flex-1 relative">
              <NetworkGraph active={true} alertMode={isThreatElevated} />
            </div>
          </div>

          {/* Real-Time Alerts Panel */}
          <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/50 flex justify-between items-center shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldAlert size={16} className="text-destructive" />
                Live Alerts
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                LIVE FEED
              </span>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2 font-mono text-xs">
              <AnimatePresence initial={false}>
                {alerts.map(alert => {
                  const s = SEVERITY_STYLES[alert.severity];
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: -14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "p-3 rounded border transition-colors cursor-pointer hover:bg-white/5",
                        s.border, s.bg,
                        alert.isNew && "ring-1 ring-offset-0 ring-primary/40"
                      )}
                    >
                      {/* Severity + Time */}
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn("flex items-center gap-1 font-bold", s.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", s.dot, alert.isNew && "animate-ping")} />
                          {s.label}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{alert.time}</span>
                      </div>
                      {/* Title */}
                      <div className="text-foreground/90 mb-1 font-semibold truncate">{alert.title}</div>
                      {/* IPs + Protocol */}
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
