"use client";

import { Bot, X, PenTool, Calculator, Zap, MessageCircle } from "lucide-react";
import { Workflow, WorkflowNode, WorkflowCanvasProps } from "@/types/workflow";
import { useState, useEffect, useCallback, useRef } from "react";
import { LogSidebar } from "./LogSidebar";
import { EndNodeSidebar } from "./EndNodeSidebar";
import { FeedbackPopup } from "./FeedbackPopup";
import { toast } from 'react-hot-toast';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Smaller React Flow node component with proper handles
const CustomAgentNode = ({ data, selected, id }: { data: any; selected?: boolean; id: string }) => {
  return (
    <div 
      className={`relative theme-card-bg rounded-lg border-2 transition-all theme-shadow cursor-pointer group ${
        selected 
          ? 'border-blue-500 shadow-lg shadow-blue-500/25' 
          : 'theme-border hover:border-gray-400'
      }`}
      style={{
        padding: '6px 8px',
        minWidth: '100px',
        maxWidth: '120px',
        fontSize: '9px'
      }}
    >
      {/* React Flow Handles - Essential for connections */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#6366f1',
          width: 6,
          height: 6,
          border: '1px solid white',
          left: -3
        }}
      />
      {/* End nodes only need target handle, regular agents need both */}
      {data.role !== 'End' && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: '#10b981',
            width: 6,
            height: 6,
            border: '1px solid white',
            right: -3
          }}
        />
      )}
      
      {/* Compact agent content */}
      <div className="flex items-center space-x-1.5">
        <div className={`p-0.5 rounded flex-shrink-0 ${
          data.role === 'End' 
            ? 'bg-red-500' 
            : 'bg-blue-500'
        }`}>
          {data.role === 'End' ? (
            <Zap className="w-2.5 h-2.5 text-white" />
          ) : (
            <Bot className="w-2.5 h-2.5 text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="theme-text-primary font-medium text-[9px] leading-tight truncate">
            {data.label}
          </div>
          <div className="theme-text-muted text-[8px] leading-tight truncate mt-0.5">
            {data.role}
          </div>
        </div>
      </div>
    </div>
  );
};

// Node types for React Flow
const nodeTypes = {
  agent: CustomAgentNode,
};

