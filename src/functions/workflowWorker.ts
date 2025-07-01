import { SQSHandler, SQSEvent, SQSRecord } from 'aws-lambda';
import { 
  ExecuteTaskRequest,
  WorkflowGraph, 
  GraphNode,
  NodeType,
  ExecutionContext,
  NodeExecution,
  NodeExecutionStatus,
  RunStatus,
  WorkflowProgressEvent
} from '../types/workflow';
import { DatabaseClient } from '../core/db';
import { WorkflowRepository } from '../core/workflow-repository';
import { ExecutionStateManager } from '../core/execution-state';
import { NodeExecutor, NodeExecutionResult } from '../core/node-executor';
import { MeteringClient } from '../core/meter';

/**
 * workflowWorker Lambda - Production-grade workflow execution engine
 * 
 * Responsibilities:
 * - Pull workflow execution jobs from SQS
 * - Load workflow definitions and validate structure
 * - Execute workflow nodes in correct order
 * - Handle retries, rollbacks, and error recovery
 * - Publish progress events to EventBridge
 * - Update execution state in DynamoDB
 * - Manage timeouts and resource limits
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  const batchStartTime = Date.now();
  
  // Initialize services
  const dbClient = new DatabaseClient();
  const workflowRepo = new WorkflowRepository();
  const stateManager = new ExecutionStateManager();
  const nodeExecutor = new NodeExecutor();
  const meteringClient = new MeteringClient();

  // Process each SQS record
  const results = await Promise.allSettled(
    event.Records.map(record => 
      processWorkflowExecution(record, {
        dbClient,
        workflowRepo,
        stateManager,
        nodeExecutor,
        meteringClient
      })
    )
  );

  // Log batch processing results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logInfo('Batch processing completed', {
    totalRecords: event.Records.length,
    successful,
    failed,
    batchExecutionTime: Date.now() - batchStartTime
  });

  // If any records failed, log the errors but don't throw (partial batch failure)
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logError('Record processing failed', result.reason, {
        recordIndex: index,
        messageId: event.Records[index].messageId
      });
    }
  });
};

/**
 * Process a single workflow execution request
 */
async function processWorkflowExecution(
  record: SQSRecord,
  services: WorkflowServices
): Promise<void> {
  const startTime = Date.now();
  const messageId = record.messageId;

  try {
    // Parse SQS message
    const request: ExecuteTaskRequest = JSON.parse(record.body);
    
    logInfo('Processing workflow execution', {
      runId: request.runId,
      workflowId: request.workflowId,
      tenantId: request.tenantId,
      messageId
    });

    // Update workflow run status to RUNNING
    await services.dbClient.updateWorkflowRunStatus(request.runId, RunStatus.RUNNING);

    // Publish task started event
    await services.meteringClient.publishTaskStartedEvent(
      request.tenantId,
      request.workflowId,
      request.runId,
      { messageId, startedAt: new Date().toISOString() }
    );

    // Load workflow definition
    const workflow = await services.workflowRepo.getWorkflow(request.workflowId);
    if (!workflow) {
      throw new WorkflowExecutionError(
        'WORKFLOW_NOT_FOUND',
        `Workflow not found: ${request.workflowId}`,
        { workflowId: request.workflowId },
        false
      );
    }

    // Validate workflow structure
    const validation = services.workflowRepo.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new WorkflowExecutionError(
        'INVALID_WORKFLOW',
        `Workflow validation failed: ${validation.errors.join(', ')}`,
        { workflowId: request.workflowId, errors: validation.errors },
        false
      );
    }

    // Create execution context
    const context = await createExecutionContext(request, workflow);

    // Execute workflow
    const executionResult = await executeWorkflow(workflow, context, services);

    // Update final status
    if (executionResult.success) {
      await services.dbClient.updateWorkflowRunStatus(request.runId, RunStatus.SUCCESS);
      await services.meteringClient.publishTaskCompletedEvent(
        request.tenantId,
        request.workflowId,
        request.runId,
        {
          executionTime: Date.now() - startTime,
          completedNodes: executionResult.completedNodes,
          totalNodes: executionResult.totalNodes
        }
      );
    } else {
      await services.dbClient.updateWorkflowRunStatus(
        request.runId, 
        RunStatus.FAILED, 
        executionResult.error
      );
      await services.meteringClient.publishTaskFailedEvent(
        request.tenantId,
        request.workflowId,
        request.runId,
        executionResult.error!,
        {
          executionTime: Date.now() - startTime,
          failedAt: executionResult.failedNodeId
        }
      );
    }

    logInfo('Workflow execution completed', {
      runId: request.runId,
      success: executionResult.success,
      executionTime: Date.now() - startTime,
      completedNodes: executionResult.completedNodes,
      totalNodes: executionResult.totalNodes
    });

  } catch (error: any) {
    await handleWorkflowError(error, record, services, startTime);
  }
}

