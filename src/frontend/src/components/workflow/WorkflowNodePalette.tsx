/**
 * Workflow Node Palette Component
 * 
 * Provides a palette of available workflow nodes that can be dragged
 * onto the canvas to build automation workflows.
 */

import React from 'react';
import { 
  BoltIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  LinkIcon,
  CloudIcon,
  UserIcon,
  DocumentIcon,
  CalendarIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

import Card from '../common/Card';
import { IntegrationBadge } from '../common/Badge';

export interface WorkflowNodePaletteProps {
  onNodeAdd: (nodeType: 'trigger' | 'action' | 'condition' | 'integration', integration?: string) => void;
  integrations: string[];
  className?: string;
}

interface NodeTemplate {
  type: 'trigger' | 'action' | 'condition' | 'integration';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  integration?: string;
}

export const WorkflowNodePalette: React.FC<WorkflowNodePaletteProps> = ({
  onNodeAdd,
  integrations,
  className,
}) => {
  // Node templates organized by category
  const nodeTemplates: NodeTemplate[] = [
    // Triggers
    {
      type: 'trigger',
      name: 'User Created',
      description: 'Triggers when a new user is created',
      icon: UserIcon,
      category: 'Triggers',
    },
    {
      type: 'trigger',
      name: 'License Assigned',
      description: 'Triggers when a license is assigned',
      icon: DocumentIcon,
      category: 'Triggers',
    },
    {
      type: 'trigger',
      name: 'Schedule',
      description: 'Triggers on a schedule',
      icon: CalendarIcon,
      category: 'Triggers',
    },
    
    // Actions
    {
      type: 'action',
      name: 'Send Email',
      description: 'Send an email notification',
      icon: EnvelopeIcon,
      category: 'Actions',
    },
    {
      type: 'action',
      name: 'Create User',
      description: 'Create a new user account',
      icon: UserIcon,
      category: 'Actions',
    },
    {
      type: 'action',
      name: 'Assign License',
      description: 'Assign a license to a user',
      icon: DocumentIcon,
      category: 'Actions',
    },
    
    // Conditions
    {
      type: 'condition',
      name: 'If/Else',
      description: 'Conditional branching logic',
      icon: QuestionMarkCircleIcon,
      category: 'Logic',
    },
    
    // Integration-specific nodes
    {
      type: 'integration',
      name: 'Google Workspace',
      description: 'Google Workspace actions',
      icon: CloudIcon,
      category: 'Integrations',
      integration: 'google-workspace',
    },
    {
      type: 'integration',
      name: 'Microsoft 365',
      description: 'Microsoft 365 actions',
      icon: CloudIcon,
      category: 'Integrations',
      integration: 'microsoft-365',
    },
    {
      type: 'integration',
      name: 'Salesforce',
      description: 'Salesforce actions',
      icon: CloudIcon,
      category: 'Integrations',
      integration: 'salesforce',
    },
  ];

  // Group templates by category
  const groupedTemplates = nodeTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  // Filter integration nodes based on available integrations
  if (groupedTemplates.Integrations) {
    groupedTemplates.Integrations = groupedTemplates.Integrations.filter(
      template => !template.integration || integrations.includes(template.integration)
    );
  }

  const handleNodeDragStart = (e: React.DragEvent, template: NodeTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: template.type,
      name: template.name,
      integration: template.integration,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleNodeClick = (template: NodeTemplate) => {
    onNodeAdd(template.type, template.integration);
  };

  return (
    <div className={`h-full ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Workflow Nodes</h3>
        <p className="text-xs text-gray-500 mt-1">
          Drag or click to add to workflow
        </p>
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto">
        {Object.entries(groupedTemplates).map(([category, templates]) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-3">
              {category}
            </h4>
            
            <div className="space-y-2">
              {templates.map((template, index) => (
                <div
                  key={`${category}-${index}`}
                  draggable
                  onDragStart={(e) => handleNodeDragStart(e, template)}
                  onClick={() => handleNodeClick(template)}
                  className="group p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  title={template.description}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <template.icon className="h-5 w-5 text-gray-400 group-hover:text-primary-500" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {template.name}
                        </p>
                        
                        {template.integration && (
                          <IntegrationBadge 
                            integration={template.integration} 
                            size="xs"
                          />
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Custom Actions */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-3">
            Custom
          </h4>
          
          <button
            onClick={() => onNodeAdd('action')}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-primary-300 hover:bg-primary-50 transition-colors group"
          >
            <BoltIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 group-hover:text-primary-600">
              Custom Action
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Create a custom workflow action
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowNodePalette; 