import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { NodeExecution, NodeExecutionStatus } from '../types/workflow';

/**
 * DynamoDB helper for workflow execution state management
 * Handles: Node execution tracking, state persistence, progress monitoring
 */
export class ExecutionStateManager {
  private docClient: DynamoDBDocumentClient;
  private executionsTable: string;

  constructor() {
    const client = new DynamoDBClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.executionsTable = process.env.NODE_EXECUTIONS_TABLE || 'node_executions';
  }

  /**
   * Create a new node execution record
   */
  async createNodeExecution(nodeExecution: Omit<NodeExecution, 'executionTimeMs' | 'resourceUsage'>): Promise<NodeExecution> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days TTL

    const execution: NodeExecution = {
      ...nodeExecution,
      ttl,
      createdAt: now,
      updatedAt: now
    } as NodeExecution;

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.executionsTable,
        Item: execution,
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: {
          '#pk': 'nodeId'
        }
      }));

      return execution;
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to create node execution: ${error.message}`, error);
    }
  }

  /**
   * Update node execution status and results
   */
  async updateNodeExecution(
    runId: string,
    nodeId: string,
    updates: Partial<Pick<NodeExecution, 'status' | 'finishedAt' | 'output' | 'error' | 'executionTimeMs' | 'resourceUsage'>>
  ): Promise<void> {
    const now = new Date().toISOString();
    
    try {
      const updateExpression: string[] = ['#updatedAt = :updatedAt'];
      const expressionAttributeNames: Record<string, string> = {
        '#updatedAt': 'updatedAt'
      };
      const expressionAttributeValues: Record<string, any> = {
        ':updatedAt': now
      };

      // Build dynamic update expression
      if (updates.status !== undefined) {
        updateExpression.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = updates.status;
      }

      if (updates.finishedAt !== undefined) {
        updateExpression.push('#finishedAt = :finishedAt');
        expressionAttributeNames['#finishedAt'] = 'finishedAt';
        expressionAttributeValues[':finishedAt'] = updates.finishedAt;
      }

      if (updates.output !== undefined) {
        updateExpression.push('#output = :output');
        expressionAttributeNames['#output'] = 'output';
        expressionAttributeValues[':output'] = updates.output;
      }

      if (updates.error !== undefined) {
        updateExpression.push('#error = :error');
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = updates.error;
      }

      if (updates.executionTimeMs !== undefined) {
        updateExpression.push('#executionTimeMs = :executionTimeMs');
        expressionAttributeNames['#executionTimeMs'] = 'executionTimeMs';
        expressionAttributeValues[':executionTimeMs'] = updates.executionTimeMs;
      }

      if (updates.resourceUsage !== undefined) {
        updateExpression.push('#resourceUsage = :resourceUsage');
        expressionAttributeNames['#resourceUsage'] = 'resourceUsage';
        expressionAttributeValues[':resourceUsage'] = updates.resourceUsage;
      }

      await this.docClient.send(new UpdateCommand({
        TableName: this.executionsTable,
        Key: { 
          runId: runId,
          nodeId: nodeId 
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(runId)' // Ensure execution exists
      }));
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to update node execution: ${error.message}`, error);
    }
  }

  /**
   * Get node execution by runId and nodeId
   */
  async getNodeExecution(runId: string, nodeId: string): Promise<NodeExecution | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.executionsTable,
        Key: { runId, nodeId }
      }));

      return result.Item ? (result.Item as NodeExecution) : null;
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to get node execution: ${error.message}`, error);
    }
  }

  /**
   * Get all node executions for a workflow run
   */
  async getRunExecutions(runId: string): Promise<NodeExecution[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.executionsTable,
        KeyConditionExpression: 'runId = :runId',
        ExpressionAttributeValues: {
          ':runId': runId
        }
      }));

      return result.Items ? (result.Items as NodeExecution[]) : [];
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to get run executions: ${error.message}`, error);
    }
  }

  /**
   * Get execution progress summary
   */
  async getExecutionProgress(runId: string): Promise<ExecutionProgress> {
    try {
      const executions = await this.getRunExecutions(runId);
      
      const statusCounts = executions.reduce((acc, exec) => {
        acc[exec.status] = (acc[exec.status] || 0) + 1;
        return acc;
      }, {} as Record<NodeExecutionStatus, number>);

      const totalNodes = executions.length;
      const completedNodes = (statusCounts[NodeExecutionStatus.SUCCESS] || 0);
      const failedNodes = (statusCounts[NodeExecutionStatus.FAILED] || 0);
      const runningNodes = (statusCounts[NodeExecutionStatus.RUNNING] || 0);
      const pendingNodes = (statusCounts[NodeExecutionStatus.PENDING] || 0);

      // Calculate total execution time
      const totalExecutionTime = executions
        .filter(e => e.executionTimeMs)
        .reduce((sum, e) => sum + (e.executionTimeMs || 0), 0);

      // Find currently running node
      const currentlyRunning = executions.find(e => e.status === NodeExecutionStatus.RUNNING);

      const progress: ExecutionProgress = {
        runId,
        totalNodes,
        completedNodes,
        failedNodes,
        runningNodes,
        pendingNodes,
        progressPercentage: totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0,
        totalExecutionTimeMs: totalExecutionTime,
        lastUpdated: new Date().toISOString()
      };

      // Only set currentNode if there is one running
      if (currentlyRunning?.nodeId) {
        progress.currentNode = currentlyRunning.nodeId;
      }

      return progress;
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to get execution progress: ${error.message}`, error);
    }
  }

  /**
   * Increment retry count for a node execution
   */
  async incrementRetryCount(runId: string, nodeId: string): Promise<number> {
    try {
      const result = await this.docClient.send(new UpdateCommand({
        TableName: this.executionsTable,
        Key: { runId, nodeId },
        UpdateExpression: 'ADD #retryCount :increment SET #updatedAt = :updatedAt, #status = :status',
        ExpressionAttributeNames: {
          '#retryCount': 'retryCount',
          '#updatedAt': 'updatedAt',
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':increment': 1,
          ':updatedAt': new Date().toISOString(),
          ':status': NodeExecutionStatus.RETRYING
        },
        ReturnValues: 'ALL_NEW'
      }));

      return result.Attributes?.retryCount || 0;
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to increment retry count: ${error.message}`, error);
    }
  }

  /**
   * Get failed node executions for rollback
   */
  async getFailedExecutions(runId: string): Promise<NodeExecution[]> {
    try {
      const executions = await this.getRunExecutions(runId);
      return executions.filter(e => e.status === NodeExecutionStatus.FAILED);
    } catch (error: any) {
      throw new ExecutionStateError(`Failed to get failed executions: ${error.message}`, error);
    }
  }
}

export interface ExecutionProgress {
  runId: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  runningNodes: number;
  pendingNodes: number;
  progressPercentage: number;
  totalExecutionTimeMs: number;
  currentNode?: string;
  lastUpdated: string;
}

export class ExecutionStateError extends Error {
  public readonly originalError?: Error | undefined;

  constructor(message: string, originalError?: Error | undefined) {
    super(message);
    this.name = 'ExecutionStateError';
    this.originalError = originalError;
  }
} 