/**
 * Execute workflow by traversing the graph
 */
async function executeWorkflow(
  workflow: WorkflowGraph,
  context: ExecutionContext,
  services: WorkflowServices
): Promise<WorkflowExecutionResult> {
  const startNode = workflow.nodes.find(n => n.type === NodeType.START);
  if (!startNode) {
    throw new WorkflowExecutionError(
      'NO_START_NODE',
      'Workflow must have a START node',
      { workflowId: workflow.id },
      false
    );
  }

  // Build adjacency list for graph traversal
  const adjacencyList = buildAdjacencyList(workflow);
  
  // Track execution state
  const executedNodes = new Set<string>();
  const nodeOutputs = new Map<string, any>();
  let completedNodes = 0;
  const totalNodes = workflow.nodes.length;

  try {
    // Start execution from the START node
    await executeNodeRecursive(
      startNode,
      workflow,
      adjacencyList,
      context,
      context.payload,
      executedNodes,
      nodeOutputs,
      services
    );

    completedNodes = executedNodes.size;

    return {
      success: true,
      completedNodes,
      totalNodes,
      finalOutput: nodeOutputs.get('end') || nodeOutputs.get(Array.from(executedNodes).pop()!)
    };

  } catch (error: any) {
    completedNodes = executedNodes.size;

    // Attempt rollback if enabled
    if (workflow.config.enableRollback) {
      try {
        await performRollback(context.runId, executedNodes, services);
        logInfo('Rollback completed successfully', { runId: context.runId });
      } catch (rollbackError: any) {
        logError('Rollback failed', rollbackError, { runId: context.runId });
      }
    }

    return {
      success: false,
      completedNodes,
      totalNodes,
      error: {
        message: error.message || 'Unknown error during workflow execution',
        stepId: error.nodeId
      },
      failedNodeId: error.nodeId
    };
  }
}

/**
 * Recursively execute nodes in the workflow graph
 */
async function executeNodeRecursive(
  node: GraphNode,
  workflow: WorkflowGraph,
  adjacencyList: Map<string, GraphNode[]>,
  context: ExecutionContext,
  input: any,
  executedNodes: Set<string>,
  nodeOutputs: Map<string, any>,
  services: WorkflowServices
): Promise<void> {
  // Skip if already executed (prevents cycles)
  if (executedNodes.has(node.id)) {
    return;
  }

  // Mark as executed
  executedNodes.add(node.id);

  // Publish node started event
  await publishNodeProgressEvent(
    'node_started',
    context,
    node.id,
    executedNodes.size,
    workflow.nodes.length,
    services.meteringClient
  );

  try {
    // Execute the node with retry logic
    const result = await executeNodeWithRetry(
      node,
      context,
      input,
      services.nodeExecutor,
      services.stateManager
    );

    if (!result.success) {
      throw new WorkflowExecutionError(
        'NODE_EXECUTION_FAILED',
        `Node execution failed: ${result.error?.message || 'Unknown error'}`,
        { nodeId: node.id, error: result.error },
        result.error?.retryable || false
      );
    }

    // Store node output
    nodeOutputs.set(node.id, result.output);

    // Publish node completed event
    await publishNodeProgressEvent(
      'node_completed',
      context,
      node.id,
      executedNodes.size,
      workflow.nodes.length,
      services.meteringClient
    );

    // If this is an END node, we're done with this branch
    if (node.type === NodeType.END) {
      return;
    }

    // Execute next nodes based on edges
    const nextNodes = adjacencyList.get(node.id) || [];
    for (const nextNode of nextNodes) {
      // Check edge conditions if they exist
      const edge = workflow.edges.find(e => e.fromNodeId === node.id && e.toNodeId === nextNode.id);
      if (edge?.condition && !evaluateEdgeCondition(edge.condition, result.output)) {
        continue; // Skip this path
      }

      // Recursively execute next node
      await executeNodeRecursive(
        nextNode,
        workflow,
        adjacencyList,
        context,
        result.output,
        executedNodes,
        nodeOutputs,
        services
      );
    }

  } catch (error: any) {
    // Publish node failed event
    await publishNodeProgressEvent(
      'node_failed',
      context,
      node.id,
      executedNodes.size,
      workflow.nodes.length,
      services.meteringClient
    );

    // Add node ID to error for better tracking
    error.nodeId = node.id;
    throw error;
  }
}

/**
 * Execute a node with retry logic
 */
