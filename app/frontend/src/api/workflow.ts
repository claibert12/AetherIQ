import axios, { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface WorkflowMetrics {
  id: string;
  workflowId: number;
  executionTime: number;
  cpuUsage: number;
  memoryUsage: number;
  ioOperations: number;
  timestamp: string;
}

export interface WorkflowLog {
  id: string;
  workflowId: number;
  message: string;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OptimizationSuggestion {
  type: string;
  priority: string;
  description: string;
  suggestion: string;
  potential_savings: string;
}

export interface OptimizationResponse {
  suggestions: OptimizationSuggestion[];
}

// API functions
export const fetchWorkflowMetrics = async (timeRange: string, workflowId?: number): Promise<WorkflowMetrics[]> => {
  try {
    const endpoint = workflowId 
      ? `/api/workflows/${workflowId}/metrics` 
      : '/api/workflows/metrics';
    const response = await api.get(`${endpoint}?timeRange=${timeRange}`);
    const data = response.data;
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('Error fetching workflow metrics:', error);
    throw error;
  }
};

export const fetchWorkflowLogs = async (timeRange: string, workflowId?: number): Promise<WorkflowLog[]> => {
  try {
    const endpoint = workflowId 
      ? `/api/workflows/${workflowId}/logs` 
      : '/api/workflows/logs';
    const response = await api.get(`${endpoint}?timeRange=${timeRange}`);
    const data = response.data;
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('Error fetching workflow logs:', error);
    throw error;
  }
};

export const optimizeWorkflow = async (workflowId: string): Promise<OptimizationResponse> => {
  try {
    const response = await api.post(`/api/workflows/${workflowId}/optimize`);
    return response.data;
  } catch (error) {
    console.error('Error optimizing workflow:', error);
    throw error;
  }
};

// WebSocket connection for real-time updates
export const createWorkflowWebSocket = (): WebSocket => {
  const token = localStorage.getItem('auth_token');
  const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/ws/workflows?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  return ws;
};

// Error handling utility
export const handleApiError = (error: any): string => {
  if (error.response) {
    const data = error.response.data;
    return data.message || data.error || 'An error occurred while processing your request';
  }
  if (error.request) {
    return 'No response received from server. Please check your connection.';
  }
  return error.message || 'An unexpected error occurred';
}; 