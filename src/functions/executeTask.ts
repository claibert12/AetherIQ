import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { 
  ExecuteTaskResponse, 
  RunStatus, 
  WorkflowRun 
} from '../types/workflow';
import { DatabaseClient, DatabaseError } from '../core/db';
import { QueueClient, QueueError } from '../core/queue';
import { MeteringClient, MeteringError } from '../core/meter';

// Request validation schema
const ExecuteTaskRequestSchema = z.object({
  runId: z.string().uuid('runId must be a valid UUID'),
  workflowId: z.string().min(1, 'workflowId is required'),
  tenantId: z.string().min(1, 'tenantId is required'),
  startNodeId: z.string().optional(),
  payload: z.record(z.any()).default({})
});

/**
 * executeTask Lambda - Production-grade workflow execution API
 * 
 * Responsibilities:
 * - Validate & parse requests with Zod schema
 * - Write execution stub to DynamoDB with idempotency
 * - Enqueue message to SQS for worker processing
 * - Publish billing/metering events
 * - Handle errors with proper HTTP status codes
 * - Log to CloudWatch with structured data
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();
  
  // Initialize clients
  const dbClient = new DatabaseClient();
  const queueClient = new QueueClient();
  const meteringClient = new MeteringClient();

  try {
    // Parse and validate request body
    const body = parseRequestBody(event.body || null);
    const request = ExecuteTaskRequestSchema.parse(body);

    logInfo('Received executeTask request', {
      runId: request.runId,
      workflowId: request.workflowId,
      tenantId: request.tenantId,
      requestId,
      hasStartNode: !!request.startNodeId
    });

    // Check for idempotency - if run already exists, return existing state
    const existingRun = await dbClient.getWorkflowRun(request.runId);
    if (existingRun) {
      logInfo('Returning existing workflow run (idempotent)', {
        runId: request.runId,
        status: existingRun.status,
        tenantId: request.tenantId,
        requestId
      });

      return createSuccessResponse(toExecuteTaskResponse(existingRun), requestId, startTime);
    }

    // Create new workflow run record
    const workflowRunData: Omit<WorkflowRun, 'createdAt' | 'updatedAt'> = {
      runId: request.runId,
      workflowId: request.workflowId,
      tenantId: request.tenantId,
      status: RunStatus.QUEUED,
      startedAt: new Date().toISOString(),
      payload: request.payload,
      ...(request.startNodeId && { startNodeId: request.startNodeId })
    };

    const workflowRun = await dbClient.createWorkflowRun(workflowRunData);

    logInfo('Created workflow run record', {
      runId: request.runId,
      status: workflowRun.status,
      tenantId: request.tenantId,
      requestId
    });

    // Enqueue for worker processing
    const queueRequest = {
      runId: request.runId,
      workflowId: request.workflowId,
      tenantId: request.tenantId,
      payload: request.payload,
      ...(request.startNodeId && { startNodeId: request.startNodeId })
    };
    await queueClient.enqueueWorkflowExecution(queueRequest);

    logInfo('Enqueued workflow execution', {
      runId: request.runId,
      queueUrl: queueClient.getQueueUrl(),
      tenantId: request.tenantId,
      requestId
    });

    // Publish billing metering event
    await meteringClient.publishTaskEnqueuedEvent(
      request.tenantId,
      request.workflowId,
      request.runId,
      {
        requestId,
        hasStartNode: !!request.startNodeId,
        payloadSize: JSON.stringify(request.payload).length
      }
    );

    logInfo('Published metering event', {
      runId: request.runId,
      eventType: 'task_enqueued',
      tenantId: request.tenantId,
      requestId
    });

    // Return success response
    const response = toExecuteTaskResponse(workflowRun);
    
    logInfo('executeTask completed successfully', {
      runId: request.runId,
      executionTime: Date.now() - startTime,
      tenantId: request.tenantId,
      requestId
    });

    return createSuccessResponse(response, requestId, startTime);

  } catch (error) {
    return handleError(error, requestId, startTime);
  }
};

/**
 * Parse request body with proper error handling
 */
function parseRequestBody(body: string | null): any {
  if (!body) {
    throw new ValidationError('Request body is required');
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new ValidationError('Request body must be valid JSON');
  }
}

/**
 * Convert WorkflowRun to ExecuteTaskResponse
 */
function toExecuteTaskResponse(run: WorkflowRun): ExecuteTaskResponse {
  return {
    runId: run.runId,
    status: run.status,
    startedAt: run.startedAt,
    ...(run.finishedAt && { finishedAt: run.finishedAt }),
    ...(run.error && { error: run.error })
  };
}

/**
 * Create successful HTTP response
 */
function createSuccessResponse(
  data: ExecuteTaskResponse, 
  requestId: string, 
  startTime: number
) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Execution-Time': `${Date.now() - startTime}ms`
    },
    body: JSON.stringify(data)
  };
}

/**
 * Handle errors with appropriate HTTP status codes
 */
function handleError(error: any, requestId: string, startTime: number) {
  const executionTime = Date.now() - startTime;

  if (error instanceof z.ZodError) {
    logError('Validation error', error, { requestId, executionTime });
    
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Execution-Time': `${executionTime}ms`
      },
      body: JSON.stringify({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })),
        requestId
      })
    };
  }

  if (error instanceof ValidationError) {
    logError('Request validation error', error, { requestId, executionTime });
    
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Execution-Time': `${executionTime}ms`
      },
      body: JSON.stringify({
        error: 'Bad Request',
        message: error.message,
        requestId
      })
    };
  }

  // Log internal errors (DB, Queue, Metering)
  if (error instanceof DatabaseError || 
      error instanceof QueueError || 
      error instanceof MeteringError) {
    logError('Service error', error, { 
      requestId, 
      executionTime,
      service: error.constructor.name 
    });
  } else {
    logError('Unexpected error', error, { requestId, executionTime });
  }

  return {
    statusCode: 502,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Execution-Time': `${executionTime}ms`
    },
    body: JSON.stringify({
      error: 'Internal Server Error',
      message: 'An internal error occurred while processing the request',
      requestId
    })
  };
}

/**
 * Structured logging helpers
 */
function logInfo(message: string, context?: any): void {
  console.log(JSON.stringify({
    level: 'INFO',
    message,
    timestamp: new Date().toISOString(),
    ...context
  }));
}

function logError(message: string, error: any, context?: any): void {
  console.error(JSON.stringify({
    level: 'ERROR',
    message,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString(),
    ...context
  }));
}

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
} 