// Main WorkflowCanvas component wrapped with ReactFlowProvider
function WorkflowCanvasInner({
  workflow,
  selectedNode,
  onSelectNode,
  onDeleteNode,
  onAddNode,
  agents,
  connections,
  isAutoOrchestrating,
  onAgentFeedback,
  finalData,
  finalizedResult,
  executionResults,
}: WorkflowCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [endNodeHovered, setEndNodeHovered] = useState<boolean>(false);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showLogSidebar, setShowLogSidebar] = useState<boolean>(false);
  const [sidebarAgent, setSidebarAgent] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(450);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState<boolean>(false);
  const [feedbackAgent, setFeedbackAgent] = useState<{ id: string; name: string } | null>(null);
  const [showEndNodeSidebar, setShowEndNodeSidebar] = useState<boolean>(false);
  const [endNodeSidebarType, setEndNodeSidebarType] = useState<'output' | 'media'>('output');
  const [endNodeSidebarWidth, setEndNodeSidebarWidth] = useState<number>(400);
  const endNodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Initialize nodes based on agents and edges based on connections
  useEffect(() => {
    console.log('🎨 CANVAS: useEffect triggered - agents changed');
    console.log('🎨 CANVAS: Received agents prop:', agents);
    console.log('🎨 CANVAS: Agents keys:', agents ? Object.keys(agents) : 'null');
    console.log('🎨 CANVAS: Agents count:', agents ? Object.keys(agents).length : 0);
    
    if (agents && Object.keys(agents).length > 0) {
      console.log('🎨 CANVAS: Creating agent nodes for agents:', Object.keys(agents));
      const agentNodes: Node[] = Object.entries(agents).map(([name, agent], index) => ({
        id: `agent-${name}`,
        position: { 
          x: 100 + (index % 3) * 180, // Adjusted spacing for smaller nodes
          y: 150 + Math.floor(index / 3) * 100 
        },
        data: {
          label: agent.name || name,
          role: agent.role,
          capabilities: agent.capabilities || []
        },
        type: 'agent',
        style: {
          width: 100,
          height: 50
        }
      }));
      
      // Add end node
      const endNode: Node = {
        id: 'end-node',
        position: {
          x: 100 + (Object.keys(agents).length % 3) * 180,
          y: 150 + Math.floor(Object.keys(agents).length / 3) * 100 + 100 // Position below last agent
        },
        data: {
          label: 'End',
          role: 'End',
          capabilities: []
        },
        type: 'agent',
        style: {
          width: 100,
          height: 50
        }
      };
      
      const allNodes = [...agentNodes, endNode];
      console.log('🎨 CANVAS: Setting', allNodes.length, 'nodes (including end node)');
      console.log('🎨 CANVAS: Node IDs:', allNodes.map(n => n.id));
      setNodes(allNodes);
      console.log('🎨 CANVAS: ✅ Nodes set successfully');

      // Create connections based on agent input/output relationships
      if (Object.keys(agents).length === 1) {
        // Single agent case - connect directly to end node
        const [agentName] = Object.keys(agents);
        const singleAgentConnection: Edge = {
          id: `${agentName}-to-end`,
          source: `agent-${agentName}`,
          target: 'end-node',
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: '#ff6b6b',
            strokeWidth: 2,
          },
          markerEnd: {
            type: 'arrowclosed' as const,
            width: 15,
            height: 15,
            color: '#ff6b6b',
          },
        };
        setEdges([singleAgentConnection]);
      } else if (agents && Object.keys(agents).length > 1) {
        const agentEntries = Object.entries(agents);
        const generatedConnections: Edge[] = [];
        
        console.log('Available agents for connections:', agentEntries.map(([name, agent]) => ({
          name,
          inputs: agent.inputs,
          outputs: agent.outputs
        })));
        
        // Create connections based on input/output flow
        agentEntries.forEach(([sourceName, sourceAgent], sourceIndex) => {
          if (sourceAgent.outputs && sourceAgent.outputs.length > 0) {
            sourceAgent.outputs.forEach((output: string) => {
              agentEntries.forEach(([targetName, targetAgent], targetIndex) => {
                if (sourceName !== targetName && targetAgent.inputs && targetAgent.inputs.includes(output)) {
                  const connectionId = `${sourceName}-to-${targetName}`;
                  
                  // Avoid duplicate connections
                  if (!generatedConnections.find(conn => conn.id === connectionId)) {
                    generatedConnections.push({
                      id: connectionId,
                      source: `agent-${sourceName}`,
                      target: `agent-${targetName}`,
                      type: 'smoothstep',
                      animated: true,
                      style: {
                        stroke: '#6366f1',
                        strokeWidth: 2,
                      },
                      markerEnd: {
                        type: 'arrowclosed',
                        width: 15,
                        height: 15,
                        color: '#6366f1',
                      },

                    });
                  }
                }
              });
            });
          }
        });
        
        // If no connections generated from input/output matching, create a simple sequential flow
        if (generatedConnections.length === 0 && agentEntries.length >= 2) {
          console.log('No input/output matches found, creating sequential flow');
          for (let i = 0; i < agentEntries.length - 1; i++) {
            const [sourceName] = agentEntries[i];
            const [targetName] = agentEntries[i + 1];
            
            generatedConnections.push({
              id: `seq-${sourceName}-to-${targetName}`,
              source: `agent-${sourceName}`,
              target: `agent-${targetName}`,
              type: 'smoothstep',
              animated: true,
              style: {
                stroke: '#6366f1',
                strokeWidth: 2,
              },
              markerEnd: {
                type: 'arrowclosed' as const,
                width: 15,
                height: 15,
                color: '#6366f1',
              },

            });
          }
        }
        
        // Connect the terminal agent(s) to the end node
        // Find agents that are targets but not sources (terminal agents in the workflow)
        const terminalAgents = agentEntries
          .map(([name]) => name)
          .filter(agentName => {
            const isTarget = generatedConnections.some(conn => conn.target === `agent-${agentName}`);
            const isSource = generatedConnections.some(conn => conn.source === `agent-${agentName}`);
            // Terminal agent: is a target but not a source, OR has no incoming connections (start nodes)
            return isTarget && !isSource;
          });
        
        // If no terminal agents found based on connections, use the last agent in execution order
        if (terminalAgents.length === 0 && agentEntries.length > 0) {
          // For sequential workflows, the last agent is typically the terminal one
          terminalAgents.push(agentEntries[agentEntries.length - 1][0]);
        }
        
        console.log('Terminal agents found for end connection:', terminalAgents);
        console.log('All generated connections before end:', generatedConnections);
        
        terminalAgents.forEach((agentName) => {
          generatedConnections.push({
            id: `${agentName}-to-end`,
            source: `agent-${agentName}`,
            target: 'end-node',
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#ff6b6b',
              strokeWidth: 2,
            },
            markerEnd: {
              type: 'arrowclosed',
              width: 15,
              height: 15,
              color: '#ff6b6b',
            },
          });
        });
        
        console.log('Generated connections:', generatedConnections);
        setEdges(generatedConnections);
        
        // If still no connections but we have at least 2 agents, force a test connection
        if (generatedConnections.length === 0 && agentEntries.length >= 2) {
          console.log('Forcing a test connection between first two agents');
          const [firstName] = agentEntries[0];
          const [secondName] = agentEntries[1];
          
          const testConnection: Edge = {
            id: `test-${firstName}-to-${secondName}`,
            source: `agent-${firstName}`,
            target: `agent-${secondName}`,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#ef4444',
              strokeWidth: 3,
            },
            markerEnd: {
              type: 'arrowclosed' as const,
              width: 15,
              height: 15,
              color: '#ef4444',
            },
          };
          
          // Connect last agent to end node
          const endConnection: Edge = {
            id: `${secondName}-to-end`,
            source: `agent-${secondName}`,
            target: 'end-node',
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#ff6b6b',
              strokeWidth: 2,
            },
            markerEnd: {
              type: 'arrowclosed',
              width: 15,
              height: 15,
              color: '#ff6b6b',
            },
          };
          
          setEdges([testConnection, endConnection]);
        }
      }
    } else {
      console.log('🎨 CANVAS: ❌ No agents or empty agents - clearing nodes');
      setNodes([]);
      setEdges([]);
    }
    
    // Also handle explicit connections if provided (but still add end node connections)
    if (connections && connections.length > 0) {
      console.log('Using explicit connections:', connections);
      const reactFlowEdges: Edge[] = connections.map((connection, index) => ({
        id: connection.id || `edge-${index}`,
        source: connection.source,
        target: connection.target,
        type: 'smoothstep', // Force smoothstep type
        animated: true,
        style: {
          stroke: '#6366f1',
          strokeWidth: 2,
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          width: 15,
          height: 15,
          color: '#6366f1',
        },
      }));
      
      // Find terminal agents from explicit connections and add end node connections
      if (agents) {
        const agentNames = Object.keys(agents);
        const terminalAgents = agentNames.filter(agentName => {
          const agentId = `agent-${agentName}`;
          // Agent is terminal if it's not a source in any connection
          return !reactFlowEdges.some(edge => edge.source === agentId);
        });
        
        // If no terminal agents, use the last agent
        if (terminalAgents.length === 0 && agentNames.length > 0) {
          terminalAgents.push(agentNames[agentNames.length - 1]);
        }
        
        // Add connections to end node
        terminalAgents.forEach(agentName => {
          reactFlowEdges.push({
            id: `${agentName}-to-end`,
            source: `agent-${agentName}`,
            target: 'end-node',
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#ff6b6b',
              strokeWidth: 2,
            },
            markerEnd: {
              type: 'arrowclosed' as const,
              width: 15,
              height: 15,
              color: '#ff6b6b',
            },
          });
        });
        
        console.log('Terminal agents for explicit connections:', terminalAgents);
        console.log('Final edges with end node connections:', reactFlowEdges);
      }
      
      setEdges(reactFlowEdges);
      return; // Use explicit connections with end node connections
    }
  }, [agents, connections]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#6366f1',
          strokeWidth: 2,
        },
        markerEnd: {
          type: 'arrowclosed',
          width: 15,
          height: 15,
          color: '#6366f1',
        },
      };
      setEdges((edgesSnapshot) => addEdge(newEdge, edgesSnapshot));
    },
    []
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedAgent(node.id);
    if (onSelectNode) {
      onSelectNode(node.id);
    }
    
    // Show sidebar for agent nodes (not end node)
    if (node.id !== 'end-node' && node.id.startsWith('agent-')) {
      setSidebarAgent(node.id);
      setShowLogSidebar(true);
    }
  }, [onSelectNode]);

  // Improved hover positioning using ReactFlow's coordinate system
  const handleNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    // Clear any existing timeouts
    if (endNodeTimeoutRef.current) {
      clearTimeout(endNodeTimeoutRef.current);
      endNodeTimeoutRef.current = null;
    }
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    setHoveredNode(node.id);
    
    // Special handling for end node
    if (node.id === 'end-node') {
      setEndNodeHovered(true);
    }
    
    if (reactFlowWrapper.current && reactFlowInstance) {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const viewport = reactFlowInstance.getViewport();
      
      // Transform node position to screen coordinates
      const screenX = node.position.x * viewport.zoom + viewport.x + reactFlowBounds.left;
      const screenY = node.position.y * viewport.zoom + viewport.y + reactFlowBounds.top;
      
      // Position panel to the right of the node with a small gap
      const nodeWidth = 120; // Adjusted for smaller node width
      const gap = 8;
      
      setPanelPosition({
        x: screenX + (nodeWidth * viewport.zoom) + gap,
        y: screenY
      });
    }
  }, [reactFlowInstance]);

  const handleNodeMouseLeave = useCallback((event: React.MouseEvent, node: Node) => {
    // Special handling for end node - delay hiding for 1 second
    if (node.id === 'end-node') {
      endNodeTimeoutRef.current = setTimeout(() => {
        setEndNodeHovered(false);
        setHoveredNode(null);
      }, 1000);
    } else {
      // Add delay for regular nodes to allow mouse interaction with hover card
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredNode(null);
      }, 200);
    }
  }, []);

  const handleCloseEndNodeCard = useCallback(() => {
    if (endNodeTimeoutRef.current) {
      clearTimeout(endNodeTimeoutRef.current);
      endNodeTimeoutRef.current = null;
    }
    setEndNodeHovered(false);
    setHoveredNode(null);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cleanup timeouts on component unmount
  useEffect(() => {
    return () => {
      if (endNodeTimeoutRef.current) {
        clearTimeout(endNodeTimeoutRef.current);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle hover card mouse events
  const handleHoverCardMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleHoverCardMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNode(null);
    }, 200);
  }, []);

  const handleEndCardMouseEnter = useCallback(() => {
    if (endNodeTimeoutRef.current) {
      clearTimeout(endNodeTimeoutRef.current);
      endNodeTimeoutRef.current = null;
    }
    setEndNodeHovered(true); // Ensure it stays visible
  }, []);

  const handleEndCardMouseLeave = useCallback(() => {
    endNodeTimeoutRef.current = setTimeout(() => {
      setEndNodeHovered(false);
      setHoveredNode(null);
    }, 200); // Short delay before hiding
  }, []);

  const handleGetOutput = useCallback(() => {
    setEndNodeSidebarType('output');
    setShowEndNodeSidebar(true);
    setEndNodeHovered(false);
    setHoveredNode(null);
  }, []);

  const handleGetMediaLinks = useCallback(() => {
    setEndNodeSidebarType('media');
    setShowEndNodeSidebar(true);
    setEndNodeHovered(false);
    setHoveredNode(null);
  }, []);

  const handleCloseEndNodeSidebar = useCallback(() => {
    setShowEndNodeSidebar(false);
  }, []);

  // Feedback popup handlers
  const handleShowFeedbackPopup = useCallback((agentId: string, agentName: string) => {
    setFeedbackAgent({ id: agentId, name: agentName });
    setShowFeedbackPopup(true);
    // Clear hover state when opening feedback
    setHoveredNode(null);
  }, []);

  const handleCloseFeedbackPopup = useCallback(() => {
    setShowFeedbackPopup(false);
    setFeedbackAgent(null);
  }, []);

  const handleSaveFeedback = useCallback(async (feedback: string) => {
    if (feedbackAgent && onAgentFeedback) {
      console.log('Saving feedback for agent:', feedbackAgent.id, feedback);
      // Call the parent's feedback handler with save action
      onAgentFeedback(feedbackAgent.id, feedbackAgent.name, 'save', feedback);
    }
  }, [feedbackAgent, onAgentFeedback]);

  const handleEvolveFeedback = useCallback(async (feedbacks: string[]) => {
    if (feedbackAgent && onAgentFeedback) {
      console.log('Evolving agent with feedbacks:', feedbackAgent.id, feedbacks);
      // Call the parent's feedback handler with evolve action
      onAgentFeedback(feedbackAgent.id, feedbackAgent.name, 'evolve', feedbacks);
    }
  }, [feedbackAgent, onAgentFeedback]);

  const addNodeToCanvas = (e: React.DragEvent, nodeData: any) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 60;
    const y = e.clientY - rect.top - 40;

    if (onAddNode) {
      onAddNode(nodeData, { x, y });
    }
  };

  // Mobile touch handlers for adding nodes
  const handleCanvasTap = (e: React.TouchEvent) => {
    if (!isMobile) return;

    // Double tap to add a default node
    const now = Date.now();
    const target = e.currentTarget as any;
    const lastTap = target.lastTap || 0;

    if (now - lastTap < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const touch = e.touches[0] || e.changedTouches[0];
      const x = touch.clientX - rect.left - 60;
      const y = touch.clientY - rect.top - 40;

      // Add a default agent node on double tap
      const defaultAgent = {
        type: "agent",
        name: "New Agent",
        color: "bg-blue-500",
      };

      if (onAddNode) {
        onAddNode(defaultAgent, { x, y });
      }
    }

    target.lastTap = now;
  };

  if (!workflow && !agents) {
    return (
      <div className="flex-1 theme-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Bot
            className={`${
              isMobile ? "w-12 h-12" : "w-16 h-16"
            } theme-text-muted mx-auto mb-4`}
          />
          <h3
            className={`${
              isMobile ? "text-lg" : "text-xl"
            } font-semibold theme-text-primary mb-2`}
          >
            No Workflow Selected
          </h3>
          <p className={`theme-text-secondary ${isMobile ? "text-sm" : ""}`}>
            Create a new workflow to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={reactFlowWrapper}
      className="flex-1 theme-bg relative overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const nodeDataString = e.dataTransfer.getData("text/plain");
        if (nodeDataString) {
          try {
            const nodeData = JSON.parse(nodeDataString);
            addNodeToCanvas(e, nodeData);
          } catch (error) {
            console.error("Error parsing node data:", error);
          }
        }
      }}
      onTouchEnd={isMobile ? handleCanvasTap : undefined}
    >
      {/* Auto Orchestrate Loading Bar */}
      {isAutoOrchestrating && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-200 z-50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-r-full transition-all duration-300 ease-out"
            style={{ 
              width: '100%', 
              animation: 'progress-animation 3s ease-in-out infinite' 
            }}
          />
        </div>
      )}
      
      {/* React Flow Container */}
      <div style={{ width: "100%", height: "100%" }} className="relative">
        {/* Debug info */}
        {(nodes.length > 0 || edges.length > 0) && (
          <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded text-xs z-50 min-w-[100px]">
            <div>Nodes: {nodes.length}</div>
            <div>Edges: {edges.length}</div>
          </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5
          }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          minZoom={0.3}
          maxZoom={2}
          style={{
            background: 'transparent'
          }}
          connectionLineStyle={{
            stroke: '#6366f1',
            strokeWidth: 3,
            strokeDasharray: '5,5',
          }}
          snapToGrid={true}
          snapGrid={[20, 20]}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Meta', 'Ctrl']}
          panOnScroll={true}
          selectionOnDrag={false}
          panOnDrag={true}
          selectNodesOnDrag={false}
        />
      </div>
      
      {/* Enhanced Grid background with smaller pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, var(--text-muted) 1px, transparent 1px),
            linear-gradient(var(--text-muted) 1px, transparent 1px),
            linear-gradient(90deg, var(--text-muted) 1px, transparent 1px)
          `,
          backgroundSize: isMobile ? "20px 20px, 20px 20px, 20px 20px" : "20px 20px, 20px 20px, 20px 20px",
        }}
      />
      
      {/* CSS animations */}
      <style jsx>{`
        @keyframes progress-animation {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 100%; }
        }
        
        @keyframes flow-animation {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Fixed positioning node details panel - rendered at document level */}
      {hoveredNode && agents && hoveredNode !== 'end-node' && hoveredNode.startsWith('agent-') && (
        <div 
          className="fixed theme-card-bg rounded-lg shadow-xl p-3 max-w-xs border theme-border z-[9999] transition-all duration-200 ease-out"
          style={{
            left: `${Math.min(panelPosition.x, window.innerWidth - 320)}px`, // Prevent overflow
            top: `${Math.max(10, Math.min(panelPosition.y, window.innerHeight - 200))}px`, // Prevent overflow
            transform: 'translateY(-50%)', // Center vertically relative to node
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05)'
          }}
          onMouseEnter={handleHoverCardMouseEnter}
          onMouseLeave={handleHoverCardMouseLeave}
        >
          <div className="mb-2">
            <h3 className="font-medium text-sm theme-text-primary">
              {agents[hoveredNode.replace('agent-', '')]?.name || 'Agent Details'}
            </h3>
          </div>
          
          {(() => {
            const agent = agents[hoveredNode.replace('agent-', '')];
            if (!agent) return null;
            
            return (
              <div className="space-y-3 text-xs">
                <div className="pt-2 border-t theme-border">
                  <div className="flex items-center">
                    <span className="theme-text-secondary font-medium min-w-0">Role:</span>
                    <span className="theme-text-primary font-medium text-right ml-2">{agent.role}</span>
                  </div>
                </div>
                
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="space-y-2">
                    <span className="theme-text-secondary font-medium block">Capabilities:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities.slice(0, 3).map((cap, idx) => (
                        <span 
                          key={idx}
                          className="theme-input-bg theme-text-primary border theme-border px-2 py-1 rounded-md text-[10px] font-medium"
                        >
                          {cap}
                        </span>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <span className="theme-text-muted text-[10px] self-center">
                          +{agent.capabilities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Feedback Button */}
                {onAgentFeedback && (
                  <div className="flex justify-center pt-3 border-t theme-border">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const agentName = agents[hoveredNode.replace('agent-', '')]?.name || 'Agent';
                        handleShowFeedbackPopup(hoveredNode, agentName);
                      }}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 theme-button-bg theme-text-primary hover:theme-button-hover rounded-lg transition-all duration-200 text-xs font-medium hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md dark:shadow-lg dark:hover:shadow-xl border border-transparent dark:border-white/20"
                      title="Send Feedback"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send Feedback</span>
                    </button>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t theme-border">
                  <span className="theme-text-secondary font-medium">Status:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 dark:text-green-400 font-medium text-right">Connected</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Special hover card for end node with 1-second delay */}
      {endNodeHovered && hoveredNode === 'end-node' && (
        <div 
          className="fixed theme-card-bg backdrop-blur-sm rounded-lg shadow-2xl p-4 max-w-sm border-2 theme-border z-[9999] transition-all duration-300 ease-out"
          style={{
            left: `${Math.min(panelPosition.x, window.innerWidth - 350)}px`,
            top: `${Math.max(10, Math.min(panelPosition.y, window.innerHeight - 220))}px`,
            transform: 'translateY(-50%)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={handleEndCardMouseEnter}
          onMouseLeave={handleEndCardMouseLeave}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg theme-text-primary">Workflow End</h3>
                <p className="theme-text-secondary text-sm">Final destination</p>
              </div>
            </div>
            <button
              onClick={handleCloseEndNodeCard}
              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 pointer-events-auto"
            >
              <X className="w-4 h-4 theme-text-muted hover:theme-text-primary" />
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="theme-input-bg rounded-lg p-3 border theme-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium theme-text-secondary">Text output:</span>
                <button 
                  onClick={handleGetOutput}
                  className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Get Output
                </button>
              </div>
            </div>
            <div className="theme-input-bg rounded-lg p-3 border theme-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium theme-text-secondary">Media Links:</span>
                <button 
                  onClick={handleGetMediaLinks}
                  className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Get Media Links
                </button>
              </div>
            </div>
            
            <div className="border-t theme-border pt-2">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></div>
                <span className="theme-text-muted text-xs">
                  Workflow completes when this node is reached
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty Canvas Message - only show if no agents */}
      {(!agents || Object.keys(agents).length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="text-center max-w-sm">
            <div
              className={`${
                isMobile ? "w-16 h-16" : "w-24 h-24"
              } theme-card-bg rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed theme-border`}
            >
              <Bot
                className={`${
                  isMobile ? "w-8 h-8" : "w-12 h-12"
                } theme-text-muted`}
              />
            </div>
            <h3
              className={`${
                isMobile ? "text-base" : "text-lg"
              } font-semibold theme-text-primary mb-2`}
            >
              {isMobile
                ? "Tap menu to add agents"
                : "Edit your workflow here"}
            </h3>
            <p
              className={`theme-text-secondary ${
                isMobile ? "text-xs" : "text-sm"
              }`}
            >
              {/* {isMobile
                ? "Use the agent panel to add agents to your workflow"
                : "Select a workflow from the left panel to start building or choose an existing one to continue editing"} */}
                
            </p>
            {isMobile && (
              <p className="theme-text-muted text-xs mt-2">
                Double-tap empty space to add a new agent
              </p>
            )}
          </div>
        </div>
      )}

      {/* Log Sidebar */}
      {showLogSidebar && sidebarAgent && agents && (
        <LogSidebar
          isOpen={showLogSidebar}
          onClose={() => {
            setShowLogSidebar(false);
            setSidebarAgent(null);
          }}
          agentId={sidebarAgent}
          agentName={agents[sidebarAgent.replace('agent-', '')]?.name || 'Agent'}
          agentRole={agents[sidebarAgent.replace('agent-', '')]?.role || 'Agent'}
          agentData={{
            inputs: agents[sidebarAgent.replace('agent-', '')]?.inputs,
            outputs: agents[sidebarAgent.replace('agent-', '')]?.outputs,
            capabilities: agents[sidebarAgent.replace('agent-', '')]?.capabilities,
            inputValues: agents[sidebarAgent.replace('agent-', '')]?.inputValues,
            agentInput: (agents[sidebarAgent.replace('agent-', '')] as any)?.agentInput
          }}
          logsOverride={(() => {
            const selectedKey = sidebarAgent.replace('agent-', '');
            const rawLogs = (agents[selectedKey]?.logs ?? []) as any[];
            if (Array.isArray(rawLogs) && rawLogs.length > 0) {
              if (typeof rawLogs[0] === 'string') {
                return (rawLogs as string[]).map((message, idx) => ({
                  id: `${selectedKey}-log-${idx}`,
                  message,
                  timestamp: Date.now(),
                  type: 'info' as const,
                }));
              }
              return rawLogs as Array<{ id?: string; message: string; timestamp?: number | string; type?: 'info' | 'warning' | 'error' | 'success'; status?: 'pending' | 'completed' | 'failed'; }>;
            }
            return [];
          })()}
          executionResults={executionResults}
          initialWidth={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
      )}

      {/* End Node Sidebar */}
      <EndNodeSidebar
        isOpen={showEndNodeSidebar}
        onClose={handleCloseEndNodeSidebar}
        sidebarType={endNodeSidebarType}
        finalData={finalizedResult || finalData}
        initialWidth={endNodeSidebarWidth}
        onWidthChange={setEndNodeSidebarWidth}
      />

      {/* Feedback Popup */}
      {feedbackAgent && (
        <FeedbackPopup
          isOpen={showFeedbackPopup}
          onClose={handleCloseFeedbackPopup}
          agentId={feedbackAgent.id}
          agentName={feedbackAgent.name}
          onSave={handleSaveFeedback}
          onEvolve={handleEvolveFeedback}
        />
      )}
    </div>
  );
}

// Export the wrapped component
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}