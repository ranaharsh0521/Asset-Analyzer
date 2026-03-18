import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, FileCode, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { MOCK_FILES } from "@/lib/mockData";
import { cn } from "@/lib/utils";

function FileTreeItem({ item, depth = 0 }: { item: any, depth?: number }) {
  const [isOpen, setIsOpen] = useState(true);
  
  return (
    <div className="font-mono text-sm">
      <div 
        className={cn(
          "flex items-center gap-2 py-1 px-2 hover:bg-white/5 cursor-pointer rounded select-none",
          depth > 0 && "ml-4"
        )}
        onClick={() => item.type === 'folder' && setIsOpen(!isOpen)}
      >
        {item.type === 'folder' && (
          <span className="text-muted-foreground">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        {item.type === 'folder' ? (
          <Folder size={16} className="text-blue-400" />
        ) : item.name.endsWith('.py') ? (
          <FileCode size={16} className="text-yellow-400" />
        ) : (
          <FileText size={16} className="text-gray-400" />
        )}
        <span className={item.type === 'folder' ? "font-bold text-foreground" : "text-muted-foreground"}>
          {item.name}
        </span>
      </div>
      
      {isOpen && item.children && (
        <div className="pl-4 border-l border-white/5 ml-3">
          {item.children.map((child: string | any, i: number) => (
             typeof child === 'string' ? (
               <FileTreeItem key={i} item={{ name: child, type: child.includes('.') ? 'file' : 'folder' }} depth={depth + 1} />
             ) : (
               <FileTreeItem key={i} item={child} depth={depth + 1} />
             )
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectStructure() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Project Deliverables</h1>
        <p className="text-muted-foreground font-mono text-sm mb-6">Source Code & Implementation Structure</p>

        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Folder className="text-primary" /> Root Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black/50 p-6 rounded-lg border border-white/5">
              {MOCK_FILES.map((file, i) => (
                <FileTreeItem key={i} item={file} />
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
           <Card className="bg-card/30 border-border/50">
             <CardHeader><CardTitle>System Architecture</CardTitle></CardHeader>
             <CardContent className="font-mono text-xs space-y-2 text-muted-foreground">
               <p>Backend: Python 3.10 + FastAPI</p>
               <p>ML Framework: PyTorch 2.0 + PyG (Geometric)</p>
               <p>Graph DB: NetworkX (In-memory) / Neo4j (Optional)</p>
               <p>Frontend: React + Recharts (Visualization)</p>
             </CardContent>
           </Card>
           
           <Card className="bg-card/30 border-border/50">
             <CardHeader><CardTitle>API Endpoints</CardTitle></CardHeader>
             <CardContent className="font-mono text-xs space-y-2 text-muted-foreground">
               <div className="flex gap-2"><span className="text-green-400">POST</span> /api/v1/predict (Inference)</div>
               <div className="flex gap-2"><span className="text-blue-400">POST</span> /api/v1/train (Start Training)</div>
               <div className="flex gap-2"><span className="text-yellow-400">GET</span> /api/v1/metrics (Evaluation)</div>
             </CardContent>
           </Card>
        </div>
      </main>
    </div>
  );
}
