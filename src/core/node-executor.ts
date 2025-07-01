import axios, { AxiosResponse } from 'axios';
import { 
  GraphNode, 
  NodeType, 
  ExecutionContext, 
  NodeExecutionError,
  ResourceUsage 
} from '../types/workflow';

export interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: NodeExecutionError;
  executionTimeMs: number;
  resourceUsage: ResourceUsage;
}

/**
 * NodeExecutor - Handles execution of individual workflow nodes
 * 
 * Supports different node types:
 * - API_CALL: HTTP requests to external services
 * - WEBHOOK: Outbound webhook calls
 * - DATA_TRANSFORM: Data manipulation and transformation
 * - EMAIL: Email sending (placeholder)
 * - CONDITION: Conditional logic evaluation
 * - START/END: Control flow nodes
 * - Integration nodes: Google Workspace, Microsoft 365, Salesforce
 * - User management nodes: Provisioning, deprovisioning, license management
 */
export class NodeExecutor {
  
  /**
   * Execute a workflow node based on its type
   */
  async executeNode(
    node: GraphNode,
    context: ExecutionContext,
    input: Record<string, any>
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      let result: any;

      switch (node.type) {
        case NodeType.START:
          result = await this.executeStart(node, context, input);
          break;
        case NodeType.END:
          result = await this.executeEnd(node, context, input);
          break;
        case NodeType.API_CALL:
          result = await this.executeApiCall(node, context, input);
          break;
        case NodeType.WEBHOOK:
          result = await this.executeWebhook(node, context, input);
          break;
        case NodeType.EMAIL:
          result = await this.executeEmail(node, context, input);
          break;
        case NodeType.DATA_TRANSFORM:
          result = await this.executeDataTransform(node, context, input);
          break;
        case NodeType.CONDITION:
          result = await this.executeCondition(node, context, input);
          break;
        case NodeType.DELAY:
          result = await this.executeDelay(node, context, input);
          break;
        case NodeType.PARALLEL:
          result = await this.executeParallel(node, context, input);
          break;
        case NodeType.GOOGLE_WORKSPACE:
        case NodeType.MICROSOFT365:
        case NodeType.SALESFORCE:
          result = await this.executeIntegration(node, context, input);
          break;
        case NodeType.USER_PROVISION:
        case NodeType.USER_DEPROVISION:
        case NodeType.LICENSE_ASSIGN:
        case NodeType.LICENSE_REVOKE:
          result = await this.executeUserManagement(node, context, input);
          break;
        default:
          throw new NodeExecutionErrorImpl(
            'UNSUPPORTED_NODE_TYPE',
            `Unsupported node type: ${node.type}`,
            { nodeType: node.type },
            false,
            'validation'
          );
      }

      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;

      return {
        success: true,
        output: result,
        executionTimeMs: executionTime,
        resourceUsage: {
          cpuTimeMs: executionTime,
          memoryUsageMb: Math.max(0, (endMemory - startMemory) / 1024 / 1024),
          networkCalls: 1, // Simplified - would need proper tracking
          dataTransferBytes: JSON.stringify(result || {}).length
        }
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;

      if (error instanceof NodeExecutionErrorImpl) {
        return {
          success: false,
          error: error.toNodeExecutionError(),
          executionTimeMs: executionTime,
          resourceUsage: {
            cpuTimeMs: executionTime,
            memoryUsageMb: Math.max(0, (endMemory - startMemory) / 1024 / 1024),
            networkCalls: 0,
            dataTransferBytes: 0
          }
        };
      }

      const nodeError = new NodeExecutionErrorImpl(
        'EXECUTION_ERROR',
        error.message || 'Unknown execution error',
        { originalError: error.name },
        true,
        'internal'
      );

      return {
        success: false,
        error: nodeError.toNodeExecutionError(),
        executionTimeMs: executionTime,
        resourceUsage: {
          cpuTimeMs: executionTime,
          memoryUsageMb: Math.max(0, (endMemory - startMemory) / 1024 / 1024),
          networkCalls: 0,
          dataTransferBytes: 0
        }
      };
    }
  }

