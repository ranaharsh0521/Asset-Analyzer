import { useState, useEffect, useCallback } from 'react';
import { ATTACK_STAGES, RISK_HEATMAP, HETEROGENEOUS_EDGES } from '@/lib/advancedMockData';

export interface LiveAlert {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  src: string;
  dst: string;
  protocol: string;
  timestamp: string;
  riskScore: number;
}

export function useLiveAlerts() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [networkStats, setNetworkStats] = useState({
    totalNodes: 0,
    activeConnections: 0,
    anomalyRate: 0
  });

  const refreshAlerts = useCallback(async () => {
    // Simulate real-time data from advancedMockData
    const newAlerts: LiveAlert[] = [
      ...ATTACK_STAGES.map((stage, i) => ({
        id: `alert-${Date.now()}-${i}`,
        title: stage.description,
        severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 4)] as any,
        src: stage.entities[0],
        dst: stage.entities[1],
        protocol: ['TCP', 'UDP', 'ICMP'][Math.floor(Math.random() * 3)],
        timestamp: new Date().toISOString(),
        riskScore: stage.probability
      })),
      ...RISK_HEATMAP.slice(0, 3).map((risk, i) => ({
        id: `risk-${Date.now()}-${i}`,
        title: `${risk.node} high risk`,
        severity: 'HIGH' as any,
        src: risk.node,
        dst: 'network',
        protocol: 'NETFLOW',
        timestamp: new Date().toISOString(),
        riskScore: risk.risk
      }))
    ].slice(0, 10); // Latest 10

    setAlerts(newAlerts);
    setNetworkStats({
      totalNodes: RISK_HEATMAP.length + Math.floor(Math.random() * 5),
      activeConnections: HETEROGENEOUS_EDGES.length + Math.floor(Math.random() * 10),
      anomalyRate: (Math.random() * 0.15 + 0.05).toFixed(3) as any
    });
  }, []);

  useEffect(() => {
    refreshAlerts(); // Initial load
    
    const interval = setInterval(refreshAlerts, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  return {
    alerts,
    networkStats,
    refreshAlerts,
    isLoading: false
  };
}

