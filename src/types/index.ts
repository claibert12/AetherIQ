// Core system types for AetherIQ Automation Brain
export * from './workflow.types';
export * from './task.types';
export * from './agent.types';
export * from './billing.types';
export * from './integration.types';
export * from './auth.types';

// Base response interface
export interface AetherIQResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
  requestId: string;
  executionTime?: number;
}

// Error handling
export interface AetherIQError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
  service: string;
}

// Configuration types
export interface SystemConfig {
  region: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
} 