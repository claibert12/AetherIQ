import {
  Task,
  TaskExecutionContext,
  TaskResult,
  TaskError,
  RetryConfig,
  TaskResourceUsage,
  TaskLogEntry,
} from '../types';

/**
 * TaskEngine - Executes individual tasks with retry logic and resource management
 * 
 * Handles:
 * - Task execution
 * - Retry logic with backoff strategies
 * - Resource monitoring
 * - Error handling and logging
 */
export class TaskEngine {
  private executionCounter = 0;
  private resourceMonitor: ResourceMonitor;

  constructor() {
    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Execute a single task with full context and monitoring
   */
  public async executeTask(
    task: Task,
    context: TaskExecutionContext
  ): Promise<TaskResult> {
    const executionId = `${task.id}-${++this.executionCounter}`;
    const startTime = Date.now();
    const logs: TaskLogEntry[] = [];

    this.log(logs, 'info', `Starting task execution: ${task.name}`, { taskId: task.id });

    try {
      // Validate input parameters
      this.validateTaskInput(task, context.input);

      // Start resource monitoring
      const resourceMonitoring = this.resourceMonitor.start(executionId);

      // Execute with retry logic
      const result = await this.executeWithRetry(task, context, logs);

      // Stop resource monitoring
      const resourceUsage = this.resourceMonitor.stop(executionId);

      // Calculate execution metadata
      const executionTime = Date.now() - startTime;

      this.log(logs, 'info', `Task completed successfully in ${executionTime}ms`, {
        taskId: task.id,
        executionTime,
      });

      return {
        success: true,
        output: result,
        metadata: {
          executionTimeMs: executionTime,
          retryCount: context.retryCount,
          resourceUsage,
          logs,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const taskError = this.handleTaskError(error, task, context);

      this.log(logs, 'error', `Task failed after ${executionTime}ms`, {
        taskId: task.id,
        error: taskError.message,
        retryCount: context.retryCount,
      });

      return {
        success: false,
        error: taskError,
        metadata: {
          executionTimeMs: executionTime,
          retryCount: context.retryCount,
          resourceUsage: this.resourceMonitor.stop(executionId),
          logs,
        },
      };
    }
  }

  /**
   * Execute task with retry logic
   */
  private async executeWithRetry(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    const retryConfig = task.config.retryConfig || {
      maxAttempts: 1,
      backoffStrategy: 'exponential',
      delayMs: 1000,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(retryConfig, attempt - 1);
          this.log(logs, 'info', `Retrying task in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts + 1})`);
          await this.sleep(delay);
        }

        // Execute the actual task logic
        return await this.executeTaskLogic(task, context, logs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isRetryable = this.isRetryableError(lastError, task);
        
        if (!isRetryable || attempt >= retryConfig.maxAttempts) {
          throw lastError;
        }

        this.log(logs, 'warn', `Task attempt ${attempt + 1} failed: ${lastError.message}`, {
          retryable: isRetryable,
          remainingAttempts: retryConfig.maxAttempts - attempt,
        });
      }
    }

    throw lastError || new Error('Task execution failed');
  }

  /**
   * Execute the core task logic based on task type
   */
  private async executeTaskLogic(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    switch (task.type) {
      case 'user_provision':
        return await this.executeUserProvisionTask(task, context, logs);
      
      case 'user_deprovision':
        return await this.executeUserDeprovisionTask(task, context, logs);
      
      case 'license_assign':
        return await this.executeLicenseAssignTask(task, context, logs);
      
      case 'license_revoke':
        return await this.executeLicenseRevokeTask(task, context, logs);
      
      case 'webhook_call':
        return await this.executeWebhookTask(task, context, logs);
      
      case 'email_send':
        return await this.executeEmailTask(task, context, logs);
      
      case 'data_transform':
        return await this.executeDataTransformTask(task, context, logs);
      
      case 'conditional':
        return await this.executeConditionalTask(task, context, logs);
      
      case 'delay':
        return await this.executeDelayTask(task, context, logs);
      
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  /**
   * MVP Core Task Implementations
   */
  private async executeUserProvisionTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Executing user provision task');
    
    // TODO: Implement user provisioning logic
    // This will integrate with Google Workspace, Microsoft 365, etc.
    
    return {
      userId: 'user-123',
      status: 'provisioned',
      integrations: ['google_workspace', 'microsoft365'],
    };
  }

  private async executeUserDeprovisionTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Executing user deprovision task');
    
    // TODO: Implement user deprovisioning logic
    
    return {
      userId: context.input.userId,
      status: 'deprovisioned',
      integrations: ['google_workspace', 'microsoft365'],
    };
  }

  private async executeLicenseAssignTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Executing license assign task');
    
    // TODO: Implement license assignment logic
    
    return {
      licenseId: 'license-456',
      userId: context.input.userId,
      status: 'assigned',
    };
  }

  private async executeLicenseRevokeTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Executing license revoke task');
    
    // TODO: Implement license revocation logic
    
    return {
      licenseId: context.input.licenseId,
      userId: context.input.userId,
      status: 'revoked',
    };
  }

