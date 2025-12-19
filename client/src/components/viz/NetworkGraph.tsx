import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

export function NetworkGraph({ active = true, alertMode = false }: { active?: boolean, alertMode?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    // Init nodes
    const newNodes = Array.from({ length: 30 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      type: i < 3 ? 'malicious' : 'normal'
    }));
    setNodes(newNodes);
  }, []);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(13, 17, 23, 0.2)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update positions
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
            if (alertMode && (nodeA.type === 'malicious' || nodeB.type === 'malicious')) {
              ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`; // Red
            } else {
              ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.5})`; // Cyan
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
        ctx.arc(cx, cy, node.type === 'malicious' && alertMode ? 4 : 2, 0, Math.PI * 2);
        
        if (node.type === 'malicious' && alertMode) {
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
  }, [nodes, active, alertMode]);

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
