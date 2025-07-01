/**
 * Workflow Builder Component
 * 
 * Enterprise-grade workflow builder for creating automation workflows.
 * Supports drag-and-drop interface, integration with all supported services,
 * and real-time validation.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  PlusIcon, 
  PlayIcon, 
  PauseIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

import Card from '../common/Card';
import LoadingSpinner, { InlineLoader } from '../common/LoadingSpinner';
import Badge, { StatusBadge } from '../common/Badge';
import WorkflowCanvas from './WorkflowCanvas';
import WorkflowNodePalette from './WorkflowNodePalette';
import WorkflowProperties from './WorkflowProperties';
import WorkflowExecutionPanel from './WorkflowExecutionPanel';

import {
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useExecuteWorkflow,
  useWorkflowExecutions,
  WorkflowDefinition,
  ApiResponse,
  queryKeys
} from '../../hooks/useApi';

export interface WorkflowBuilderProps {
  tenantId: string;
  workflowId?: string;
  onSave?: (workflow: WorkflowDefinition) => void;
  onExecute?: (executionId: string) => void;
  className?: string;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'integration';
  name: string;
  description?: string;
  integration?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  condition?: string;
}

export interface WorkflowState {
  id?: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive';
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: Record<string, any>;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  tenantId,
  workflowId,
  onSave,
  onExecute,
  className,
}) => {
  // State management
  const [workflow, setWorkflow] = useState<WorkflowState>({
    name: 'New Workflow',
    description: '',
    status: 'draft',
    nodes: [],
    connections: [],
    variables: {},
  });

  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // API hooks
  const {
    data: existingWorkflow,
    isLoading: workflowLoading,
    error: workflowError,
  } = useWorkflow(tenantId, workflowId || '', { 
    enabled: !!workflowId,
    queryKey: queryKeys.workflows.detail(tenantId, workflowId || ''),
  });

  const createWorkflowMutation = useCreateWorkflow();
  const updateWorkflowMutation = useUpdateWorkflow();
  const executeWorkflowMutation = useExecuteWorkflow();

  const {
    data: executionsData,
    isLoading: executionsLoading,
  } = useWorkflowExecutions(tenantId, workflowId || '', { page: 1, limit: 10 });

  // Load existing workflow data
  React.useEffect(() => {
    if (existingWorkflow?.data) {
      const data = existingWorkflow.data;
      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        nodes: data.nodes || [],
        connections: data.connections || [],
        variables: {},
      });
    }
  }, [existingWorkflow]);

  // Validation
  const validateWorkflow = useCallback((workflowState: WorkflowState): string[] => {
    const errors: string[] = [];
    
    if (!workflowState.name.trim()) {
      errors.push('Workflow name is required');
    }
    
    if (workflowState.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }
    
    const triggerNodes = workflowState.nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger');
    }
    
    // Check for disconnected nodes
    const connectedNodeIds = new Set([
      ...workflowState.connections.map(c => c.sourceId),
      ...workflowState.connections.map(c => c.targetId),
    ]);
    
    const disconnectedNodes = workflowState.nodes.filter(
      n => n.type !== 'trigger' && !connectedNodeIds.has(n.id)
    );
    
    if (disconnectedNodes.length > 0) {
      errors.push(`${disconnectedNodes.length} node(s) are not connected`);
    }
    
    return errors;
  }, []);

  // Update validation when workflow changes
  React.useEffect(() => {
    const errors = validateWorkflow(workflow);
    setValidationErrors(errors);
  }, [workflow, validateWorkflow]);

  // Handlers
  const handleNodeAdd = useCallback((nodeType: WorkflowNode['type'], integration?: string) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: nodeType,
      name: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
      integration,
      config: {},
      position: { x: 100, y: 100 },
    };
    
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      connections: prev.connections.filter(
        conn => conn.sourceId !== nodeId && conn.targetId !== nodeId
      ),
    }));
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const handleConnectionAdd = useCallback((sourceId: string, targetId: string) => {
    const newConnection: WorkflowConnection = {
      id: `conn_${Date.now()}`,
      sourceId,
      targetId,
    };
    
    setWorkflow(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection],
    }));
  }, []);

  const handleConnectionDelete = useCallback((connectionId: string) => {
    setWorkflow(prev => ({
      ...prev,
      connections: prev.connections.filter(conn => conn.id !== connectionId),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const workflowData = {
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        connections: workflow.connections,
      };

      let result: ApiResponse<WorkflowDefinition>;
      if (workflow.id) {
        result = await updateWorkflowMutation.mutateAsync({
          tenantId,
          workflowId: workflow.id,
          workflow: workflowData,
        });
      } else {
        result = await createWorkflowMutation.mutateAsync({
          tenantId,
          workflow: workflowData,
        });
      }

      if (result?.data) {
        setWorkflow(prev => ({ ...prev, id: result.data.id }));
        onSave?.(result.data);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  }, [workflow, tenantId, updateWorkflowMutation, createWorkflowMutation, onSave]);

  const handleExecute = useCallback(async () => {
    if (!workflow.id || validationErrors.length > 0) return;
    
    try {
      setIsExecuting(true);
      const result = await executeWorkflowMutation.mutateAsync({
        tenantId,
        workflowId: workflow.id,
        input: workflow.variables,
      });
      
      if (result.data) {
        onExecute?.(result.data.id);
        setShowExecutionPanel(true);
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [workflow, tenantId, validationErrors, executeWorkflowMutation, onExecute]);

  const handleDuplicate = useCallback(() => {
    setWorkflow(prev => ({
      ...prev,
      id: undefined,
      name: `${prev.name} (Copy)`,
      status: 'draft' as const,
    }));
  }, []);

  // Computed values
  const isValid = validationErrors.length === 0;
  const hasChanges = true; // TODO: Implement proper change detection
  const canExecute = isValid && workflow.status === 'active' && workflow.id;

  // Loading state
  if (workflowLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <InlineLoader text="Loading workflow..." />
      </div>
    );
  }

  // Error state
  if (workflowError) {
    return (
      <Card className={className}>
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-error-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to Load Workflow
          </h3>
          <p className="text-gray-600">{workflowError.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {workflow.name}
              </h1>
              <p className="text-sm text-gray-500">
                {workflow.description || 'No description'}
              </p>
            </div>
            <StatusBadge status={workflow.status === 'draft' ? 'pending' : workflow.status} />
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Validation Status */}
            {validationErrors.length > 0 && (
              <div className="flex items-center space-x-2 text-error-600">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span className="text-sm">{validationErrors.length} error(s)</span>
              </div>
            )}
            
            {isValid && (
              <div className="flex items-center space-x-2 text-success-600">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-sm">Valid</span>
              </div>
            )}
            
            {/* Actions */}
            <button
              onClick={handleDuplicate}
              className="btn-secondary"
              title="Duplicate workflow"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={handleSave}
              disabled={createWorkflowMutation.isPending || updateWorkflowMutation.isPending}
              className="btn-secondary"
            >
              {(createWorkflowMutation.isPending || updateWorkflowMutation.isPending) ? (
                <LoadingSpinner size="xs" color="gray" />
              ) : (
                'Save'
              )}
            </button>
            
            <button
              onClick={handleExecute}
              disabled={!canExecute || isExecuting}
              className="btn-primary"
            >
              {isExecuting ? (
                <LoadingSpinner size="xs" color="white" />
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Execute
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-md">
            <div className="text-sm text-error-800">
              <p className="font-medium mb-1">Please fix the following issues:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <WorkflowNodePalette
            onNodeAdd={handleNodeAdd}
            integrations={['google-workspace', 'microsoft-365', 'salesforce']}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <WorkflowCanvas
            nodes={workflow.nodes}
            connections={workflow.connections}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            onConnectionAdd={handleConnectionAdd}
            onConnectionDelete={handleConnectionDelete}
          />
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <WorkflowProperties
              node={selectedNode}
              onNodeUpdate={(updates: Partial<WorkflowNode>) => handleNodeUpdate(selectedNode.id, updates)}
              integrations={['google-workspace', 'microsoft-365', 'salesforce']}
            />
          </div>
        )}
      </div>

      {/* Execution Panel */}
      {showExecutionPanel && (
        <WorkflowExecutionPanel
          tenantId={tenantId}
          workflowId={workflow.id || ''}
          executions={executionsData?.data || []}
          loading={executionsLoading}
          onClose={() => setShowExecutionPanel(false)}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder; 