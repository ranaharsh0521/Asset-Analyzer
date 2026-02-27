import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_RESULTS } from "@/lib/mockData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const rocData = [
  { fpr: 0, tpr: 0 },
  { fpr: 0.02, tpr: 0.2 },
  { fpr: 0.05, tpr: 0.6 },
  { fpr: 0.1, tpr: 0.8 },
  { fpr: 0.2, tpr: 0.9 },
  { fpr: 0.3, tpr: 0.95 },
  { fpr: 0.5, tpr: 0.98 },
  { fpr: 0.8, tpr: 0.99 },
  { fpr: 1, tpr: 1 },
];

const baselineComparison = [
  { name: 'Random Forest', accuracy: 0.85, f1: 0.82 },
  { name: 'Logistic Reg', accuracy: 0.72, f1: 0.68 },
  { name: 'GCN (Static)', accuracy: 0.88, f1: 0.86 },
  { name: 'TGN (Ours)', accuracy: 0.94, f1: 0.94 },
];

export default function Evaluation() {
  const { toast } = useToast();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link Copied!", description: "Report URL copied to clipboard." });
    }).catch(() => {
      toast({ title: "Share", description: "Copy this URL: " + window.location.href });
    });
  };

  const handleExportPDF = () => {
    toast({ title: "Exporting PDF…", description: "Opening print dialog — choose 'Save as PDF'.", duration: 3000 });
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Model Evaluation</h1>
            <p className="text-muted-foreground font-mono text-sm">Comprehensive Performance Analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}><Share2 size={14} /> Share Report</Button>
            <Button variant="default" size="sm" className="gap-2 bg-primary text-primary-foreground" onClick={handleExportPDF}><Download size={14} /> Export PDF</Button>
          </div>
        </div>

        {/* Top Level Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(MOCK_RESULTS).map(([key, value]) => (
            <Card key={key} className="bg-card/40 border-primary/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-2xl font-mono font-bold text-primary">{value}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROC Curve */}
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle>ROC Curve Analysis</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rocData}>
                  <defs>
                    <linearGradient id="colorTpr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="fpr" stroke="#666" label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5 }} />
                  <YAxis stroke="#666" label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Area type="monotone" dataKey="tpr" stroke="hsl(190, 90%, 50%)" fillOpacity={1} fill="url(#colorTpr)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Baseline Comparison */}
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle>Baseline Comparison</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={baselineComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" domain={[0, 1]} stroke="#666" />
                  <YAxis dataKey="name" type="category" width={100} stroke="#999" tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Accuracy" />
                  <Bar dataKey="f1" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} name="F1 Score" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Confusion Matrix (Styled as Table for now, could be Heatmap) */}
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle>Confusion Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              <div className="space-y-4">
                <div className="h-24 bg-green-500/20 border border-green-500/50 rounded flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-green-400">14,203</span>
                  <span className="text-xs text-muted-foreground uppercase">True Negatives (Benign)</span>
                </div>
                <div className="h-24 bg-red-500/10 border border-red-500/30 rounded flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-red-300">89</span>
                  <span className="text-xs text-muted-foreground uppercase">False Negatives (Missed)</span>
                </div>
              </div>
              <div className="space-y-4 pt-12">
                <div className="h-24 bg-yellow-500/10 border border-yellow-500/30 rounded flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-yellow-300">142</span>
                  <span className="text-xs text-muted-foreground uppercase">False Positives (Alarm)</span>
                </div>
                <div className="h-24 bg-primary/20 border border-primary/50 rounded flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-primary">2,401</span>
                  <span className="text-xs text-muted-foreground uppercase">True Positives (Caught)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
