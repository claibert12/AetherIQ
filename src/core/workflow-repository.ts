import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { WorkflowGraph } from '../types/workflow';

/**
 * DynamoDB helper for workflow graph operations
 * Handles: Loading workflow definitions, version management, caching
 */
export class WorkflowRepository {
  private docClient: DynamoDBDocumentClient;
  private workflowsTable: string;
  private cache: Map<string, WorkflowGraph> = new Map();

  constructor() {
    const client = new DynamoDBClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.workflowsTable = process.env.WORKFLOWS_TABLE || 'workflows';
  }

  /**
   * Get workflow definition by ID
   * Uses caching to avoid repeated DynamoDB calls
   */
  async getWorkflow(workflowId: string, version?: string): Promise<WorkflowGraph | null> {
    const cacheKey = `${workflowId}:${version || 'latest'}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      let workflow: WorkflowGraph | null = null;

      if (version) {
        // Get specific version
        workflow = await this.getWorkflowVersion(workflowId, version);
      } else {
        // Get latest version
        workflow = await this.getLatestWorkflow(workflowId);
      }

      // Cache the result
      if (workflow) {
        this.cache.set(cacheKey, workflow);
      }

      return workflow;
    } catch (error: any) {
      throw new WorkflowRepositoryError(`Failed to get workflow: ${error.message}`, error);
    }
  }

  /**
   * Get specific version of a workflow
   */
  private async getWorkflowVersion(workflowId: string, version: string): Promise<WorkflowGraph | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.workflowsTable,
      Key: { 
        id: workflowId,
        version: version
      }
    }));

    return result.Item ? (result.Item as WorkflowGraph) : null;
  }

  /**
   * Get latest version of a workflow
   */
  private async getLatestWorkflow(workflowId: string): Promise<WorkflowGraph | null> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.workflowsTable,
      KeyConditionExpression: 'id = :workflowId',
      ExpressionAttributeValues: {
        ':workflowId': workflowId
      },
      ScanIndexForward: false, // Descending order
      Limit: 1
    }));

    return result.Items && result.Items.length > 0 ? (result.Items[0] as WorkflowGraph) : null;
  }

  /**
   * Validate workflow graph structure
   */
  validateWorkflow(workflow: WorkflowGraph): ValidationResult {
    const errors: string[] = [];

    // Check for required nodes
    const startNodes = workflow.nodes.filter(n => n.type === 'START');
    const endNodes = workflow.nodes.filter(n => n.type === 'END');

    if (startNodes.length === 0) {
      errors.push('Workflow must have at least one START node');
    }

    if (startNodes.length > 1) {
      errors.push('Workflow can only have one START node');
    }

    if (endNodes.length === 0) {
      errors.push('Workflow must have at least one END node');
    }

    // Check for orphaned nodes
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const connectedNodes = new Set<string>();
    
    workflow.edges.forEach(edge => {
      connectedNodes.add(edge.fromNodeId);
      connectedNodes.add(edge.toNodeId);
    });

    const orphanedNodes = workflow.nodes.filter(n => 
      n.type !== 'START' && n.type !== 'END' && !connectedNodes.has(n.id)
    );

    if (orphanedNodes.length > 0) {
      errors.push(`Orphaned nodes found: ${orphanedNodes.map(n => n.id).join(', ')}`);
    }

    // Check for invalid edge references
    workflow.edges.forEach(edge => {
      if (!nodeIds.has(edge.fromNodeId)) {
        errors.push(`Edge references invalid fromNodeId: ${edge.fromNodeId}`);
      }
      if (!nodeIds.has(edge.toNodeId)) {
        errors.push(`Edge references invalid toNodeId: ${edge.toNodeId}`);
      }
    });

    // Check for cycles (basic check)
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Basic cycle detection using DFS
   */
  private hasCycles(workflow: WorkflowGraph): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const adjacencyList = new Map<string, string[]>();
    workflow.edges.forEach(edge => {
      if (!adjacencyList.has(edge.fromNodeId)) {
        adjacencyList.set(edge.fromNodeId, []);
      }
      adjacencyList.get(edge.fromNodeId)!.push(edge.toNodeId);
    });

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class WorkflowRepositoryError extends Error {
  public readonly originalError?: Error | undefined;

  constructor(message: string, originalError?: Error | undefined) {
    super(message);
    this.name = 'WorkflowRepositoryError';
    this.originalError = originalError;
  }
} 