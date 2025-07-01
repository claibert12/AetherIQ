import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ExecuteTaskRequest } from '../types/workflow';

/**
 * SQS helper for workflow execution queue operations
 * Handles: Message publishing, error handling, deduplication
 */
export class QueueClient {
  private sqsClient: SQSClient;
  private queueUrl: string;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const stage = process.env.STAGE || 'dev';
    this.queueUrl = process.env.WORKFLOW_EXEC_QUEUE_URL || 
      `https://sqs.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.AWS_ACCOUNT_ID}/workflow-exec-${stage}`;
  }

  /**
   * Enqueue a workflow execution request
   * Uses runId as deduplication key for exactly-once delivery
   */
  async enqueueWorkflowExecution(request: ExecuteTaskRequest): Promise<void> {
    try {
      const messageBody = JSON.stringify(request);
      
      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageDeduplicationId: request.runId, // Ensure exactly-once delivery
        MessageGroupId: request.tenantId, // Group by tenant for FIFO ordering
        MessageAttributes: {
          tenantId: {
            DataType: 'String',
            StringValue: request.tenantId
          },
          workflowId: {
            DataType: 'String', 
            StringValue: request.workflowId
          },
          runId: {
            DataType: 'String',
            StringValue: request.runId
          }
        }
      }));
    } catch (error: any) {
      throw new QueueError(`Failed to enqueue workflow execution: ${error.message}`, error);
    }
  }

  /**
   * Enqueue with delay (for retry scenarios)
   */
  async enqueueWorkflowExecutionWithDelay(
    request: ExecuteTaskRequest, 
    delaySeconds: number = 0
  ): Promise<void> {
    try {
      const messageBody = JSON.stringify(request);
      
      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        DelaySeconds: Math.min(delaySeconds, 900), // Max 15 minutes
        MessageDeduplicationId: `${request.runId}-retry-${Date.now()}`,
        MessageGroupId: request.tenantId,
        MessageAttributes: {
          tenantId: {
            DataType: 'String',
            StringValue: request.tenantId
          },
          workflowId: {
            DataType: 'String',
            StringValue: request.workflowId
          },
          runId: {
            DataType: 'String',
            StringValue: request.runId
          },
          retryAttempt: {
            DataType: 'String',
            StringValue: 'true'
          }
        }
      }));
    } catch (error: any) {
      throw new QueueError(`Failed to enqueue delayed workflow execution: ${error.message}`, error);
    }
  }

  /**
   * Get queue URL for external reference
   */
  getQueueUrl(): string {
    return this.queueUrl;
  }
}

export class QueueError extends Error {
  public readonly originalError?: Error | undefined;

  constructor(message: string, originalError?: Error | undefined) {
    super(message);
    this.name = 'QueueError';
    this.originalError = originalError;
  }
} 