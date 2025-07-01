// Workflow Execution Types for executeTask Lambda
export interface ExecuteTaskRequest {
  runId: string;                 // UUID for this workflow run
  workflowId: string;            // which workflow graph to execute
  tenantId: string;              // org / workspace
  startNodeId?: string | undefined;          // optional resume point
  payload: Record<string, any>;  // initial trigger data
}

export interface ExecuteTaskResponse {
  runId: string;
  status: RunStatus;
  startedAt: string;  // ISO
  finishedAt?: string | undefined;
  error?: { message: string; stepId?: string } | undefined;
}

export enum RunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING', 
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  tenantId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string | undefined;
  startNodeId?: string | undefined;
  payload: Record<string, any>;
  error?: { message: string; stepId?: string } | undefined;
  // DynamoDB metadata
  ttl?: number | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface MeteringEvent {
  eventType: 'task_enqueued' | 'task_started' | 'task_completed' | 'task_failed';
  tenantId: string;
  runId: string;
  workflowId: string;
  timestamp: string;
  metadata?: Record<string, any> | undefined;
}

// Workflow Worker Types - Graph Execution Engine
export interface WorkflowGraph {
  id: string;
  version: string;
  name: string;
  description: string;
  tenantId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  config: WorkflowGraphConfig;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  config: NodeConfig;
  position: { x: number; y: number };
  metadata: NodeMetadata;
}

export enum NodeType {
  // Control Flow
  START = 'START',
  END = 'END',
  CONDITION = 'CONDITION',
  PARALLEL = 'PARALLEL',
  DELAY = 'DELAY',
  
  // Actions
  API_CALL = 'API_CALL',
  WEBHOOK = 'WEBHOOK',
  EMAIL = 'EMAIL',
  DATA_TRANSFORM = 'DATA_TRANSFORM',
  
  // Integrations
  GOOGLE_WORKSPACE = 'GOOGLE_WORKSPACE',
  MICROSOFT365 = 'MICROSOFT365',
  SALESFORCE = 'SALESFORCE',
  
  // User Management
  USER_PROVISION = 'USER_PROVISION',
  USER_DEPROVISION = 'USER_DEPROVISION',
  LICENSE_ASSIGN = 'LICENSE_ASSIGN',
  LICENSE_REVOKE = 'LICENSE_REVOKE'
}

export interface NodeConfig {
  [key: string]: any;
  timeout?: number;
  retryConfig?: RetryConfig;
  // API-specific
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  // Integration-specific
  integration?: string;
  action?: string;
  parameters?: Record<string, any>;
  // Condition-specific
  expression?: string;
  // Transform-specific
  transformScript?: string;
}

export interface NodeMetadata {
  category: string;
  description?: string;
  inputs: ParameterDefinition[];
  outputs: ParameterDefinition[];
  errorCodes: string[];
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition?: EdgeCondition;
  label?: string;
}

export interface EdgeCondition {
  type: 'success' | 'failure' | 'always' | 'expression';
  expression?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  delayMs: number;
  retryableErrors?: string[];
}

export interface WorkflowGraphConfig {
  maxExecutionTimeMs: number;
  maxConcurrentNodes: number;
  errorStrategy: 'stop' | 'continue' | 'rollback';
  enableRollback: boolean;
  auditLevel: 'minimal' | 'standard' | 'detailed';
}

// Execution State Management
export interface NodeExecution {
  nodeId: string;
  runId: string;
  status: NodeExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: NodeExecutionError;
  retryCount: number;
  executionTimeMs?: number;
  resourceUsage?: ResourceUsage;
}

export enum NodeExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  RETRYING = 'RETRYING'
}

export interface NodeExecutionError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  category: 'validation' | 'authentication' | 'network' | 'timeout' | 'integration' | 'internal';
}

export interface ResourceUsage {
  cpuTimeMs: number;
  memoryUsageMb: number;
  networkCalls: number;
  dataTransferBytes: number;
}

// Execution Context
export interface ExecutionContext {
  runId: string;
  workflowId: string;
  tenantId: string;
  startNodeId?: string;
  payload: Record<string, any>;
  variables: Record<string, any>;
  secrets: Record<string, string>;
  integrations: Record<string, IntegrationContext>;
  startTime: number;
  timeoutAt: number;
}

export interface IntegrationContext {
  enabled: boolean;
  baseUrl?: string;
  apiVersion?: string;
  rateLimits?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  credentials: Record<string, string>;
}

// Worker-specific Events
export interface WorkflowProgressEvent {
  eventType: 'node_started' | 'node_completed' | 'node_failed';
  tenantId: string;
  runId: string;
  workflowId: string;
  timestamp: string;
  nodeId: string;
  progress: {
    completedNodes: number;
    totalNodes: number;
    currentNode: string;
  };
} 