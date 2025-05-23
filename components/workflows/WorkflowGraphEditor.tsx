import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, WorkflowTransition } from '@/types/database';

interface StateNode {
  id: string;
  name: string;
  x: number;
  y: number;
  isAnyStateTarget: boolean;
}

interface WorkflowGraphEditorProps {
  states: ProjectState[];
  transitions: WorkflowTransition[];
  onTransitionCreate: (fromStateId: string | null, toStateId: string) => void;
  onTransitionDelete: (fromStateId: string | null, toStateId: string) => void;
  onToggleAnyStateTransition: (stateId: string, enabled: boolean) => void;
}

const WorkflowGraphEditor: React.FC<WorkflowGraphEditorProps> = ({
  states,
  transitions,
  onTransitionCreate,
  onTransitionDelete,
  onToggleAnyStateTransition
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<StateNode[]>([]);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [drawingTransition, setDrawingTransition] = useState<{ fromId: string, fromX: number, fromY: number, toX: number, toY: number } | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });

  // Initialize nodes based on states
  useEffect(() => {
    if (states.length === 0) return;

    // If we already have position data for nodes, keep it
    if (nodes.length > 0) {
      const updatedNodes = states.map(state => {
        const existingNode = nodes.find(n => n.id === state.id);
        if (existingNode) {
          return {
            ...existingNode,
            name: state.name // Update name in case it changed
          };
        }
        
        // Create new node with initial position in a grid layout
        const index = states.findIndex(s => s.id === state.id);
        const row = Math.floor(index / 3);
        const col = index % 3;
        
        return {
          id: state.id,
          name: state.name,
          x: 150 + col * 200,
          y: 100 + row * 120,
          isAnyStateTarget: transitions.some(t => t.from_state === null && t.to_state === state.id)
        };
      });
      
      setNodes(updatedNodes);
    } else {
      // Initial layout in a grid pattern
      const initialNodes = states.map((state, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        
        return {
          id: state.id,
          name: state.name,
          x: 150 + col * 200,
          y: 100 + row * 120,
          isAnyStateTarget: transitions.some(t => t.from_state === null && t.to_state === state.id)
        };
      });
      
      setNodes(initialNodes);
    }
  }, [states, transitions, nodes]);

  // Update nodes when transitions change (to update isAnyStateTarget property)
  useEffect(() => {
    setNodes(prev => prev.map(node => ({
      ...node,
      isAnyStateTarget: transitions.some(t => t.from_state === null && t.to_state === node.id)
    })));
  }, [transitions]);

  // Handle node dragging
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Start drawing a transition if holding shift
    if (e.shiftKey) {
      setDrawingTransition({
        fromId: nodeId,
        fromX: node.x,
        fromY: node.y,
        toX: e.clientX - (canvasRef.current?.getBoundingClientRect().left || 0) - canvasOffset.x,
        toY: e.clientY - (canvasRef.current?.getBoundingClientRect().top || 0) - canvasOffset.y
      });
      return;
    }

    // Otherwise, start dragging the node
    setDraggingNode(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    });
  };

  // Handle mouse move for node dragging or transition drawing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - canvasOffset.x;
    const y = e.clientY - canvasRect.top - canvasOffset.y;

    // Handle node dragging
    if (draggingNode) {
      setNodes(prev => prev.map(node => 
        node.id === draggingNode 
          ? { ...node, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : node
      ));
      return;
    }

    // Handle transition drawing
    if (drawingTransition) {
      setDrawingTransition({
        ...drawingTransition,
        toX: x,
        toY: y
      });
      return;
    }

    // Handle canvas dragging
    if (isDraggingCanvas) {
      const deltaX = e.clientX - startDragPos.x;
      const deltaY = e.clientY - startDragPos.y;
      setCanvasOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setStartDragPos({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Handle mouse up for node dragging or transition completion
  const handleMouseUp = (e: React.MouseEvent) => {
    // If we were drawing a transition, check if we're over another node
    if (drawingTransition) {
      const targetNode = nodes.find(node => {
        const distance = Math.sqrt(
          Math.pow(node.x - drawingTransition.toX, 2) +
          Math.pow(node.y - drawingTransition.toY, 2)
        );
        return distance < 50; // Node radius + some margin
      });

      // If we found a target node and it's not the same as the source, create a transition
      if (targetNode && targetNode.id !== drawingTransition.fromId) {
        onTransitionCreate(drawingTransition.fromId, targetNode.id);
      }
      
      setDrawingTransition(null);
    }

    setDraggingNode(null);
    setIsDraggingCanvas(false);
  };

  // Handle canvas dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !e.shiftKey) { // Left click without shift
      setIsDraggingCanvas(true);
      setStartDragPos({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Handle toggling "any state" transition
  const handleToggleAnyTransition = (nodeId: string, checked: boolean) => {
    onToggleAnyStateTransition(nodeId, checked);
  };

  // Find a node by ID
  const getNodeById = (id: string) => nodes.find(node => node.id === id);

  // Calculate arrow path between two nodes
  const getArrowPath = (fromNode: StateNode, toNode: StateNode, isAnyState = false) => {
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const angle = Math.atan2(dy, dx);
    
    // Node radius
    const r = 50;
    
    // Start and end points considering node radius
    const startX = fromNode.x + r * Math.cos(angle);
    const startY = fromNode.y + r * Math.sin(angle);
    const endX = toNode.x - r * Math.cos(angle);
    const endY = toNode.y - r * Math.sin(angle);
    
    // Arrow head
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6; // 30 degrees
    
    const arrowPoint1X = endX - arrowLength * Math.cos(angle - arrowAngle);
    const arrowPoint1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
    const arrowPoint2X = endX - arrowLength * Math.cos(angle + arrowAngle);
    const arrowPoint2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      arrowHead: `M ${endX} ${endY} L ${arrowPoint1X} ${arrowPoint1Y} M ${endX} ${endY} L ${arrowPoint2X} ${arrowPoint2Y}`,
      isAnyState
    };
  };

  // Get all arrow paths for visualization
  const getArrowPaths = () => {
    const arrows: { path: string, arrowHead: string, isAnyState: boolean }[] = [];
    
    // Regular transitions
    transitions.forEach(transition => {
      if (transition.from_state !== null) {
        const fromNode = getNodeById(transition.from_state);
        const toNode = getNodeById(transition.to_state);
        
        if (fromNode && toNode) {
          arrows.push(getArrowPath(fromNode, toNode));
        }
      }
    });
    
    // "Any state" transitions
    transitions.forEach(transition => {
      if (transition.from_state === null) {
        const toNode = getNodeById(transition.to_state);
        
        if (toNode) {
          // Draw dashed arrows from all other nodes to this node
          nodes.forEach(fromNode => {
            if (fromNode.id !== toNode.id) {
              arrows.push(getArrowPath(fromNode, toNode, true));
            }
          });
        }
      }
    });
    
    return arrows;
  };

  // Delete a transition on double click
  const handleTransitionDoubleClick = (fromStateId: string, toStateId: string) => {
    onTransitionDelete(fromStateId, toStateId);
  };

  return (
    <div 
      className="relative w-full h-[500px] border border-gray-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 overflow-hidden"
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseDown={handleCanvasMouseDown}
    >
      {/* Canvas that holds all the nodes and arrows */}
      <div 
        className="absolute w-full h-full" 
        style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)` }}
      >
        {/* Render the transition arrows */}
        <svg className="absolute w-full h-full pointer-events-none">
          {getArrowPaths().map((arrow, i) => (
            <g key={i}>
              <path 
                d={arrow.path} 
                stroke={arrow.isAnyState ? "#6366F1" : "#94A3B8"} 
                strokeWidth="2" 
                fill="none" 
                strokeDasharray={arrow.isAnyState ? "5,5" : "none"}
              />
              <path 
                d={arrow.arrowHead} 
                stroke={arrow.isAnyState ? "#6366F1" : "#94A3B8"} 
                strokeWidth="2" 
                fill="none"
              />
            </g>
          ))}
          
          {/* Draw the transition being created */}
          {drawingTransition && (
            <path 
              d={`M ${drawingTransition.fromX} ${drawingTransition.fromY} L ${drawingTransition.toX} ${drawingTransition.toY}`}
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
            />
          )}
        </svg>
        
        {/* Render the state nodes */}
        {nodes.map(node => (
          <div 
            key={node.id}
            className={`absolute w-[100px] h-[100px] flex flex-col items-center justify-center rounded-full cursor-move
              ${node.isAnyStateTarget
                ? 'bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-400 dark:border-indigo-500'
                : 'bg-gray-100 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600'
              }`}
            style={{
              left: node.x - 50, // Center the node
              top: node.y - 50,
              transition: draggingNode === node.id ? 'none' : 'all 0.1s ease'
            }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          >
            <div className="text-sm font-medium text-center px-2 truncate max-w-full">{node.name}</div>
            
            {/* Badge for "any state" target */}
            {node.isAnyStateTarget && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center">
                *
              </div>
            )}
            
            {/* Checkbox for "any state" transitions */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-center">
              <label className="flex items-center text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={node.isAnyStateTarget}
                  onChange={(e) => handleToggleAnyTransition(node.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-zinc-600 dark:text-zinc-400">Any state</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 right-2 text-xs text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-800/80 p-1 rounded">
        <p><strong>Drag</strong>: Move states • <strong>Shift+Drag</strong> from one state to another: Create transition • <strong>Checkbox</strong>: Toggle &quot;Any state can transition here&quot;</p>
      </div>
    </div>
  );
};

export default WorkflowGraphEditor;