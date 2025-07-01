/**
 * Workflow Execution Panel Component (Placeholder)
 * 
 * Panel for viewing workflow execution history and status.
 */

import React from 'react';
import { XMarkIcon, PlayIcon, ClockIcon } from '@heroicons/react/24/outline';

export interface WorkflowExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'pending' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
}

export interface WorkflowExecutionPanelProps {
  tenantId: string;
  workflowId: string;
  executions: WorkflowExecution[];
  loading: boolean;
  onClose: () => void;
  className?: string;
}

export const WorkflowExecutionPanel: React.FC<WorkflowExecutionPanelProps> = ({
  tenantId,
  workflowId,
  executions,
  loading,
  onClose,
  className,
}) => {
  const getStatusIcon = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'running':
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <PlayIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XMarkIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'running':
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Execution History</h3>
          <p className="text-sm text-gray-500">
            Recent executions for this workflow
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading executions...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <PlayIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No Executions Yet
            </h4>
            <p className="text-gray-500">
              This workflow hasn't been executed yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(execution.status)}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        execution.status
                      )}`}
                    >
                      {execution.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(execution.startedAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600">
                  <p>Execution ID: {execution.id}</p>
                  {execution.completedAt && (
                    <p>
                      Duration: {
                        Math.round(
                          (new Date(execution.completedAt).getTime() - 
                           new Date(execution.startedAt).getTime()) / 1000
                        )
                      }s
                    </p>
                  )}
                  {execution.error && (
                    <p className="text-red-600 mt-1">Error: {execution.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowExecutionPanel; 