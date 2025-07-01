// Task Engine Types
export interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  config: TaskConfig;
  metadata: TaskMetadata;
}

export type TaskType = 
  | 'user_provision' 
  | 'user_deprovision' 
  | 'license_assign'
  | 'license_revoke'
  | 'google_workspace_user_create'
  | 'microsoft365_user_create'
  | 'salesforce_lead_create'
  | 'email_send'
  | 'webhook_call'
  | 'data_transform'
  | 'conditional'
  | 'delay'
  | 'parallel'
  | 'loop';

export interface TaskConfig {
  [key: string]: any;
  // Common fields
  timeout?: number;
  retryConfig?: RetryConfig;
  // Integration specific
  integrationId?: string;
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  // Transform specific
  transformExpression?: string;
  // Conditional specific
  condition?: string;
  // Delay specific
  delayMs?: number;
}

export interface TaskMetadata {
  category: TaskCategory;
  version: string;
  author: string;
  documentation?: string;
  icon?: string;
  tags: string[];
  inputs: TaskParameter[];
  outputs: TaskParameter[];
}

export type TaskCategory = 
  | 'user_management'
  | 'license_management' 
  | 'integration'
  | 'communication'
  | 'data_processing'
  | 'control_flow'
  | 'utility';

export interface TaskParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: ParameterValidation;
}

export type ParameterType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array'
  | 'email'
  | 'url'
  | 'date'
  | 'json';

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: any[];
}

// Task Execution Runtime
export interface TaskExecutionContext {
  taskId: string;
  workflowExecutionId: string;
  organizationId: string;
  userId?: string;
  input: TaskInput;
  environment: TaskEnvironment;
  secrets: Record<string, string>;
  startTime: number;
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

export interface TaskInput {
  [key: string]: any;
  // Standard fields available to all tasks
  trigger?: any;
  previousTaskOutputs?: Record<string, any>;
  workflowContext?: Record<string, any>;
}

export interface TaskEnvironment {
  region: string;
  stage: 'development' | 'staging' | 'production';
  logLevel: string;
  integrations: Record<string, IntegrationConfig>;
}

export interface IntegrationConfig {
  enabled: boolean;
  baseUrl?: string;
  apiVersion?: string;
  rateLimits?: RateLimitConfig;
  auth?: AuthConfig;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

export interface AuthConfig {
  type: 'oauth2' | 'api_key' | 'bearer' | 'basic';
  credentials: Record<string, string>;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  error?: TaskError;
  metadata: TaskResultMetadata;
}

export interface TaskError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  category: ErrorCategory;
}

export type ErrorCategory = 
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'integration'
  | 'internal'
  | 'user_error';

export interface TaskResultMetadata {
  executionTimeMs: number;
  retryCount: number;
  resourceUsage: TaskResourceUsage;
  logs: TaskLogEntry[];
}

export interface TaskResourceUsage {
  cpuTimeMs: number;
  memoryMb: number;
  networkCallsCount: number;
  dataTransferredBytes: number;
}

export interface TaskLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: any;
} 