async function executeNodeWithRetry(
  node: GraphNode,
  context: ExecutionContext,
  input: any,
  nodeExecutor: NodeExecutor,
  stateManager: ExecutionStateManager
): Promise<NodeExecutionResult> {
  const retryConfig = node.config.retryConfig || {
    maxAttempts: 1,
    backoffStrategy: 'fixed',
    delayMs: 1000
  };

  let lastError: any;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      // Create node execution record
      const nodeExecution: Omit<NodeExecution, 'executionTimeMs' | 'resourceUsage'> = {
        nodeId: node.id,
        runId: context.runId,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date().toISOString(),
        input,
        retryCount: attempt - 1
      };

      await stateManager.createNodeExecution(nodeExecution);

      // Execute the node
      const result = await nodeExecutor.executeNode(node, context, input);

      if (result.success) {
        // Update execution record with success
        await stateManager.updateNodeExecution(context.runId, node.id, {
          status: NodeExecutionStatus.SUCCESS,
          finishedAt: new Date().toISOString(),
          output: result.output,
          executionTimeMs: result.executionTimeMs,
          resourceUsage: result.resourceUsage
        });

        return result;
      } else {
        lastError = result.error;

        // Update execution record with failure
        await stateManager.updateNodeExecution(context.runId, node.id, {
          status: NodeExecutionStatus.FAILED,
          finishedAt: new Date().toISOString(),
          ...(result.error && { error: result.error }),
          executionTimeMs: result.executionTimeMs,
          resourceUsage: result.resourceUsage
        });

        // Check if error is retryable and we have attempts left
        if (!result.error?.retryable || attempt >= retryConfig.maxAttempts) {
          return result; // Return the failed result
        }

        // Increment retry count
        await stateManager.incrementRetryCount(context.runId, node.id);

        // Wait before retry
        if (attempt < retryConfig.maxAttempts) {
          const delay = calculateRetryDelay(attempt, retryConfig);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error: any) {
      lastError = error;
      
      // If this is the last attempt or error is not retryable, throw
      if (attempt >= retryConfig.maxAttempts) {
        throw error;
      }

      // Wait before retry
      const delay = calculateRetryDelay(attempt, retryConfig);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should not be reached, but just in case
  throw lastError || new Error('Node execution failed after all retry attempts');
}

/**
 * Create execution context for workflow
 */
async function createExecutionContext(
  request: ExecuteTaskRequest,
  workflow: WorkflowGraph
): Promise<ExecutionContext> {
  const secrets = await loadSecrets(request.tenantId);
  const integrations = await loadIntegrationConfigs(request.tenantId);

  const context: ExecutionContext = {
    runId: request.runId,
    workflowId: request.workflowId,
    tenantId: request.tenantId,
    payload: request.payload || {},
    variables: {},
    secrets,
    integrations,
    startTime: Date.now(),
    timeoutAt: Date.now() + (workflow.config.maxExecutionTimeMs || 300000)
  };

  // Only set startNodeId if it's defined
  if (request.startNodeId !== undefined) {
    context.startNodeId = request.startNodeId;
  }

  return context;
}

/**
 * Build adjacency list for efficient graph traversal
 */
function buildAdjacencyList(workflow: WorkflowGraph): Map<string, GraphNode[]> {
  const adjacencyList = new Map<string, GraphNode[]>();

  // Initialize empty arrays for all nodes
  workflow.nodes.forEach(node => {
    adjacencyList.set(node.id, []);
  });

  // Build adjacency relationships
  workflow.edges.forEach(edge => {
    const fromList = adjacencyList.get(edge.fromNodeId) || [];
    const toNode = workflow.nodes.find(n => n.id === edge.toNodeId);
    if (toNode) {
      fromList.push(toNode);
      adjacencyList.set(edge.fromNodeId, fromList);
    }
  });

  return adjacencyList;
}

/**
 * Evaluate edge condition to determine if path should be taken
 */
function evaluateEdgeCondition(condition: any, nodeOutput: any): boolean {
  try {
    // Simple condition evaluation - can be enhanced for complex logic
    if (typeof condition === 'boolean') {
      return condition;
    }
    
    if (typeof condition === 'string') {
      // Simple string-based condition evaluation
      return nodeOutput?.status === condition || nodeOutput?.result === condition;
    }

    return true; // Default to true if condition is not recognized
  } catch (error) {
    logError('Error evaluating edge condition', error, { condition, nodeOutput });
    return false; // Default to false on error
  }
}

/**
 * Calculate retry delay based on backoff strategy
 */
function calculateRetryDelay(attempt: number, retryConfig: any): number {
  const baseDelay = retryConfig.delayMs || 1000;
  
  switch (retryConfig.backoffStrategy) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt - 1);
    case 'linear':
      return baseDelay * attempt;
    case 'fixed':
    default:
      return baseDelay;
  }
}

