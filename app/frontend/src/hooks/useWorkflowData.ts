import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkflowMetrics,
  fetchWorkflowLogs,
  optimizeWorkflow,
  WorkflowMetrics,
  WorkflowLog,
  OptimizationResponse,
} from '../api/workflow';
import { websocketService } from '../services/websocket';
import { DASHBOARD_CONFIG, ALERT_CONFIG } from '../config';
import { handleApiError } from '../api/workflow';

interface UseWorkflowDataProps {
  timeRange: string;
  workflowId?: number;
}

interface CustomEvent extends Event {
  error?: Error;
}

export const useWorkflowData = ({ timeRange, workflowId }: UseWorkflowDataProps) => {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch workflow metrics
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    error: metricsError,
  } = useQuery<WorkflowMetrics[]>(
    ['workflowMetrics', timeRange, workflowId],
    async () => {
      if (workflowId) {
        const data = await fetchWorkflowMetrics(timeRange, workflowId);
        return Array.isArray(data) ? data : [data];
      }
      const data = await fetchWorkflowMetrics(timeRange);
      return Array.isArray(data) ? data : [data];
    },
    {
      refetchInterval: DASHBOARD_CONFIG.refreshInterval,
      staleTime: DASHBOARD_CONFIG.refreshInterval / 2,
    }
  );

  // Fetch workflow logs
  const {
    data: logs,
    isLoading: isLogsLoading,
    error: logsError,
  } = useQuery<WorkflowLog[]>(
    ['workflowLogs', timeRange],
    async () => {
      const data = await fetchWorkflowLogs(timeRange);
      return Array.isArray(data) ? data : [data];
    },
    {
      refetchInterval: DASHBOARD_CONFIG.refreshInterval,
      staleTime: DASHBOARD_CONFIG.refreshInterval / 2,
    }
  );

  // Optimize workflow mutation
  const optimizeMutation = useMutation<OptimizationResponse, Error, string>(
    (id: string) => optimizeWorkflow(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['workflowMetrics']);
        queryClient.invalidateQueries(['workflowLogs']);
      },
    }
  );

  // WebSocket connection management
  useEffect(() => {
    const handleMetricsUpdate = (data: any) => {
      if (!workflowId || data.workflow_id === workflowId) {
        queryClient.setQueryData(['workflowMetrics', timeRange, workflowId], (oldMetrics: WorkflowMetrics[] | undefined) => {
          const newMetrics = Array.isArray(data.metrics) ? data.metrics : [data.metrics];
          return oldMetrics ? [...newMetrics, ...oldMetrics].slice(0, ALERT_CONFIG.maxAlerts) : newMetrics;
        });
      }
    };

    const handleLogsUpdate = (data: any) => {
      if (!workflowId || data.workflow_id === workflowId) {
        queryClient.setQueryData(['workflowLogs', timeRange], (oldLogs: WorkflowLog[] | undefined) => {
          const newLog = data.log;
          return oldLogs ? [newLog, ...oldLogs].slice(0, ALERT_CONFIG.maxAlerts) : [newLog];
        });
      }
    };

    const handleConnect = () => setWsConnected(true);
    const handleDisconnect = () => setWsConnected(false);
    const handleError = (event: CustomEvent) => {
      console.error('WebSocket error:', event.error);
      setWsConnected(false);
    };

    // Subscribe to WebSocket events
    const unsubscribeMetrics = websocketService.subscribe('metrics_update', handleMetricsUpdate);
    const unsubscribeLogs = websocketService.subscribe('log_update', handleLogsUpdate);

    // Add event listeners
    window.addEventListener('ws:connect', handleConnect);
    window.addEventListener('ws:disconnect', handleDisconnect);
    window.addEventListener('ws:error', handleError as EventListener);

    // Cleanup function
    return () => {
      unsubscribeMetrics();
      unsubscribeLogs();
      window.removeEventListener('ws:connect', handleConnect);
      window.removeEventListener('ws:disconnect', handleDisconnect);
      window.removeEventListener('ws:error', handleError as EventListener);
    };
  }, [timeRange, workflowId, queryClient]);

  // Error handling
  const handleError = useCallback((error: unknown) => {
    const errorMessage = handleApiError(error);
    console.error(errorMessage);
  }, []);

  useEffect(() => {
    if (metricsError) handleError(metricsError);
    if (logsError) handleError(logsError);
  }, [metricsError, logsError, handleError]);

  return {
    metrics,
    logs,
    isLoading: isMetricsLoading || isLogsLoading,
    error: metricsError || logsError,
    optimizeWorkflow: (id: string) => optimizeMutation.mutateAsync(id),
    isOptimizing: optimizeMutation.isLoading,
    optimizeError: optimizeMutation.error,
    wsConnected,
  };
}; 