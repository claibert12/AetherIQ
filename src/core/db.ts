import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { WorkflowRun, RunStatus } from '../types/workflow';

/**
 * DynamoDB helper for workflow run operations
 * Handles: CRUD operations, idempotency, error handling
 */
export class DatabaseClient {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.WORKFLOW_RUNS_TABLE || 'workflow_runs';
  }

  /**
   * Create a new workflow run record (idempotent)
   * Returns existing record if runId already exists
   */
  async createWorkflowRun(run: Omit<WorkflowRun, 'createdAt' | 'updatedAt'>): Promise<WorkflowRun> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days TTL

    const workflowRun: WorkflowRun = {
      ...run,
      ttl,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Use ConditionExpression to ensure idempotency
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: workflowRun,
        ConditionExpression: 'attribute_not_exists(runId)',
      }));

      return workflowRun;
    } catch (error: any) {
      // If item already exists, fetch and return it
      if (error.name === 'ConditionalCheckFailedException') {
        const existingRun = await this.getWorkflowRun(run.runId);
        if (existingRun) {
          return existingRun;
        }
      }
      
      throw new DatabaseError(`Failed to create workflow run: ${error.message}`, error);
    }
  }

  /**
   * Get workflow run by runId
   */
  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { runId },
      }));

      return result.Item ? (result.Item as WorkflowRun) : null;
    } catch (error: any) {
      throw new DatabaseError(`Failed to get workflow run: ${error.message}`, error);
    }
  }

  /**
   * Update workflow run status
   */
  async updateWorkflowRunStatus(
    runId: string, 
    status: RunStatus, 
    error?: { message: string; stepId?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    
    try {
      const updateExpression = error
        ? 'SET #status = :status, #updatedAt = :updatedAt, #error = :error'
        : 'SET #status = :status, #updatedAt = :updatedAt';

      const expressionAttributeValues: any = {
        ':status': status,
        ':updatedAt': now,
      };

      if (error) {
        expressionAttributeValues[':error'] = error;
      }

      // Add finishedAt for terminal states
      if (status === RunStatus.SUCCESS || status === RunStatus.FAILED) {
        updateExpression.replace('SET', 'SET #finishedAt = :finishedAt,');
        expressionAttributeValues[':finishedAt'] = now;
      }

      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { runId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          ...(error && { '#error': 'error' }),
          ...(status === RunStatus.SUCCESS || status === RunStatus.FAILED ? { '#finishedAt': 'finishedAt' } : {}),
        },
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(runId)', // Ensure run exists
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to update workflow run status: ${error.message}`, error);
    }
  }

  /**
   * Check if workflow run exists (for idempotency)
   */
  async workflowRunExists(runId: string): Promise<boolean> {
    try {
      const run = await this.getWorkflowRun(runId);
      return run !== null;
    } catch (error) {
      // On error, assume it doesn't exist to be safe
      return false;
    }
  }
}

export class DatabaseError extends Error {
  public readonly originalError?: Error | undefined;

  constructor(message: string, originalError?: Error | undefined) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
} 