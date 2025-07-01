/**
 * API Service Layer
 * 
 * Enterprise-grade API client for AetherIQ frontend.
 * Handles authentication, error handling, retries, and type-safe requests.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Import types from hooks file since they're defined there
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
// API Configuration
// ============================================================================

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          // TODO: Implement token refresh logic
          return Promise.reject(error);
        }

        // Handle network errors with retry
        if (!error.response && originalRequest._retryCount < MAX_RETRIES) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          const delay = Math.pow(2, originalRequest._retryCount) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(originalRequest);
        }

        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.error?.message || data?.message || `HTTP ${status} Error`;
      return new Error(`API Error: ${message}`);
    } else if (error.request) {
      // Network error
      return new Error('Network Error: Unable to connect to server');
    } else {
      // Request setup error
      return new Error(`Request Error: ${error.message}`);
    }
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  public clearAuthToken(): void {
    this.authToken = null;
  }

  private async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ============================================================================
  // Dashboard API Methods
  // ============================================================================

  public async getDashboardMetrics(
    tenantId: string,
    filters?: DashboardFilters
  ): Promise<ApiResponse<DashboardMetrics>> {
    return this.request<DashboardMetrics>({
      method: 'GET',
      url: `/dashboard/metrics/${tenantId}`,
      params: filters,
    });
  }

  public async getTaskVolumeData(
    tenantId: string,
    timeframe: 'day' | 'week' | 'month' | 'quarter' = 'week'
  ): Promise<ApiResponse<TaskVolumeData[]>> {
    return this.request<TaskVolumeData[]>({
      method: 'GET',
      url: `/dashboard/task-volume/${tenantId}`,
      params: { timeframe },
    });
  }

  public async getCostOptimizationData(
    tenantId: string
  ): Promise<ApiResponse<CostOptimizationData[]>> {
    return this.request<CostOptimizationData[]>({
      method: 'GET',
      url: `/dashboard/cost-optimization/${tenantId}`,
    });
  }

  public async getFailedAutomations(
    tenantId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<FailedAutomationData[]>> {
    return this.request<FailedAutomationData[]>({
      method: 'GET',
      url: `/dashboard/failed-automations/${tenantId}`,
      params: pagination,
    });
  }

  public async getAuditLogs(
    tenantId: string,
    pagination?: PaginationParams,
    filters?: DashboardFilters
  ): Promise<ApiResponse<AuditLogEntry[]>> {
    return this.request<AuditLogEntry[]>({
      method: 'GET',
      url: `/dashboard/audit-logs/${tenantId}`,
      params: { ...pagination, ...filters },
    });
  }

  // ============================================================================
  // User Management API Methods
  // ============================================================================

  public async getUsers(
    tenantId: string,
    pagination?: PaginationParams,
    filters?: UserFilters
  ): Promise<ApiResponse<UnifiedUser[]>> {
    return this.request<UnifiedUser[]>({
      method: 'GET',
      url: `/users/${tenantId}`,
      params: { ...pagination, ...filters },
    });
  }

  public async getUser(
    tenantId: string,
    userId: string
  ): Promise<ApiResponse<UnifiedUser>> {
    return this.request<UnifiedUser>({
      method: 'GET',
      url: `/users/${tenantId}/${userId}`,
    });
  }

  public async suspendUser(
    tenantId: string,
    userId: string,
    reason?: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'POST',
      url: `/users/${tenantId}/${userId}/suspend`,
      data: { reason },
    });
  }

  public async unsuspendUser(
    tenantId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'POST',
      url: `/users/${tenantId}/${userId}/unsuspend`,
    });
  }

  public async deleteUser(
    tenantId: string,
    userId: string,
    transferData?: boolean
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      url: `/users/${tenantId}/${userId}`,
      data: { transferData },
    });
  }

  public async getUserLicenses(
    tenantId: string,
    userId: string
  ): Promise<ApiResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      url: `/users/${tenantId}/${userId}/licenses`,
    });
  }

  public async assignLicense(
    tenantId: string,
    userId: string,
    licenseId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'POST',
      url: `/users/${tenantId}/${userId}/licenses`,
      data: { licenseId },
    });
  }

  public async revokeLicense(
    tenantId: string,
    userId: string,
    licenseId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      url: `/users/${tenantId}/${userId}/licenses/${licenseId}`,
    });
  }

  // ============================================================================
  // Integration Status API Methods
  // ============================================================================

  public async getIntegrationStatus(
    tenantId: string
  ): Promise<ApiResponse<IntegrationStatus[]>> {
    return this.request<IntegrationStatus[]>({
      method: 'GET',
      url: `/integrations/${tenantId}/status`,
    });
  }

  public async syncIntegration(
    tenantId: string,
    integration: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'POST',
      url: `/integrations/${tenantId}/${integration}/sync`,
    });
  }

  public async testIntegrationConnection(
    tenantId: string,
    integration: string
  ): Promise<ApiResponse<{ status: string; latency: number }>> {
    return this.request<{ status: string; latency: number }>({
      method: 'POST',
      url: `/integrations/${tenantId}/${integration}/test`,
    });
  }

  // ============================================================================
  // Workflow API Methods
  // ============================================================================

  public async getWorkflows(
    tenantId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<WorkflowDefinition[]>> {
    return this.request<WorkflowDefinition[]>({
      method: 'GET',
      url: `/workflows/${tenantId}`,
      params: pagination,
    });
  }

  public async getWorkflow(
    tenantId: string,
    workflowId: string
  ): Promise<ApiResponse<WorkflowDefinition>> {
    return this.request<WorkflowDefinition>({
      method: 'GET',
      url: `/workflows/${tenantId}/${workflowId}`,
    });
  }

  public async createWorkflow(
    tenantId: string,
    workflow: Partial<WorkflowDefinition>
  ): Promise<ApiResponse<WorkflowDefinition>> {
    return this.request<WorkflowDefinition>({
      method: 'POST',
      url: `/workflows/${tenantId}`,
      data: workflow,
    });
  }

  public async updateWorkflow(
    tenantId: string,
    workflowId: string,
    workflow: Partial<WorkflowDefinition>
  ): Promise<ApiResponse<WorkflowDefinition>> {
    return this.request<WorkflowDefinition>({
      method: 'PUT',
      url: `/workflows/${tenantId}/${workflowId}`,
      data: workflow,
    });
  }

  public async deleteWorkflow(
    tenantId: string,
    workflowId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      url: `/workflows/${tenantId}/${workflowId}`,
    });
  }

  public async executeWorkflow(
    tenantId: string,
    workflowId: string,
    input?: Record<string, any>
  ): Promise<ApiResponse<WorkflowExecution>> {
    return this.request<WorkflowExecution>({
      method: 'POST',
      url: `/workflows/${tenantId}/${workflowId}/execute`,
      data: { input },
    });
  }

  public async getWorkflowExecutions(
    tenantId: string,
    workflowId: string,
    pagination?: PaginationParams
  ): Promise<ApiResponse<WorkflowExecution[]>> {
    return this.request<WorkflowExecution[]>({
      method: 'GET',
      url: `/workflows/${tenantId}/${workflowId}/executions`,
      params: pagination,
    });
  }

  public async getWorkflowExecution(
    tenantId: string,
    workflowId: string,
    executionId: string
  ): Promise<ApiResponse<WorkflowExecution>> {
    return this.request<WorkflowExecution>({
      method: 'GET',
      url: `/workflows/${tenantId}/${workflowId}/executions/${executionId}`,
    });
  }

  // ============================================================================
  // Automation Trigger API Methods
  // ============================================================================

  public async getUserAutomationTriggers(
    tenantId: string,
    userId: string
  ): Promise<ApiResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      url: `/users/${tenantId}/${userId}/automation-triggers`,
    });
  }

  public async createAutomationTrigger(
    tenantId: string,
    userId: string,
    trigger: any
  ): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: `/users/${tenantId}/${userId}/automation-triggers`,
      data: trigger,
    });
  }

  public async updateAutomationTrigger(
    tenantId: string,
    userId: string,
    triggerId: string,
    trigger: any
  ): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      url: `/users/${tenantId}/${userId}/automation-triggers/${triggerId}`,
      data: trigger,
    });
  }

  public async deleteAutomationTrigger(
    tenantId: string,
    userId: string,
    triggerId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      url: `/users/${tenantId}/${userId}/automation-triggers/${triggerId}`,
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiClient = new ApiClient();
export default apiClient; 