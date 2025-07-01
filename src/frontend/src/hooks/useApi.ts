/**
 * React Query Hooks for API Data Fetching
 * 
 * Enterprise-grade data fetching hooks with caching, error handling,
 * and optimistic updates using React Query.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient } from '../services/api';

// ============================================================================
// Types - Define inline to avoid import issues
// ============================================================================

export interface DashboardMetrics {
  totalUsers: number;
  activeIntegrations: number;
  completedAutomations: number;
  failedAutomations: number;
  costSavings: number;
  successRate?: number;
  avgResponseTime?: string;
  lastUpdated: string;
}

export interface TaskVolumeData {
  date: string;
  googleWorkspace: number;
  microsoft365: number;
  salesforce: number;
  total: number;
}

export interface CostOptimizationData {
  category: string;
  savings: number;
  percentage: number;
}

export interface FailedAutomationData {
  id: string;
  workflowName: string;
  integration: string;
  errorMessage: string;
  timestamp: string;
  retryCount: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  user: string;
  resource: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface UnifiedUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'suspended' | 'inactive';
  integrations: string[];
  licenses: any[];
}

export interface IntegrationStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  lastSync: string;
  userCount: number;
  errorCount: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  nodes: any[];
  connections: any[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  startTime?: string;
  completedAt?: string;
  endTime?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DashboardFilters {
  dateRange: {
    start: string;
    end: string;
  };
  tenants: string[];
  integrations: string[];
  categories: string[];
  status: string[];
}

export interface UserFilters {
  search?: string;
  status?: string[];
  integrations?: string[];
}

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  dashboard: {
    metrics: (tenantId: string, filters?: DashboardFilters) => 
      ['dashboard', 'metrics', tenantId, filters],
    taskVolume: (tenantId: string, timeframe: string) => 
      ['dashboard', 'taskVolume', tenantId, timeframe],
    costOptimization: (tenantId: string) => 
      ['dashboard', 'costOptimization', tenantId],
    failedAutomations: (tenantId: string, pagination?: PaginationParams) => 
      ['dashboard', 'failedAutomations', tenantId, pagination],
    auditLogs: (tenantId: string, pagination?: PaginationParams, filters?: DashboardFilters) => 
      ['dashboard', 'auditLogs', tenantId, pagination, filters],
  },
  users: {
    list: (tenantId: string, pagination?: PaginationParams, filters?: UserFilters) => 
      ['users', tenantId, pagination, filters],
    detail: (tenantId: string, userId: string) => 
      ['users', tenantId, userId],
    licenses: (tenantId: string, userId: string) => 
      ['users', tenantId, userId, 'licenses'],
    automationTriggers: (tenantId: string, userId: string) => 
      ['users', tenantId, userId, 'automationTriggers'],
  },
  integrations: {
    status: (tenantId: string) => 
      ['integrations', tenantId, 'status'],
  },
  workflows: {
    list: (tenantId: string, pagination?: PaginationParams) => 
      ['workflows', tenantId, pagination],
    detail: (tenantId: string, workflowId: string) => 
      ['workflows', tenantId, workflowId],
    executions: (tenantId: string, workflowId: string, pagination?: PaginationParams) => 
      ['workflows', tenantId, workflowId, 'executions', pagination],
    execution: (tenantId: string, workflowId: string, executionId: string) => 
      ['workflows', tenantId, workflowId, 'executions', executionId],
  },
} as const;

// ============================================================================
// Dashboard Hooks
// ============================================================================

export function useDashboardMetrics(
  tenantId: string,
  filters?: DashboardFilters,
  options?: UseQueryOptions<ApiResponse<DashboardMetrics>>
) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return {
      data: {
        data: {
          totalUsers: 1250,
          activeIntegrations: 3,
          completedAutomations: 15420,
          failedAutomations: 23,
          costSavings: 125000,
          lastUpdated: '2024-01-15T10:30:00Z',
        }
      },
      isLoading: false,
      error: null
    };
  }
  return useQuery({
    queryKey: queryKeys.dashboard.metrics(tenantId, filters),
    queryFn: () => apiClient.getDashboardMetrics(tenantId, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

export function useTaskVolumeData(
  tenantId: string,
  timeframe: 'day' | 'week' | 'month' | 'quarter' = 'week',
  options?: UseQueryOptions<ApiResponse<TaskVolumeData[]>>
) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return {
      data: {
        data: [
          { date: '2025-06-21', volume: 120 },
          { date: '2025-06-22', volume: 85 },
          { date: '2025-06-23', volume: 145 },
          { date: '2025-06-24', volume: 170 },
        ]
      },
      isLoading: false,
      error: null
    };
  }
  return useQuery({
    queryKey: queryKeys.dashboard.taskVolume(tenantId, timeframe),
    queryFn: () => apiClient.getTaskVolumeData(tenantId, timeframe),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

export function useCostOptimizationData(
  tenantId: string,
  options?: UseQueryOptions<ApiResponse<CostOptimizationData[]>>
) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return {
      data: {
        data: [
          { category: 'HR Software', amount: 4200 },
          { category: 'Sales Tools', amount: 3100 },
          { category: 'Cloud Infra', amount: 9800 },
        ]
      },
      isLoading: false,
      error: null
    };
  }
  return useQuery({
    queryKey: queryKeys.dashboard.costOptimization(tenantId),
    queryFn: () => apiClient.getCostOptimizationData(tenantId),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

export function useFailedAutomations(
  tenantId: string,
  pagination?: PaginationParams,
  options?: UseQueryOptions<ApiResponse<FailedAutomationData[]>>
) {
  return useQuery({
    queryKey: queryKeys.dashboard.failedAutomations(tenantId, pagination),
    queryFn: () => apiClient.getFailedAutomations(tenantId, pagination),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useAuditLogs(
  tenantId: string,
  pagination?: PaginationParams,
  filters?: DashboardFilters,
  options?: UseQueryOptions<ApiResponse<AuditLogEntry[]>>
) {
  return useQuery({
    queryKey: queryKeys.dashboard.auditLogs(tenantId, pagination, filters),
    queryFn: () => apiClient.getAuditLogs(tenantId, pagination, filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// ============================================================================
// User Management Hooks
// ============================================================================

export function useUsers(
  tenantId: string,
  pagination?: PaginationParams,
  filters?: UserFilters,
  options?: UseQueryOptions<ApiResponse<UnifiedUser[]>>
) {
  return useQuery({
    queryKey: queryKeys.users.list(tenantId, pagination, filters),
    queryFn: () => apiClient.getUsers(tenantId, pagination, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

export function useUser(
  tenantId: string,
  userId: string,
  options?: UseQueryOptions<ApiResponse<UnifiedUser>>
) {
  return useQuery({
    queryKey: queryKeys.users.detail(tenantId, userId),
    queryFn: () => apiClient.getUser(tenantId, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userId,
    ...options,
  });
}

export function useUserLicenses(
  tenantId: string,
  userId: string,
  options?: UseQueryOptions<ApiResponse<any[]>>
) {
  return useQuery({
    queryKey: queryKeys.users.licenses(tenantId, userId),
    queryFn: () => apiClient.getUserLicenses(tenantId, userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!userId,
    ...options,
  });
}

export function useUserAutomationTriggers(
  tenantId: string,
  userId: string,
  options?: UseQueryOptions<ApiResponse<any[]>>
) {
  return useQuery({
    queryKey: queryKeys.users.automationTriggers(tenantId, userId),
    queryFn: () => apiClient.getUserAutomationTriggers(tenantId, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userId,
    ...options,
  });
}

// ============================================================================
// Integration Hooks
// ============================================================================

export function useIntegrationStatus(
  tenantId: string,
  options?: UseQueryOptions<ApiResponse<IntegrationStatus[]>>
) {
  return useQuery({
    queryKey: queryKeys.integrations.status(tenantId),
    queryFn: () => apiClient.getIntegrationStatus(tenantId),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    ...options,
  });
}

// ============================================================================
// Workflow Hooks
// ============================================================================

export function useWorkflows(
  tenantId: string,
  pagination?: PaginationParams,
  options?: UseQueryOptions<ApiResponse<WorkflowDefinition[]>>
) {
  return useQuery({
    queryKey: queryKeys.workflows.list(tenantId, pagination),
    queryFn: () => apiClient.getWorkflows(tenantId, pagination),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

export function useWorkflow(
  tenantId: string,
  workflowId: string,
  options?: UseQueryOptions<ApiResponse<WorkflowDefinition>>
) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(tenantId, workflowId),
    queryFn: () => apiClient.getWorkflow(tenantId, workflowId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!workflowId,
    ...options,
  });
}

export function useWorkflowExecutions(
  tenantId: string,
  workflowId: string,
  pagination?: PaginationParams,
  options?: UseQueryOptions<ApiResponse<WorkflowExecution[]>>
) {
  return useQuery({
    queryKey: queryKeys.workflows.executions(tenantId, workflowId, pagination),
    queryFn: () => apiClient.getWorkflowExecutions(tenantId, workflowId, pagination),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!workflowId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useSuspendUser(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; userId: string; reason?: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, userId, reason }) => 
      apiClient.suspendUser(tenantId, userId, reason),
    onSuccess: (_, { tenantId, userId }) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(tenantId, userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list(tenantId) });
    },
    ...options,
  });
}

export function useUnsuspendUser(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; userId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, userId }) => 
      apiClient.unsuspendUser(tenantId, userId),
    onSuccess: (_, { tenantId, userId }) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(tenantId, userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list(tenantId) });
    },
    ...options,
  });
}

export function useDeleteUser(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; userId: string; transferData?: boolean }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, userId, transferData }) => 
      apiClient.deleteUser(tenantId, userId, transferData),
    onSuccess: (_, { tenantId }) => {
      // Invalidate and refetch user list
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list(tenantId) });
    },
    ...options,
  });
}

export function useAssignLicense(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; userId: string; licenseId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, userId, licenseId }) => 
      apiClient.assignLicense(tenantId, userId, licenseId),
    onSuccess: (_, { tenantId, userId }) => {
      // Invalidate and refetch license data
      queryClient.invalidateQueries({ queryKey: queryKeys.users.licenses(tenantId, userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(tenantId, userId) });
    },
    ...options,
  });
}

export function useRevokeLicense(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; userId: string; licenseId: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, userId, licenseId }) => 
      apiClient.revokeLicense(tenantId, userId, licenseId),
    onSuccess: (_, { tenantId, userId }) => {
      // Invalidate and refetch license data
      queryClient.invalidateQueries({ queryKey: queryKeys.users.licenses(tenantId, userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(tenantId, userId) });
    },
    ...options,
  });
}

export function useSyncIntegration(
  options?: UseMutationOptions<ApiResponse<void>, Error, { tenantId: string; integration: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, integration }) => 
      apiClient.syncIntegration(tenantId, integration),
    onSuccess: (_, { tenantId }) => {
      // Invalidate integration status
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status(tenantId) });
    },
    ...options,
  });
}

export function useTestIntegrationConnection(
  options?: UseMutationOptions<ApiResponse<{ status: string; latency: number }>, Error, { tenantId: string; integration: string }>
) {
  return useMutation({
    mutationFn: ({ tenantId, integration }) => 
      apiClient.testIntegrationConnection(tenantId, integration),
    ...options,
  });
}

export function useCreateWorkflow(
  options?: UseMutationOptions<ApiResponse<WorkflowDefinition>, Error, { tenantId: string; workflow: Partial<WorkflowDefinition> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, workflow }) => 
      apiClient.createWorkflow(tenantId, workflow),
    onSuccess: (_, { tenantId }) => {
      // Invalidate workflow list
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(tenantId) });
    },
    ...options,
  });
}

export function useUpdateWorkflow(
  options?: UseMutationOptions<ApiResponse<WorkflowDefinition>, Error, { tenantId: string; workflowId: string; workflow: Partial<WorkflowDefinition> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, workflowId, workflow }) => 
      apiClient.updateWorkflow(tenantId, workflowId, workflow),
    onSuccess: (_, { tenantId, workflowId }) => {
      // Invalidate workflow data
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(tenantId, workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(tenantId) });
    },
    ...options,
  });
}

export function useExecuteWorkflow(
  options?: UseMutationOptions<ApiResponse<WorkflowExecution>, Error, { tenantId: string; workflowId: string; input?: Record<string, any> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tenantId, workflowId, input }) => 
      apiClient.executeWorkflow(tenantId, workflowId, input),
    onSuccess: (_, { tenantId, workflowId }) => {
      // Invalidate execution list
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.executions(tenantId, workflowId) });
    },
    ...options,
  });
} 