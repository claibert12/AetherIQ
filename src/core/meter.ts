import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { MeteringEvent } from '../types/workflow';

/**
 * EventBridge helper for metering and billing events
 * Handles: Usage tracking, billing events, audit trails
 */
export class MeteringClient {
  private eventBridgeClient: EventBridgeClient;
  private eventBusName: string;

  constructor() {
    this.eventBridgeClient = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const stage = process.env.STAGE || 'dev';
    this.eventBusName = process.env.METERING_EVENT_BUS || `aetheriq-metering-${stage}`;
  }

  /**
   * Publish a metering event for billing/usage tracking
   */
  async publishMeteringEvent(event: MeteringEvent): Promise<void> {
    try {
      await this.eventBridgeClient.send(new PutEventsCommand({
        Entries: [
          {
            Source: 'aetheriq.workflow.execution',
            DetailType: 'Workflow Metering Event',
            Detail: JSON.stringify(event),
            EventBusName: this.eventBusName,
            Resources: [
              `arn:aws:aetheriq:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:tenant/${event.tenantId}`,
              `arn:aws:aetheriq:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:workflow/${event.workflowId}`,
              `arn:aws:aetheriq:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:run/${event.runId}`
            ]
          }
        ]
      }));
    } catch (error: any) {
      throw new MeteringError(`Failed to publish metering event: ${error.message}`, error);
    }
  }

  /**
   * Publish task enqueued event (for billing)
   */
  async publishTaskEnqueuedEvent(
    tenantId: string,
    workflowId: string, 
    runId: string,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: MeteringEvent = {
      eventType: 'task_enqueued',
      tenantId,
      workflowId,
      runId,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata })
    };

    await this.publishMeteringEvent(event);
  }

  /**
   * Publish task started event
   */
  async publishTaskStartedEvent(
    tenantId: string,
    workflowId: string,
    runId: string,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: MeteringEvent = {
      eventType: 'task_started',
      tenantId,
      workflowId,
      runId,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata })
    };

    await this.publishMeteringEvent(event);
  }

  /**
   * Publish task completed event
   */
  async publishTaskCompletedEvent(
    tenantId: string,
    workflowId: string,
    runId: string,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: MeteringEvent = {
      eventType: 'task_completed',
      tenantId,
      workflowId,
      runId,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata })
    };

    await this.publishMeteringEvent(event);
  }

  /**
   * Publish task failed event
   */
  async publishTaskFailedEvent(
    tenantId: string,
    workflowId: string,
    runId: string,
    error: { message: string; stepId?: string },
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const eventMetadata = {
      ...(metadata || {}),
      error
    };

    const event: MeteringEvent = {
      eventType: 'task_failed',
      tenantId,
      workflowId,
      runId,
      timestamp: new Date().toISOString(),
      metadata: eventMetadata
    };

    await this.publishMeteringEvent(event);
  }

  /**
   * Get event bus name for external reference
   */
  getEventBusName(): string {
    return this.eventBusName;
  }
}

export class MeteringError extends Error {
  public readonly originalError?: Error | undefined;

  constructor(message: string, originalError?: Error | undefined) {
    super(message);
    this.name = 'MeteringError';
    this.originalError = originalError;
  }
} 