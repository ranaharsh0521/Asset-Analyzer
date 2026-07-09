import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ScanSearch,
  Wifi,
  Server,
  Laptop,
  Smartphone,
  Printer,
  Router as RouterIcon,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Eye,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNetworkNodes, useTopology, useAlerts, useDashboardMetrics, useNetworkScan } from "@/hooks/useApi";
import type { NetworkNode, Alert } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MappedDevice {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  type: "router" | "server" | "workstation" | "laptop" | "mobile" | "printer" | "iot";
  status: "online" | "offline" | "suspicious" | "compromised";
  risk: number;
  openPorts: number[];
  lastSeen: string;
  vendor: string;
  os: string;
  packetsPerSecond: number;
  throughputMbps: number;
  alerts: Array<{ type: string; severity: "low" | "medium" | "high" | "critical"; timestamp: string; details: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_ICONS: Record<MappedDevice["type"], typeof RouterIcon> = {
  router: RouterIcon,
  server: Server,
  workstation: Laptop,
  laptop: Laptop,
  mobile: Smartphone,
  printer: Printer,
  iot: Wifi,
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500/20 text-green-400 border-green-500/30",
  offline: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  suspicious: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  compromised: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapNodeType(nodeType: string): MappedDevice["type"] {
  const mapping: Record<string, MappedDevice["type"]> = {
    router: "router",
    switch: "router",
    server: "server",
    host: "workstation",
    ip_address: "workstation",
    user: "laptop",
    iot_device: "iot",
  };
  return mapping[nodeType] ?? "workstation";
}

function mapNodeToDevice(node: NetworkNode, nodeAlerts: Alert[]): MappedDevice {
  return {
    id: node.id,
    ip: node.ipAddress,
    mac: node.macAddress ?? "—",
    hostname: node.hostname ?? node.ipAddress,
    type: mapNodeType(node.nodeType),
    status: node.status as MappedDevice["status"],
    risk: node.riskScore ?? 0,
    openPorts: (node.openPorts as number[]) ?? [],
    lastSeen: node.lastSeenAt ? new Date(node.lastSeenAt).toLocaleString() : "—",
    vendor: node.vendor ?? "Unknown",
    os: node.os ?? "Unknown",
    packetsPerSecond: node.packets ?? 0,
    throughputMbps: node.bytes ? Math.round((node.bytes / 1024 / 1024) * 10) / 10 : 0,
    alerts: nodeAlerts.slice(0, 4).map((a) => ({
      type: a.attackType ?? "Unknown",
      severity: (a.severity as "low" | "medium" | "high" | "critical") ?? "low",
      timestamp: new Date(a.createdAt).toLocaleString(),
      details: a.description ?? `${a.attackStage ?? "Unknown"} activity detected`,
    })),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NetworkScanner() {
  const { toast } = useToast();
  const { data: nodesData, refetch: refetchNodes, isLoading: nodesLoading } = useNetworkNodes();
  const { data: topology } = useTopology();
  const { data: alertsData } = useAlerts();
  const { data: dashboardMetrics } = useDashboardMetrics();
  const networkScan = useNetworkScan();

  const [scanRange, setScanRange] = useState("192.168.1.0/24");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<MappedDevice | null>(null);
  const [filter, setFilter] = useState<"all" | "compromised" | "suspicious" | "online">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const nodes = nodesData?.nodes ?? [];
  const allAlerts = alertsData?.alerts ?? [];

  // Map NetworkNode DB records to display-friendly MappedDevice objects
  const devices = useMemo<MappedDevice[]>(() => {
    return nodes.map((node) => {
      const nodeAlerts = allAlerts.filter(
        (a) => a.sourceIp === node.ipAddress || a.targetIp === node.ipAddress
      );
      return mapNodeToDevice(node, nodeAlerts);
    });
  }, [nodes, allAlerts]);

  // Keep selected device updated when data refreshes
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]);
    } else if (selectedDevice) {
      const updated = devices.find((d) => d.id === selectedDevice.id);
      if (updated) setSelectedDevice(updated);
    }
  }, [devices]);

  const startScan = async () => {
    setIsScanning(true);
    setProgress(15);
    setSelectedDevice(null);
    try {
      setProgress(45);
      const result = await networkScan.mutateAsync({
        scanRange,
        datasetId: "unsw_nb15",
        windowSeconds: 30,
      });
      setProgress(85);
      await refetchNodes();
      setProgress(100);
      toast({
        title: "Network scan completed",
        description: `${result.scan?.nodes ?? 0} nodes and ${result.scan?.edges ?? 0} edges synced from the TGNN graph pipeline.`,
      });
    } catch (error) {
      toast({
        title: "Network scan failed",
        description: error instanceof Error ? error.message : "Unable to sync topology.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const filteredDevices = devices.filter((device) => {
    if (filter !== "all" && device.status !== filter) return false;
    if (
      searchQuery &&
      !device.ip.includes(searchQuery) &&
      !device.hostname.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const stats = {
    total: devices.length,
    compromised: devices.filter((d) => d.status === "compromised").length,
    suspicious: devices.filter((d) => d.status === "suspicious").length,
    online: devices.filter((d) => d.status === "online").length,
  };

  // Timeline chart: render the latest measured aggregate only when live telemetry exists.
  const timelineData = useMemo(() => {
    const edgeCount = topology?.edges?.length ?? 0;
    const openAlerts = dashboardMetrics?.alerts?.open ?? 0;
    if (!edgeCount && !openAlerts) return [];
    return [{
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      throughputMbps: Math.round(edgeCount * 10) / 10,
      queueDepth: openAlerts,
      alertsPerMinute: openAlerts,
    }];
  }, [topology, dashboardMetrics]);

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="app-main flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="page-header">
          <div className="page-kicker">Live Discovery</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Network Scanner and Threat Lens</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Real-time view of all network assets tracked by the GNN-IDS platform. Trigger a scan
            to refresh node telemetry from the database.
          </p>
        </div>

        {/* Scan bar */}
        <Card className="panel-card">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-2 block">Target Network Range</label>
                <div className="flex gap-2">
                  <Input
                    value={scanRange}
                    onChange={(e) => setScanRange(e.target.value)}
                    placeholder="192.168.1.0/24"
                    className="bg-background/50 border-border/50 font-mono"
                  />
                  <Button onClick={startScan} disabled={isScanning} className="bg-primary/20 hover:bg-primary/30 border border-primary/50">
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ScanSearch className="w-4 h-4 mr-2" />}
                    {isScanning ? "Scanning..." : "Start Scan"}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => refetchNodes()} title="Refresh node list">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {isScanning && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Scanning network...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading state */}
        {nodesLoading && !isScanning && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Main content */}
        {devices.length > 0 && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Network} label="Total Devices" value={stats.total} color="text-blue-400" />
              <StatCard icon={XCircle} label="Compromised" value={stats.compromised} color="text-red-400" />
              <StatCard icon={AlertTriangle} label="Suspicious" value={stats.suspicious} color="text-yellow-400" />
              <StatCard icon={CheckCircle} label="Online" value={stats.online} color="text-green-400" />
            </div>

            {/* Telemetry chart */}
            <Card className="panel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RadioTower className="w-5 h-5 text-primary" />
                  Network Activity Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                      <YAxis stroke="#666" />
                      <Tooltip contentStyle={{ backgroundColor: "#111", borderColor: "#333" }} />
                      <Legend />
                      <Line type="monotone" dataKey="throughputMbps" stroke="hsl(190, 90%, 50%)" strokeWidth={2} dot name="Mbps" />
                      <Line type="monotone" dataKey="queueDepth" stroke="#f59e0b" strokeWidth={2} dot name="Queue Depth" />
                      <Line type="monotone" dataKey="alertsPerMinute" stroke="#ef4444" strokeWidth={2} dot name="Alerts / Min" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                    Awaiting packet-derived network telemetry.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filters */}
            <div className="panel-subtle flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by IP or hostname..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "compromised", "suspicious", "online"] as const).map((value) => (
                  <Button
                    key={value}
                    variant={filter === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(value)}
                    className={cn(filter === value ? "bg-primary/20 border-primary/50" : "border-border/50", "capitalize")}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            {/* Device list + detail panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: device list */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Discovered Devices ({filteredDevices.length})
                </h3>
                {filteredDevices.length === 0 ? (
                  <div className="p-8 text-center text-sm font-mono text-muted-foreground border rounded-lg border-dashed">
                    No devices match the current filter.
                  </div>
                ) : (
                  filteredDevices.map((device) => {
                    const Icon = DEVICE_ICONS[device.type];
                    return (
                      <Card
                        key={device.id}
                        className={cn(
                          "panel-card cursor-pointer transition-all hover:border-primary/50",
                          selectedDevice?.id === device.id && "border-primary/50 ring-1 ring-primary/30",
                          device.status === "compromised" && "border-red-500/30 bg-red-500/5",
                          device.status === "suspicious" && "border-yellow-500/30 bg-yellow-500/5",
                        )}
                        onClick={() => setSelectedDevice(device)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "p-2 rounded-lg",
                                  device.status === "compromised" ? "bg-red-500/20" :
                                  device.status === "suspicious" ? "bg-yellow-500/20" :
                                  "bg-primary/20",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "w-5 h-5",
                                    device.status === "compromised" ? "text-red-400" :
                                    device.status === "suspicious" ? "text-yellow-400" :
                                    "text-primary",
                                  )}
                                />
                              </div>
                              <div>
                                <div className="font-mono font-bold text-sm">{device.hostname}</div>
                                <div className="text-xs text-muted-foreground">{device.ip}</div>
                              </div>
                            </div>
                            <Badge className={cn("border", STATUS_COLORS[device.status])}>
                              {device.status}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{device.vendor}</span>
                            <span className="font-mono">{Math.round(device.risk * 100)}% Risk</span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground font-mono">
                            {device.packetsPerSecond.toLocaleString()} packets | {device.throughputMbps} MB transferred
                          </div>
                          {device.openPorts.length > 0 && (
                            <div className="mt-2 flex gap-1 flex-wrap">
                              {device.openPorts.slice(0, 4).map((port) => (
                                <span key={port} className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground">
                                  {port}
                                </span>
                              ))}
                              {device.openPorts.length > 4 && (
                                <span className="px-1.5 py-0.5 text-xs text-muted-foreground">
                                  +{device.openPorts.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Right: detail panel */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-primary" />
                  Device Analysis
                </h3>
                {selectedDevice ? (
                  <Card className="panel-card">
                    <CardContent className="p-6 space-y-6">
                      {/* Header */}
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/20">
                          {(() => {
                            const Icon = DEVICE_ICONS[selectedDevice.type];
                            return <Icon className="w-8 h-8 text-primary" />;
                          })()}
                        </div>
                        <div>
                          <div className="text-xl font-bold">{selectedDevice.hostname}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {selectedDevice.ip} • {selectedDevice.mac}
                          </div>
                        </div>
                      </div>

                      {/* Risk + Status grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="panel-subtle p-3">
                          <div className="text-xs text-muted-foreground mb-1">Risk Level</div>
                          <div
                            className={cn(
                              "text-lg font-bold",
                              selectedDevice.risk > 0.8 ? "text-red-400" :
                              selectedDevice.risk > 0.5 ? "text-yellow-400" :
                              "text-green-400",
                            )}
                          >
                            {selectedDevice.risk > 0.8 ? "CRITICAL" :
                             selectedDevice.risk > 0.5 ? "HIGH" :
                             selectedDevice.risk > 0.3 ? "MEDIUM" : "LOW"}
                          </div>
                        </div>
                        <div className="panel-subtle p-3">
                          <div className="text-xs text-muted-foreground mb-1">Status</div>
                          <div className="text-lg font-bold capitalize">{selectedDevice.status}</div>
                        </div>
                      </div>

                      {/* Risk bar */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">Risk Score</div>
                        <Progress
                          value={selectedDevice.risk * 100}
                          className={cn(
                            "h-3",
                            selectedDevice.risk > 0.8 ? "[&>div]:bg-red-500" :
                            selectedDevice.risk > 0.5 ? "[&>div]:bg-yellow-500" :
                            "[&>div]:bg-green-500",
                          )}
                        />
                      </div>

                      {/* OS / Vendor / Packets */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">OS:</span>
                          <span>{selectedDevice.os}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <HardDrive className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Vendor:</span>
                          <span>{selectedDevice.vendor}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Last Seen:</span>
                          <span className="font-mono text-xs">{selectedDevice.lastSeen}</span>
                        </div>
                      </div>

                      {/* Open ports */}
                      {selectedDevice.openPorts.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold mb-2">Open Ports</div>
                          <div className="flex gap-2 flex-wrap">
                            {selectedDevice.openPorts.map((port) => (
                              <span key={port} className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                {port}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linked alerts */}
                      {selectedDevice.alerts.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            Linked Alerts ({selectedDevice.alerts.length})
                          </div>
                          <div className="space-y-2">
                            {selectedDevice.alerts.map((alert, index) => (
                              <div key={`${alert.type}-${index}`} className={cn("p-3 rounded-2xl border", SEVERITY_COLORS[alert.severity])}>
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-semibold">{alert.type}</span>
                                  <Badge className={cn("border text-xs", SEVERITY_COLORS[alert.severity])}>
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">{alert.timestamp}</div>
                                <div className="text-xs mt-1 text-muted-foreground">{alert.details}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1 bg-primary/20 hover:bg-primary/30 border border-primary/50">
                          <Shield className="w-4 h-4 mr-2" />
                          Quarantine
                        </Button>
                        <Button variant="outline" className="flex-1 border-border/50">
                          Block IP
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="panel-card">
                    <CardContent className="p-12 text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">Select a device to view detailed analysis</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {devices.length === 0 && !isScanning && !nodesLoading && (
          <Card className="panel-card">
            <CardContent className="p-12 text-center">
              <ScanSearch className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Network Assets Found</h3>
              <p className="text-muted-foreground mb-4">
                Trigger a scan or ensure the GNN pipeline has ingested network data.
              </p>
              <Button onClick={startScan} className="bg-primary/20 hover:bg-primary/30 border border-primary/50">
                <ScanSearch className="w-4 h-4 mr-2" />
                Quick Scan ({scanRange})
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Network;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="metric-surface rounded-[1.35rem]">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5">
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <div>
            <div className={cn("text-2xl font-bold font-mono", color)}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