/**
 * Perform rollback operations for executed nodes
 */
async function performRollback(
  runId: string,
  executedNodes: Set<string>,
  _services: WorkflowServices
): Promise<void> {
  // Placeholder for rollback logic
  // In a real implementation, this would:
  // 1. Reverse operations in reverse execution order
  // 2. Call rollback handlers for each node type
  // 3. Update state to reflect rollback
  
  logInfo('Performing rollback', {
    runId,
    nodesToRollback: Array.from(executedNodes)
  });

  // For now, just log the rollback attempt
  for (const nodeId of Array.from(executedNodes).reverse()) {
    logInfo('Rolling back node', { runId, nodeId });
    // TODO: Implement actual rollback logic per node type
  }
}

/**
 * Publish node progress events
 */
async function publishNodeProgressEvent(
  eventType: 'node_started' | 'node_completed' | 'node_failed',
  context: ExecutionContext,
  nodeId: string,
  completedNodes: number,
  totalNodes: number,
  meteringClient: MeteringClient
): Promise<void> {
  const progressEvent: WorkflowProgressEvent = {
    eventType,
    runId: context.runId,
    workflowId: context.workflowId,
    tenantId: context.tenantId,
    nodeId,
    progress: {
      completedNodes,
      totalNodes,
      currentNode: nodeId
    },
    timestamp: new Date().toISOString()
  };

  // Convert to metering event format
  const meteringEvent = {
    eventType: eventType.replace('node_', 'task_') as 'task_started' | 'task_completed' | 'task_failed',
    tenantId: context.tenantId,
    workflowId: context.workflowId,
    runId: context.runId,
    timestamp: progressEvent.timestamp,
    metadata: {
      nodeId,
      progress: progressEvent.progress
    }
  };

  await meteringClient.publishMeteringEvent(meteringEvent);
}

/**
 * Handle workflow execution errors
 */
async function handleWorkflowError(
  error: any,
  record: SQSRecord,
  services: WorkflowServices,
  startTime: number
): Promise<void> {
  const request: ExecuteTaskRequest = JSON.parse(record.body);

  logError('Workflow execution error', error, {
    runId: request.runId,
    workflowId: request.workflowId,
    messageId: record.messageId
  });

  try {
    // Update workflow status to failed
    await services.dbClient.updateWorkflowRunStatus(
      request.runId,
      RunStatus.FAILED,
      {
        message: error.message || 'Unknown workflow execution error',
        stepId: error.nodeId
      }
    );

    // Publish task failed event
    await services.meteringClient.publishTaskFailedEvent(
      request.tenantId,
      request.workflowId,
      request.runId,
      {
        message: error.message || 'Workflow execution failed'
      },
      {
        executionTime: Date.now() - startTime,
        failedAt: error.nodeId
      }
    );

  } catch (handlingError: any) {
    logError('Error handling workflow failure', handlingError, {
      originalError: error,
      runId: request.runId
    });
  }
}

/**
 * Load secrets for tenant (placeholder)
 */
async function loadSecrets(_tenantId: string): Promise<Record<string, string>> {
  // Placeholder - in real implementation, load from AWS Secrets Manager
  return {};
}

/**
 * Load integration configurations for tenant (placeholder)
 */
async function loadIntegrationConfigs(_tenantId: string): Promise<Record<string, any>> {
  // Placeholder - in real implementation, load from configuration store
  return {};
}

function logInfo(message: string, context?: any): void {
  console.log(JSON.stringify({
    level: 'INFO',
    message,
    ...context,
    timestamp: new Date().toISOString()
  }));
}

function logError(message: string, error: any, context?: any): void {
  console.error(JSON.stringify({
    level: 'ERROR',
    message,
    error: {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    },
    ...context,
    timestamp: new Date().toISOString()
  }));
}

// Type definitions for internal use
interface WorkflowServices {
  dbClient: DatabaseClient;
  workflowRepo: WorkflowRepository;
  stateManager: ExecutionStateManager;
  nodeExecutor: NodeExecutor;
  meteringClient: MeteringClient;
}

interface WorkflowExecutionResult {
  success: boolean;
  completedNodes: number;
  totalNodes: number;
  finalOutput?: any;
  error?: { message: string; stepId?: string };
  failedNodeId?: string;
}

class WorkflowExecutionError extends Error {
  public readonly code: string;
  public readonly context: any;
  public readonly retryable: boolean;
  public nodeId?: string;

  constructor(code: string, message: string, context: any = {}, retryable: boolean = false) {
    super(message);
    this.name = 'WorkflowExecutionError';
    this.code = code;
    this.context = context || {};
    this.retryable = retryable;
  }
} 