  /**
   * Execute START node - simply passes through input
   */
  private async executeStart(
    _node: GraphNode,
    _context: ExecutionContext,
    _input: Record<string, any>
  ): Promise<Record<string, any>> {
    return { status: 'started', timestamp: new Date().toISOString() };
  }

  /**
   * Execute END node - marks completion
   */
  private async executeEnd(
    _node: GraphNode,
    _context: ExecutionContext,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    return { ...input, status: 'completed', timestamp: new Date().toISOString() };
  }

  /**
   * Execute API call node
   */
  private async executeApiCall(
    node: GraphNode,
    context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    const config = node.config;
    const method = config.method || 'GET';
    const url = this.interpolateString(config.url || '', { ...input, ...context.variables });
    const headers = { ...config.headers };
    const timeout = config.timeout || 30000;

    // Apply variable interpolation to headers
    Object.keys(headers).forEach(key => {
      headers[key] = this.interpolateString(headers[key], { ...input, ...context.variables });
    });

    // Add authentication headers if integration is specified
    if (config.integration && context.integrations[config.integration]) {
      const integration = context.integrations[config.integration];
      Object.assign(headers, integration.credentials);
    }

    try {
      let response: AxiosResponse;

      if (method === 'GET' || method === 'DELETE') {
        response = await axios({
          method: method.toLowerCase() as 'get' | 'delete',
          url,
          headers,
          timeout,
          params: config.body || {}
        });
      } else {
        response = await axios({
          method: method.toLowerCase() as 'post' | 'put' | 'patch',
          url,
          headers,
          timeout,
          data: config.body || input
        });
      }

      return {
        status: response.status,
        headers: response.headers,
        data: response.data
      };

    } catch (error: any) {
      if (error.response) {
        // HTTP error response
        throw new NodeExecutionErrorImpl(
          'HTTP_ERROR',
          `HTTP ${error.response.status}: ${error.response.statusText}`,
          {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          },
          error.response.status >= 500, // 5xx errors are retryable
          'network'
        );
      }

      if (error instanceof NodeExecutionErrorImpl) {
        throw error;
      }

      // Network or other error
      throw new NodeExecutionErrorImpl(
        'NETWORK_ERROR',
        `Network error: ${error.message}`,
        { originalError: error.code },
        true,
        'network'
      );
    }
  }

  /**
   * Execute webhook node - similar to API call but for outbound webhooks
   */
  private async executeWebhook(
    node: GraphNode,
    context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    // Create a webhook-specific node structure
    const webhookNode: GraphNode = {
      ...node,
      config: {
        ...node.config,
        method: 'POST' as const,
        body: {
          event: 'workflow_event',
          runId: context.runId,
          nodeId: node.id,
          timestamp: new Date().toISOString(),
          data: input
        }
      }
    };

    return this.executeApiCall(webhookNode, context, input);
  }

