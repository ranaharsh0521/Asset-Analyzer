import { useEffect, useRef } from 'react';

interface GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'malicious' | 'normal';
}

export function NetworkGraph({ active = true, alertMode = false }: { active?: boolean, alertMode?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Bug fix: use a ref instead of state so the animation loop always reads
  // the latest node positions without stale-closure issues.
  const nodesRef = useRef<GraphNode[]>([]);
  const alertModeRef = useRef(alertMode);

  // Keep alertModeRef in sync with prop changes
  useEffect(() => {
    alertModeRef.current = alertMode;
  }, [alertMode]);

  // Initialize nodes once (no re-render needed — it's a ref)
  useEffect(() => {
    nodesRef.current = Array.from({ length: 30 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      type: i < 3 ? 'malicious' : 'normal',
    }));
  }, []);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const nodes = nodesRef.current;   // always gets the latest ref value
      const isAlert = alertModeRef.current;

      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(13, 17, 23, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update positions (mutate in-place — intentional for canvas animation)
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > 100) node.vx *= -1;
        if (node.y < 0 || node.y > 100) node.vy *= -1;
      });

      // Draw connections
      ctx.lineWidth = 0.5;
      nodes.forEach((nodeA, i) => {
        nodes.slice(i + 1).forEach(nodeB => {
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 20) {
            const opacity = 1 - dist / 20;
            if (isAlert && (nodeA.type === 'malicious' || nodeB.type === 'malicious')) {
              ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
            } else {
              ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.5})`;
            }
            ctx.beginPath();
            ctx.moveTo(nodeA.x * canvas.width / 100, nodeA.y * canvas.height / 100);
            ctx.lineTo(nodeB.x * canvas.width / 100, nodeB.y * canvas.height / 100);
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        const cx = node.x * canvas.width / 100;
        const cy = node.y * canvas.height / 100;
        ctx.beginPath();
        ctx.arc(cx, cy, node.type === 'malicious' && isAlert ? 4 : 2, 0, Math.PI * 2);
        if (node.type === 'malicious' && isAlert) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ef4444';
        } else {
          ctx.fillStyle = '#06b6d4';
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#06b6d4';
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    // Resize handler
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]); // Only re-run if `active` changes — alertMode is handled via ref

  return (
    <div className="w-full h-full relative overflow-hidden bg-card/20 rounded-lg border border-border/50">
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <div className="flex items-center gap-1 text-[10px] font-mono text-primary bg-background/50 px-2 py-1 rounded border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          LIVE MONITORING
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
