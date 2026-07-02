import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Database, Cpu, Activity, Server } from "lucide-react";
import { useSystemHealth, useTrainingRuns, useDatasets } from "@/hooks/useApi";

interface DatasetRow {
  id: string;
  name: string;
  source: string;
  status: string;
  recordCount: number;
}

export default function AdminPanel() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: trainingData } = useTrainingRuns();
  const { data: datasetsData } = useDatasets();

  const healthData = health as { status?: string; ai?: { status?: string; model_loaded?: boolean; gpu_available?: boolean } } | undefined;
  const aiHealth = healthData?.ai;
  const datasets = (datasetsData as { datasets?: DatasetRow[] } | undefined)?.datasets ?? [];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">System health, datasets, and model management</p>
        </div>

        {healthLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="panel-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> API Server</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-emerald-400">{healthData?.status ?? "unknown"}</Badge>
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" /> AI Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Badge variant="outline">{aiHealth?.status ?? "unknown"}</Badge>
              <p className="text-xs text-muted-foreground">Model: {aiHealth?.model_loaded ? "Loaded" : "Not trained"}</p>
              <p className="text-xs text-muted-foreground">GPU: {aiHealth?.gpu_available ? "Available" : "CPU only"}</p>
            </CardContent>
          </Card>

          <Card className="panel-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Datasets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{datasets.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Training Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(trainingData?.runs ?? []).map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div>
                    <div className="font-mono text-sm">{run.architecture.toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">
                      Epoch {run.currentEpoch}/{run.epochs} | Loss: {run.trainLoss ?? "—"}
                    </div>
                  </div>
                  <Badge variant="outline">{run.status}</Badge>
                </div>
              ))}
              {!trainingData?.runs?.length && (
                <p className="text-sm text-muted-foreground">No training runs. Start training from Model Studio.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Registered Datasets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {datasets.map((ds) => (
                <div key={ds.id} className="flex justify-between p-3 rounded-lg border border-border/50">
                  <div>
                    <div className="font-medium">{ds.name}</div>
                    <div className="text-xs text-muted-foreground">{ds.source} | {ds.recordCount} records</div>
                  </div>
                  <Badge variant="outline">{ds.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
