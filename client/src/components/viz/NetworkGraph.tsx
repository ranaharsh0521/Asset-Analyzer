import { useEffect, useRef } from "react";
import type { Topology } from "@/lib/api";

interface GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "malicious" | "normal" | "suspicious";
  id?: string;
  label?: string;
}

interface NetworkGraphProps {
  active?: boolean;
  alertMode?: boolean;
  topology?: Topology | null;
}

function NetworkGraphCanvas({ active = true, alertMode = false, topology }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const alertModeRef = useRef(alertMode);

  useEffect(() => {
    alertModeRef.current = alertMode;
  }, [alertMode]);

  useEffect(() => {
    if (topology?.nodes?.length) {
      const count = topology.nodes.length;
      nodesRef.current = topology.nodes.map((node, i) => {
        const angle = (i / count) * Math.PI * 2;
        const radius = 30 + (node.risk * 20);
        return {
          x: 50 + Math.cos(angle) * radius,
          y: 50 + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          type: node.status === "compromised" ? "malicious"
            : node.status === "suspicious" ? "suspicious" : "normal",
          id: node.id,
          label: node.label,
        };
      });
    } else {
      nodesRef.current = Array.from({ length: 30 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        type: i < 3 ? "malicious" : "normal",
      }));
    }
  }, [topology]);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const nodes = nodesRef.current;
      const isAlert = alertModeRef.current;

      ctx.fillStyle = "rgba(13, 17, 23, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 5 || node.x > 95) node.vx *= -1;
        if (node.y < 5 || node.y > 95) node.vy *= -1;
      });

      if (topology?.edges?.length) {
        const nodePositions = new Map(nodes.map((n, i) => [topology.nodes[i]?.id, n]));
        ctx.lineWidth = 0.8;
        topology.edges.forEach((edge) => {
          const src = nodePositions.get(edge.source);
          const tgt = nodePositions.get(edge.target);
          if (!src || !tgt) return;
          ctx.strokeStyle = isAlert ? "rgba(239, 68, 68, 0.4)" : "rgba(6, 182, 212, 0.3)";
          ctx.beginPath();
          ctx.moveTo(src.x * canvas.width / 100, src.y * canvas.height / 100);
          ctx.lineTo(tgt.x * canvas.width / 100, tgt.y * canvas.height / 100);
          ctx.stroke();
        });
      } else {
        ctx.lineWidth = 0.5;
        nodes.forEach((nodeA, i) => {
          nodes.slice(i + 1).forEach((nodeB) => {
            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
              const opacity = 1 - dist / 20;
              ctx.strokeStyle = isAlert && (nodeA.type === "malicious" || nodeB.type === "malicious")
                ? `rgba(239, 68, 68, ${opacity})`
                : `rgba(6, 182, 212, ${opacity * 0.5})`;
              ctx.beginPath();
              ctx.moveTo(nodeA.x * canvas.width / 100, nodeA.y * canvas.height / 100);
              ctx.lineTo(nodeB.x * canvas.width / 100, nodeB.y * canvas.height / 100);
              ctx.stroke();
            }
          });
        });
      }

      nodes.forEach((node) => {
        const px = node.x * canvas.width / 100;
        const py = node.y * canvas.height / 100;
        const radius = node.type === "malicious" ? 5 : node.type === "suspicious" ? 4 : 3;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        if (node.type === "malicious") {
          ctx.fillStyle = isAlert ? "#ef4444" : "#f97316";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = isAlert ? 15 : 5;
        } else if (node.type === "suspicious") {
          ctx.fillStyle = "#eab308";
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = "#06b6d4";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [active, topology]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function NetworkGraphWrapper(props: NetworkGraphProps) {
  return (
    <div className="w-full h-full relative overflow-hidden bg-card/20 rounded-lg border border-border/50">
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <div className="flex items-center gap-1 text-[10px] font-mono text-primary bg-background/50 px-2 py-1 rounded border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          LIVE TOPOLOGY
        </div>
      </div>
      <NetworkGraphCanvas {...props} />
    </div>
  );
}

export { NetworkGraphWrapper as NetworkGraph };
