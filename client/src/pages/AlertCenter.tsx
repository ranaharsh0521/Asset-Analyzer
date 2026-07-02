import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlerts, useUpdateAlert } from "@/hooks/useApi";

const STATUS_OPTIONS = ["open", "investigating", "resolved", "false_positive"] as const;

export default function AlertCenter() {
  const { data, isLoading } = useAlerts();
  const updateAlert = useUpdateAlert();
  const alerts = data?.alerts ?? [];

  const grouped = {
    critical: alerts.filter((a) => a.severity === "critical"),
    high: alerts.filter((a) => a.severity === "high"),
    medium: alerts.filter((a) => a.severity === "medium"),
    low: alerts.filter((a) => a.severity === "low" || a.severity === "info"),
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Alert Center</h1>
          <p className="text-muted-foreground mt-1">Real-time security alerts from TGNN inference engine</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(grouped).map(([severity, items]) => (
            <Card key={severity} className="panel-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold font-mono">{items.length}</div>
                <div className="text-xs uppercase text-muted-foreground">{severity}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />}

        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="panel-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className={cn(
                      "h-4 w-4",
                      alert.severity === "critical" ? "text-red-400" : "text-orange-400",
                    )} />
                    {alert.title}
                  </CardTitle>
                  <Badge variant="outline">{alert.severity}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
                <div className="flex flex-wrap gap-2 text-xs font-mono text-muted-foreground mb-4">
                  {alert.attackType && <span>Attack: {alert.attackType}</span>}
                  {alert.attackStage && <span>Stage: {alert.attackStage}</span>}
                  {alert.sourceIp && <span>Src: {alert.sourceIp}</span>}
                  {alert.targetIp && <span>Dst: {alert.targetIp}</span>}
                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={alert.status === status ? "default" : "outline"}
                      disabled={updateAlert.isPending}
                      onClick={() => updateAlert.mutate({ id: alert.id, status })}
                    >
                      {status === alert.status && <CheckCircle className="h-3 w-3 mr-1" />}
                      {status.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {!alerts.length && !isLoading && (
            <Card className="panel-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
                No alerts recorded. Run predictions to generate alerts from the TGNN model.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
