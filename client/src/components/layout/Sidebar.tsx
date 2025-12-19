import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Network, 
  FileText, 
  Terminal, 
  Activity,
  Shield,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/experiment", label: "Experiment Lab", icon: Network },
    { href: "/evaluation", label: "Evaluation", icon: Activity },
    { href: "/files", label: "Project Files", icon: FileText },
  ];

  return (
    <div className={cn(
      "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 flex items-center justify-between border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary animate-pulse" />
            <span className="font-mono font-bold text-lg text-primary tracking-tighter">
              GNN-IDS
            </span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-muted rounded text-muted-foreground"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          
          return (
            <Link key={link.href} href={link.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors group relative overflow-hidden",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_var(--color-primary)]" />
                )}
                <Icon size={20} className={cn(isActive && "text-primary drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]")} />
                {!collapsed && <span className="font-medium">{link.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        {!collapsed && (
          <div className="bg-black/30 p-3 rounded border border-border/50 font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM ONLINE
            </div>
            <div>GPU: NVIDIA A100 (Sim)</div>
            <div>Mem: 64GB / 128GB</div>
          </div>
        )}
      </div>
    </div>
  );
}
