// Workflow Builder Types
export interface Workflow {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: WorkflowStatus;
  triggers: WorkflowTrigger[];
  tasks: WorkflowTask[];
  dependencies: WorkflowDependency[];
  config: WorkflowConfig;
}

export type WorkflowStatus = 
  | 'draft' 
  | 'active' 
  | 'paused' 
  | 'archived' 
  | 'error';

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
  enabled: boolean;
}

export type TriggerType = 
  | 'schedule' 
  | 'webhook' 
  | 'email' 
  | 'file_upload' 
  | 'user_action'
  | 'system_event';

export interface TriggerConfig {
  [key: string]: any;
  // Schedule specific
  cronExpression?: string;
  timezone?: string;
  // Webhook specific
  url?: string;
  secret?: string;
  // Event specific
  eventType?: string;
}

export interface WorkflowTask {
  id: string;
  name: string;
  type: TaskType;
  config: TaskConfig;
  position: TaskPosition;
  dependencies: string[]; // Task IDs this task depends on
  timeout: number;
  retryConfig: RetryConfig;
}

export type TaskType = 
  | 'user_provision' 
  | 'user_deprovision' 
  | 'license_assign'
  | 'license_revoke'
  | 'email_send'
  | 'webhook_call'
  | 'data_transform'
  | 'conditional'
  | 'delay'
  | 'parallel'
  | 'loop';

export interface TaskConfig {
  [key: string]: any;
}

export interface TaskPosition {
  x: number;
  y: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  delayMs: number;
}

export interface WorkflowDependency {
  fromTaskId: string;
  toTaskId: string;
  condition?: DependencyCondition;
}

export interface DependencyCondition {
  type: 'success' | 'failure' | 'always' | 'custom';
  expression?: string; // For custom conditions
}

export interface WorkflowConfig {
  maxExecutionTime: number;
  maxConcurrentTasks: number;
  errorHandling: ErrorHandlingStrategy;
  notificationSettings: NotificationSettings;
}

export type ErrorHandlingStrategy = 'stop' | 'continue' | 'retry' | 'skip';

export interface NotificationSettings {
  onSuccess: boolean;
  onFailure: boolean;
  onStart: boolean;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook';
  config: any;
}

// Workflow Execution Types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  context: ExecutionContext;
  taskExecutions: TaskExecution[];
  metadata: ExecutionMetadata;
}

export type ExecutionStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'timeout';

export interface ExecutionContext {
  [key: string]: any;
  triggerData?: any;
  organizationId: string;
  userId?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  input: any;
  output?: any;
  error?: string;
  retryCount: number;
}

export interface ExecutionMetadata {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  executionTimeMs: number;
  resourceUsage: ResourceUsage;
}

export interface ResourceUsage {
  cpuTime: number;
  memoryMb: number;
  networkCalls: number;
  storageOperations: number;
} 