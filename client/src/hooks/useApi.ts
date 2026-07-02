import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: () => api.getDashboardMetrics(),
    refetchInterval: 5000,
  });
}

export function useAlerts(severity?: string, status?: string) {
  return useQuery({
    queryKey: ["alerts", severity, status],
    queryFn: () => api.getAlerts({ severity, status, limit: 50 }),
    refetchInterval: 3000,
  });
}

export function useNetworkNodes(status?: string) {
  return useQuery({
    queryKey: ["network", "nodes", status],
    queryFn: () => api.getNetworkNodes({ status, limit: 100 }),
    refetchInterval: 5000,
  });
}

export function useTopology() {
  return useQuery({
    queryKey: ["network", "topology"],
    queryFn: () => api.getTopology(),
    refetchInterval: 5000,
  });
}

export function usePredictions() {
  return useQuery({
    queryKey: ["predictions"],
    queryFn: () => api.getPredictions(50),
    refetchInterval: 5000,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.getMetrics(),
    refetchInterval: 10000,
  });
}

export function useTrainingRuns() {
  return useQuery({
    queryKey: ["training", "runs"],
    queryFn: () => api.getTrainingRuns(),
    refetchInterval: 3000,
  });
}

export function useRiskScores(entityType?: string) {
  return useQuery({
    queryKey: ["risk", entityType],
    queryFn: () => api.getRiskScores(entityType),
    refetchInterval: 5000,
  });
}

export function usePredict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { features: Record<string, unknown>; graphSnapshot?: Record<string, unknown> }) =>
      api.predict(params.features, params.graphSnapshot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useStartTraining() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.startTraining.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training"] });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateAlert(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.getDatasets(),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.getHealth(),
    refetchInterval: 15000,
  });
}