  /**
   * Execute email node (placeholder implementation)
   */
  private async executeEmail(
    node: GraphNode,
    _context: ExecutionContext,
    _input: Record<string, any>
  ): Promise<any> {
    // Placeholder - would integrate with email service (SES, SendGrid, etc.)
    const config = node.config;
    
    if (!config.to || !config.subject) {
      throw new NodeExecutionErrorImpl(
        'MISSING_EMAIL_CONFIG',
        'Email node requires "to" and "subject" configuration',
        { nodeId: node.id },
        false,
        'validation'
      );
    }

    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      messageId: `msg_${Date.now()}`,
      to: config.to,
      subject: config.subject,
      status: 'sent',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute data transformation node
   */
  private async executeDataTransform(
    node: GraphNode,
    context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    const config = node.config;
    
    if (!config.transformScript) {
      throw new NodeExecutionErrorImpl(
        'MISSING_TRANSFORM_SCRIPT',
        'Data transform node requires a transformScript',
        { nodeId: node.id },
        false,
        'validation'
      );
    }

    try {
      return this.applyTransform(config.transformScript, input, context.variables);
    } catch (error: any) {
      throw new NodeExecutionErrorImpl(
        'TRANSFORM_ERROR',
        `Transform script failed: ${error.message}`,
        { nodeId: node.id, script: config.transformScript },
        false,
        'internal'
      );
    }
  }

  /**
   * Execute condition node
   */
  private async executeCondition(
    node: GraphNode,
    context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    const config = node.config;
    
    if (!config.expression) {
      throw new NodeExecutionErrorImpl(
        'MISSING_CONDITION_EXPRESSION',
        'Condition node requires an expression',
        { nodeId: node.id },
        false,
        'validation'
      );
    }

    try {
      const result = this.evaluateExpression(config.expression, { ...input, ...context.variables });
      return {
        condition: config.expression,
        result: Boolean(result),
        input,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      throw new NodeExecutionErrorImpl(
        'CONDITION_EVALUATION_ERROR',
        `Condition evaluation failed: ${error.message}`,
        { nodeId: node.id, expression: config.expression },
        false,
        'internal'
      );
    }
  }

  /**
   * Execute delay node
   */
  private async executeDelay(
    node: GraphNode,
    _context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    const delayMs = node.config.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return {
      ...input,
      delayed: true,
      delayMs,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute parallel node (placeholder)
   */
  private async executeParallel(
    _node: GraphNode,
    _context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    // Placeholder - parallel execution would be handled at the workflow level
    return {
      ...input,
      parallel: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute integration node (placeholder)
   */
  private async executeIntegration(
    node: GraphNode,
    _context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    // Placeholder for integration-specific logic
    return {
      ...input,
      integration: node.type,
      action: node.config.action || 'unknown',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute user management node (placeholder)
   */
  private async executeUserManagement(
    node: GraphNode,
    _context: ExecutionContext,
    input: Record<string, any>
  ): Promise<any> {
    // Placeholder for user management operations
    if (!node.config.userId && !input.userId) {
      throw new NodeExecutionErrorImpl(
        'MISSING_USER_ID',
        'User management node requires userId in config or input',
        { nodeId: node.id, nodeType: node.type },
        false,
        'validation'
      );
    }

    return {
      ...input,
      userManagement: node.type,
      userId: node.config.userId || input.userId,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Interpolate variables in string templates
   */
  private interpolateString(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  /**
   * Evaluate simple expressions (placeholder)
   */
  private evaluateExpression(expression: string, variables: Record<string, any>): any {
    // Simple expression evaluation - could be enhanced with a proper expression engine
    try {
      // Replace variables in expression
      const interpolated = this.interpolateString(expression, variables);
      
      // Basic evaluation for simple conditions
      if (interpolated.includes('==')) {
        const [left, right] = interpolated.split('==').map(s => s.trim());
        return left === right;
      }
      
      if (interpolated.includes('!=')) {
        const [left, right] = interpolated.split('!=').map(s => s.trim());
        return left !== right;
      }
      
      // Return the interpolated value as-is for other cases
      return interpolated;
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error}`);
    }
  }

  /**
   * Apply data transformation script (placeholder)
   */
  private applyTransform(script: string, input: any, _variables: Record<string, any>): any {
    // Placeholder transformation - in reality would use a secure sandbox
    try {
      // Simple transformations for demo
      if (script === 'uppercase') {
        if (typeof input === 'string') {
          return input.toUpperCase();
        }
        if (typeof input === 'object' && input.text) {
          return { ...input, text: input.text.toUpperCase() };
        }
      }
      
      if (script === 'lowercase') {
        if (typeof input === 'string') {
          return input.toLowerCase();
        }
        if (typeof input === 'object' && input.text) {
          return { ...input, text: input.text.toLowerCase() };
        }
      }
      
      if (script === 'addTimestamp') {
        return { ...input, processedAt: new Date().toISOString() };
      }
      
      // Default: return input unchanged
      return input;
    } catch (error) {
      throw new Error(`Transform script execution failed: ${error}`);
    }
  }
}

/**
 * Internal implementation of NodeExecutionError
 */
class NodeExecutionErrorImpl extends Error {
  public readonly code: string;
  public readonly details: any;
  public readonly retryable: boolean;
  public readonly category: NodeExecutionError['category'];

  constructor(
    code: string,
    message: string,
    details: any = {},
    retryable: boolean = false,
    category: NodeExecutionError['category'] = 'internal'
  ) {
    super(message);
    this.name = 'NodeExecutionError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.category = category;
  }

  toNodeExecutionError(): NodeExecutionError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      category: this.category
    };
  }
} 