import {
  Workflow,
  WorkflowTask,
  WorkflowDependency,
  DependencyCondition,
} from '../types';

/**
 * GraphBuilder - Builds and validates workflow execution graphs
 * 
 * Handles:
 * - Dependency graph construction
 * - Cycle detection
 * - Execution order planning
 * - Parallel execution optimization
 */
export class GraphBuilder {
  /**
   * Build execution graph from workflow definition
   */
  public buildExecutionGraph(workflow: Workflow): ExecutionGraph {
    this.validateWorkflow(workflow);
    
    const nodes = this.createNodes(workflow.tasks);
    const edges = this.createEdges(workflow.dependencies);
    
    this.detectCycles(nodes, edges);
    
    const executionPlan = this.calculateExecutionOrder(nodes, edges);
    const parallelGroups = this.identifyParallelGroups(executionPlan);
    
    return {
      workflowId: workflow.id,
      nodes,
      edges,
      executionPlan,
      parallelGroups,
      metadata: {
        totalTasks: nodes.length,
        parallelizationLevel: this.calculateParallelizationLevel(parallelGroups),
        estimatedDuration: this.estimateExecutionTime(workflow.tasks, parallelGroups),
      },
    };
  }

  /**
   * Validate workflow structure and dependencies
   */
  private validateWorkflow(workflow: Workflow): void {
    if (!workflow.tasks || workflow.tasks.length === 0) {
      throw new GraphValidationError('Workflow must contain at least one task');
    }

    // Validate task IDs are unique
    const taskIds = new Set<string>();
    for (const task of workflow.tasks) {
      if (taskIds.has(task.id)) {
        throw new GraphValidationError(`Duplicate task ID: ${task.id}`);
      }
      taskIds.add(task.id);
    }

    // Validate dependency references
    for (const dependency of workflow.dependencies) {
      if (!taskIds.has(dependency.fromTaskId)) {
        throw new GraphValidationError(`Unknown task ID in dependency: ${dependency.fromTaskId}`);
      }
      if (!taskIds.has(dependency.toTaskId)) {
        throw new GraphValidationError(`Unknown task ID in dependency: ${dependency.toTaskId}`);
      }
      if (dependency.fromTaskId === dependency.toTaskId) {
        throw new GraphValidationError(`Self-referential dependency: ${dependency.fromTaskId}`);
      }
    }
  }

  /**
   * Create graph nodes from workflow tasks
   */
  private createNodes(tasks: WorkflowTask[]): GraphNode[] {
    return tasks.map(task => ({
      id: task.id,
      task,
      inDegree: 0,
      outDegree: 0,
      dependencies: [],
      dependents: [],
      level: 0,
      canExecuteInParallel: false,
    }));
  }

  /**
   * Create graph edges from workflow dependencies
   */
  private createEdges(dependencies: WorkflowDependency[]): GraphEdge[] {
    return dependencies.map(dep => ({
      from: dep.fromTaskId,
      to: dep.toTaskId,
      condition: dep.condition || { type: 'success' },
      weight: this.calculateEdgeWeight(dep.condition),
    }));
  }

  /**
   * Calculate edge weight based on condition complexity
   */
  private calculateEdgeWeight(condition?: DependencyCondition): number {
    if (!condition) return 1;
    
    switch (condition.type) {
      case 'always':
        return 0.5;
      case 'success':
        return 1;
      case 'failure':
        return 1.5;
      case 'custom':
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Detect cycles in the dependency graph using DFS
   */
  private detectCycles(nodes: GraphNode[], edges: GraphEdge[]): void {
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(node => nodeMap.set(node.id, node));

    // Build adjacency list
    const adjList = new Map<string, string[]>();
    nodes.forEach(node => adjList.set(node.id, []));
    
    edges.forEach(edge => {
      adjList.get(edge.from)?.push(edge.to);
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (fromNode && toNode) {
        fromNode.dependents.push(edge.to);
        toNode.dependencies.push(edge.from);
        toNode.inDegree++;
        fromNode.outDegree++;
      }
    });

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        throw new GraphValidationError(`Cycle detected: ${cycle.join(' -> ')}`);
      }

      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor, [...path])) return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        hasCycle(node.id, []);
      }
    }
  }

  /**
   * Calculate execution order using topological sort
   */
  private calculateExecutionOrder(nodes: GraphNode[], edges: GraphEdge[]): string[] {
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(node => nodeMap.set(node.id, { ...node }));

    const queue: string[] = [];
    const result: string[] = [];

    // Find nodes with no incoming edges
    nodes.forEach(node => {
      if (node.inDegree === 0) {
        queue.push(node.id);
        nodeMap.get(node.id)!.level = 0;
      }
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      result.push(currentId);
      
      const currentNode = nodeMap.get(currentId)!;
      
      // Process dependents
      currentNode.dependents.forEach(dependentId => {
        const dependentNode = nodeMap.get(dependentId)!;
        dependentNode.inDegree--;
        dependentNode.level = Math.max(dependentNode.level, currentNode.level + 1);
        
        if (dependentNode.inDegree === 0) {
          queue.push(dependentId);
        }
      });
    }

    if (result.length !== nodes.length) {
      throw new GraphValidationError('Unable to create execution order - graph may contain cycles');
    }

    return result;
  }

  /**
   * Identify tasks that can be executed in parallel
   */
  private identifyParallelGroups(executionOrder: string[]): ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const processed = new Set<string>();
    
    for (const taskId of executionOrder) {
      if (processed.has(taskId)) continue;
      
      const group: ParallelGroup = {
        level: 0,
        tasks: [taskId],
        estimatedDuration: 0,
      };
      
      processed.add(taskId);
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Calculate parallelization level (max concurrent tasks)
   */
  private calculateParallelizationLevel(groups: ParallelGroup[]): number {
    return Math.max(...groups.map(group => group.tasks.length));
  }

  /**
   * Estimate total execution time considering parallel execution
   */
  private estimateExecutionTime(tasks: WorkflowTask[], groups: ParallelGroup[]): number {
    const taskDurations = new Map<string, number>();
    tasks.forEach(task => {
      taskDurations.set(task.id, task.timeout || 30000); // Default 30s
    });

    let totalTime = 0;
    for (const group of groups) {
      const groupMaxTime = Math.max(
        ...group.tasks.map(taskId => taskDurations.get(taskId) || 0)
      );
      totalTime += groupMaxTime;
    }

    return totalTime;
  }
}

// Types
export interface ExecutionGraph {
  workflowId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  executionPlan: string[];
  parallelGroups: ParallelGroup[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  task: WorkflowTask;
  inDegree: number;
  outDegree: number;
  dependencies: string[];
  dependents: string[];
  level: number;
  canExecuteInParallel: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  condition: DependencyCondition;
  weight: number;
}

export interface ParallelGroup {
  level: number;
  tasks: string[];
  estimatedDuration: number;
}

export interface GraphMetadata {
  totalTasks: number;
  parallelizationLevel: number;
  estimatedDuration: number;
}

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphValidationError';
  }
} 