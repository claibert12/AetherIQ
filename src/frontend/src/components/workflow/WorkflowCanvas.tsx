/**
 * Workflow Canvas Component
 * 
 * Provides the main canvas for building workflows with drag-and-drop
 * functionality, node connections, and visual workflow representation.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { 
  TrashIcon,
  Cog6ToothIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { WorkflowNode, WorkflowConnection } from './WorkflowBuilder';

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  selectedNode: WorkflowNode | null;
  onNodeSelect: (node: WorkflowNode | null) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onNodeDelete: (nodeId: string) => void;
  onConnectionAdd: (sourceId: string, targetId: string) => void;
  onConnectionDelete: (connectionId: string) => void;
  className?: string;
}

interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: { x: number; y: number };
}

interface ConnectionState {
  isConnecting: boolean;
  sourceNodeId: string | null;
  mousePosition: { x: number; y: number };
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  connections,
  selectedNode,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  onConnectionAdd,
  onConnectionDelete,
  className,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 },
  });
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnecting: false,
    sourceNodeId: null,
    mousePosition: { x: 0, y: 0 },
  });

  // Handle canvas drop for new nodes
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const nodeData = JSON.parse(e.dataTransfer.getData('application/json'));
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      
      if (canvasRect) {
        const position = {
          x: e.clientX - canvasRect.left,
          y: e.clientY - canvasRect.top,
        };
        
        // This would trigger node creation in the parent component
        // For now, we'll just handle positioning of existing nodes
      }
    } catch (error) {
      console.error('Failed to parse dropped node data:', error);
    }
  }, []);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle node dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    
    const nodeElement = e.currentTarget as HTMLElement;
    const rect = nodeElement.getBoundingClientRect();
    
    setDragState({
      isDragging: true,
      nodeId: node.id,
      offset: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    });
    
    onNodeSelect(node);
  }, [onNodeSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState.isDragging && dragState.nodeId && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newPosition = {
        x: e.clientX - canvasRect.left - dragState.offset.x,
        y: e.clientY - canvasRect.top - dragState.offset.y,
      };
      
      onNodeUpdate(dragState.nodeId, { position: newPosition });
    }
    
    if (connectionState.isConnecting) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        setConnectionState(prev => ({
          ...prev,
          mousePosition: {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top,
          },
        }));
      }
    }
  }, [dragState, connectionState, onNodeUpdate]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      nodeId: null,
      offset: { x: 0, y: 0 },
    });
    
    setConnectionState({
      isConnecting: false,
      sourceNodeId: null,
      mousePosition: { x: 0, y: 0 },
    });
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (dragState.isDragging || connectionState.isConnecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, connectionState.isConnecting, handleMouseMove, handleMouseUp]);

  // Handle connection creation
  const handleConnectionStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    
    setConnectionState({
      isConnecting: true,
      sourceNodeId: nodeId,
      mousePosition: { x: 0, y: 0 },
    });
  }, []);

  const handleConnectionEnd = useCallback((e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    
    if (connectionState.isConnecting && connectionState.sourceNodeId && 
        connectionState.sourceNodeId !== targetNodeId) {
      onConnectionAdd(connectionState.sourceNodeId, targetNodeId);
    }
    
    setConnectionState({
      isConnecting: false,
      sourceNodeId: null,
      mousePosition: { x: 0, y: 0 },
    });
  }, [connectionState, onConnectionAdd]);

  // Get node type styling
  const getNodeStyling = (node: WorkflowNode) => {
    const baseClasses = "absolute bg-white border-2 rounded-lg shadow-sm cursor-move transition-all";
    const selectedClasses = selectedNode?.id === node.id ? "border-primary-500 shadow-lg" : "border-gray-300";
    
    const typeClasses = {
      trigger: "border-l-4 border-l-green-500",
      action: "border-l-4 border-l-blue-500", 
      condition: "border-l-4 border-l-yellow-500",
      integration: "border-l-4 border-l-purple-500",
    };
    
    return `${baseClasses} ${selectedClasses} ${typeClasses[node.type]}`;
  };

  // Get connection path
  const getConnectionPath = (source: WorkflowNode, target: WorkflowNode) => {
    const sourceX = source.position.x + 120; // Node width
    const sourceY = source.position.y + 40; // Half node height
    const targetX = target.position.x;
    const targetY = target.position.y + 40;
    
    const midX = (sourceX + targetX) / 2;
    
    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  };

  return (
    <div
      ref={canvasRef}
      className={`relative bg-gray-50 overflow-hidden ${className}`}
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
      onClick={() => onNodeSelect(null)}
    >
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Connections */}
      <svg className="absolute inset-0 pointer-events-none">
        {connections.map((connection) => {
          const sourceNode = nodes.find(n => n.id === connection.sourceId);
          const targetNode = nodes.find(n => n.id === connection.targetId);
          
          if (!sourceNode || !targetNode) return null;
          
          return (
            <g key={connection.id}>
              <path
                d={getConnectionPath(sourceNode, targetNode)}
                stroke="#6b7280"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              <circle
                cx={(sourceNode.position.x + 120 + targetNode.position.x) / 2}
                cy={(sourceNode.position.y + 40 + targetNode.position.y + 40) / 2}
                r="8"
                fill="#ef4444"
                className="cursor-pointer pointer-events-auto"
                onClick={() => onConnectionDelete(connection.id)}
              >
                <title>Delete connection</title>
              </circle>
            </g>
          );
        })}
        
        {/* Active connection line */}
        {connectionState.isConnecting && connectionState.sourceNodeId && (
          <line
            x1={nodes.find(n => n.id === connectionState.sourceNodeId)?.position.x! + 120}
            y1={nodes.find(n => n.id === connectionState.sourceNodeId)?.position.y! + 40}
            x2={connectionState.mousePosition.x}
            y2={connectionState.mousePosition.y}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        )}
        
        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#6b7280"
            />
          </marker>
        </defs>
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className={getNodeStyling(node)}
          style={{
            left: node.position.x,
            top: node.position.y,
            width: '240px',
            minHeight: '80px',
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node)}
        >
          <div className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {node.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {node.type} {node.integration && `• ${node.integration}`}
                </p>
                {node.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {node.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeSelect(node);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Configure node"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                </button>
                
                <button
                  onClick={(e) => handleConnectionStart(e, node.id)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Create connection"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeDelete(node.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete node"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Connection points */}
          <div
            className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full cursor-pointer"
            onClick={(e) => handleConnectionStart(e, node.id)}
            title="Drag to create connection"
          />
          
          <div
            className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gray-400 rounded-full"
            onClick={(e) => handleConnectionEnd(e, node.id)}
            title="Connection target"
          />
        </div>
      ))}
      
      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <LinkIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start Building Your Workflow
            </h3>
            <p className="text-gray-500 max-w-sm">
              Drag nodes from the palette on the left to start building your automation workflow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvas; 