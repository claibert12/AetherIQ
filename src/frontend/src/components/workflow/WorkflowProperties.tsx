/**
 * Workflow Properties Component (Placeholder)
 * 
 * Properties panel for configuring workflow nodes.
 */

import React from 'react';
import { WorkflowNode } from './WorkflowBuilder';

export interface WorkflowPropertiesProps {
  node: WorkflowNode;
  onNodeUpdate: (updates: Partial<WorkflowNode>) => void;
  integrations: string[];
  className?: string;
}

export const WorkflowProperties: React.FC<WorkflowPropertiesProps> = ({
  node,
  onNodeUpdate,
  integrations,
  className,
}) => {
  return (
    <div className={`p-4 ${className}`}>
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900">Node Properties</h3>
        <p className="text-sm text-gray-500">Configure {node.name}</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => onNodeUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={node.description || ''}
            onChange={(e) => onNodeUpdate({ description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        {node.type === 'integration' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Integration
            </label>
            <select
              value={node.integration || ''}
              onChange={(e) => onNodeUpdate({ integration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select integration...</option>
              {integrations.map((integration) => (
                <option key={integration} value={integration}>
                  {integration}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Node Type: {node.type}
          </p>
          <p className="text-xs text-gray-500">
            Node ID: {node.id}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkflowProperties; 