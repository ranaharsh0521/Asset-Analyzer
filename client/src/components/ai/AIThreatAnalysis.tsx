import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, Shield, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLiveAlerts, type LiveAlert } from "@/hooks/useLiveAlerts";

interface ThreatAnalysis {
  threatLevel: string;
  summary: string;
  recommendations: string[];
}

export function AIThreatAnalysis() {
  const { alerts, networkStats, isLoading: dataLoading } = useLiveAlerts();
  const [analysis, setAnalysis] = useState<ThreatAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);

  const analyzeThreats = async () => {
    if (alerts.length === 0) {
      setError("No live alerts available");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const recentAlerts = alerts.slice(0, 5);
      const alertData = recentAlerts.map((a: LiveAlert) => 
        `${a.severity}: ${a.title} (${a.src} → ${a.dst}, risk:${a.riskScore.toFixed(2)})`
      ).join(" | ");

      const context = `Network: ${networkStats.totalNodes} nodes, ${networkStats.activeConnections} connections, anomaly rate ${networkStats.anomalyRate}%`;

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertData,
          networkData: context,
          fullAlerts: recentAlerts.slice(0, 3)
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`API ${response.status}: ${text.slice(0, 100)}`);
      }
      const data = JSON.parse(text);
      setAnalysis(data);
    } catch (err: any) {
      console.error("Live analysis error:", err);
      setError(err.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-analyze on new alerts
  useEffect(() => {
    if (autoAnalyze && alerts.length > 0 && !isAnalyzing && !dataLoading) {
      const timeout = setTimeout(analyzeThreats, 2000);
      return () => clearTimeout(timeout);
    }
  }, [alerts.length, autoAnalyze, isAnalyzing, dataLoading]);

  const getThreatColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "HIGH": return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "MEDIUM": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "LOW": return "text-green-400 bg-green-500/10 border-green-500/30";
      default: return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    }
  };

  const alertCount = alerts.length;

  return (
    <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Live AI Threat Analysis
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            {alertCount} live alerts
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dataLoading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span>Loading live data...</span>
          </div>
        )}

        {!analysis && !isAnalyzing && !error && alertCount === 0 && (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm mb-4">
              Waiting for live security alerts...
            </p>
          </div>
        )}

        {(!analysis && !isAnalyzing) || error ? (
          <div className="text-center py-4">
            <button
              onClick={analyzeThreats}
              disabled={alerts.length === 0 || isAnalyzing}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} />
              Analyze Live Threats
            </button>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        ) : isAnalyzing ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span>AI analyzing live threats...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Live Threat Level
              </span>
              <span className={cn(
                "px-2 py-1 rounded text-xs font-semibold border",
                getThreatColor(analysis!.threatLevel)
              )}>
                {analysis!.threatLevel}
              </span>
            </div>

            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm text-foreground/90">{analysis!.summary}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Shield size={12} />
                Live Recommendations
              </p>
              <ul className="space-y-2">
                {analysis!.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-foreground/80">
                    <AlertTriangle size={14} className="text-primary mt-0.5 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={analyzeThreats}
                disabled={isAnalyzing}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary rounded text-sm transition-colors"
              >
                <RefreshCw size={14} className={isAnalyzing ? "animate-spin" : ""} />
                Re-analyze
              </button>
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAnalyze}
                  onChange={(e) => setAutoAnalyze(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Auto
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIThreatAnalysis;

