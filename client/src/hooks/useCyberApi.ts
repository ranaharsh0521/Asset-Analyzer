/**
 * React hooks for Cyber Attack Prediction API
 */

import { useState, useEffect, useCallback } from 'react';
import { cyberAPI, type NetworkTrafficData, type PredictionResult, type Alert, type Statistics } from '../lib/cyberApi';

interface UsePredictionResult {
  predict: (data: NetworkTrafficData) => Promise<PredictionResult | null>;
  prediction: PredictionResult | null;
  loading: boolean;
  error: string | null;
}

export function usePrediction(): UsePredictionResult {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (data: NetworkTrafficData): Promise<PredictionResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await cyberAPI.predict(data);
      setPrediction(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prediction failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { predict, prediction, loading, error };
}

interface UseAlertsResult {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
}

export function useAlerts(severity?: string, autoRefresh: boolean = false): UseAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await cyberAPI.getAlerts(severity);
      setAlerts(result.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [severity]);

  const removeAlert = useCallback(async (id: string) => {
    try {
      await cyberAPI.deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  return { alerts, loading, error, refresh, removeAlert };
}

interface UseStatisticsResult {
  statistics: Statistics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStatistics(): UseStatisticsResult {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await cyberAPI.getStatistics();
      setStatistics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { statistics, loading, error, refresh };
}

interface UseSimulationResult {
  simulate: (attackType?: string, count?: number) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useSimulation(): UseSimulationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = useCallback(async (attackType?: string, count: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      await cyberAPI.simulateAttack(attackType, count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { simulate, loading, error };
}

interface UseHealthResult {
  isHealthy: boolean;
  modelLoaded: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useHealth(): UseHealthResult {
  const [isHealthy, setIsHealthy] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const health = await cyberAPI.healthCheck();
      setIsHealthy(health.status === 'healthy');
      setModelLoaded(health.model_loaded);
    } catch {
      setIsHealthy(false);
      setModelLoaded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { isHealthy, modelLoaded, loading, refresh };
}