  private async executeWebhookTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', `Making webhook call to ${task.config.endpoint}`);
    
    // TODO: Implement webhook call logic
    
    return {
      status: 'success',
      responseCode: 200,
      responseTime: 150,
    };
  }

  private async executeEmailTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Sending email notification');
    
    // TODO: Implement email sending logic
    
    return {
      messageId: 'msg-789',
      status: 'sent',
      recipient: context.input.recipient,
    };
  }

  private async executeDataTransformTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Executing data transformation');
    
    // TODO: Implement data transformation logic
    
    return {
      transformedData: context.input,
      transformationType: task.config.transformExpression,
    };
  }

  private async executeConditionalTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    this.log(logs, 'info', 'Evaluating conditional logic');
    
    // TODO: Implement conditional evaluation
    
    const condition = task.config.condition || 'true';
    const result = condition === 'true'; // Simplified for MVP
    
    return {
      conditionResult: result,
      condition,
      branch: result ? 'success' : 'failure',
    };
  }

  private async executeDelayTask(
    task: Task,
    context: TaskExecutionContext,
    logs: TaskLogEntry[]
  ): Promise<any> {
    const delayMs = task.config.delayMs || 1000;
    this.log(logs, 'info', `Delaying execution for ${delayMs}ms`);
    
    await this.sleep(delayMs);
    
    return {
      delayMs,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Utility methods
   */
  private validateTaskInput(task: Task, input: any): void {
    // TODO: Implement input validation based on task metadata
  }

  private handleTaskError(error: any, task: Task, context: TaskExecutionContext): TaskError {
    const baseError: TaskError = {
      code: 'TASK_EXECUTION_ERROR',
      message: error.message || 'Unknown task execution error',
      details: error,
      retryable: this.isRetryableError(error, task),
      category: this.categorizeError(error),
    };

    return baseError;
  }

  private isRetryableError(error: Error, task: Task): boolean {
    // Network errors, timeouts, and rate limits are typically retryable
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate.?limit/i,
      /503/,
      /502/,
      /500/,
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  }

  private categorizeError(error: any): any {
    if (error.message?.includes('network')) return 'network';
    if (error.message?.includes('timeout')) return 'timeout';
    if (error.message?.includes('auth')) return 'authentication';
    if (error.message?.includes('permission')) return 'authorization';
    if (error.message?.includes('validation')) return 'validation';
    return 'internal';
  }

  private calculateRetryDelay(retryConfig: RetryConfig, attempt: number): number {
    const baseDelay = retryConfig.delayMs;
    
    switch (retryConfig.backoffStrategy) {
      case 'linear':
        return baseDelay * (attempt + 1);
      
      case 'exponential':
        return baseDelay * Math.pow(2, attempt);
      
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  private log(
    logs: TaskLogEntry[],
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: any
  ): void {
    const logEntry: TaskLogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };
    
    logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Resource Monitor - Tracks CPU, memory, and network usage during task execution
 */
class ResourceMonitor {
  private activeMonitoring = new Map<string, ResourceMonitoringSession>();

  public start(executionId: string): ResourceMonitoringSession {
    const session: ResourceMonitoringSession = {
      executionId,
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      networkCallsCount: 0,
      dataTransferredBytes: 0,
    };

    this.activeMonitoring.set(executionId, session);
    return session;
  }

  public stop(executionId: string): TaskResourceUsage {
    const session = this.activeMonitoring.get(executionId);
    if (!session) {
      return {
        cpuTimeMs: 0,
        memoryMb: 0,
        networkCallsCount: 0,
        dataTransferredBytes: 0,
      };
    }

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    this.activeMonitoring.delete(executionId);

    return {
      cpuTimeMs: endTime - session.startTime,
      memoryMb: (endMemory.heapUsed - session.startMemory.heapUsed) / 1024 / 1024,
      networkCallsCount: session.networkCallsCount,
      dataTransferredBytes: session.dataTransferredBytes,
    };
  }
}

interface ResourceMonitoringSession {
  executionId: string;
  startTime: number;
  startMemory: NodeJS.MemoryUsage;
  networkCallsCount: number;
  dataTransferredBytes: number;
} 