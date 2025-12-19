import React, { useEffect, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TerminalProps {
  logs: string[];
  className?: string;
}

export function TrainingTerminal({ logs, className }: TerminalProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className={cn("bg-black border border-border font-mono text-xs md:text-sm p-4 rounded-lg flex flex-col h-[300px]", className)}>
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="ml-2 text-muted-foreground">~/gnn-ids/train.py --model=TGN</span>
      </div>
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-1">
          {logs.map((log, i) => (
            <div key={i} className={cn(
              "break-all",
              log.includes("[SUCCESS]") ? "text-green-400" :
              log.includes("[ERROR]") ? "text-red-400" :
              log.includes("[INFO]") ? "text-blue-300" :
              log.includes("Epoch") ? "text-yellow-100" :
              "text-muted-foreground"
            )}>
              <span className="opacity-50 mr-2">{new Date().toLocaleTimeString()}</span>
              {log}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
