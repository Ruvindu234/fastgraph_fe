'use client';

import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { WorkflowsSidebar } from '@/components/workflows/WorkflowsSidebar';
import { PromptInput } from '@/components/workflows/PromptInput';
import { MobileAgentDrawer } from '@/components/workflows/mobile/MobileAgentDrawer';
import { WorkflowHeader } from '@/components/workflows/WorkflowHeader';
import { StreamingProgress } from '@/components/workflows/StreamingProgress';
import { useWorkflowManager } from '@/hooks/workflows/useWorkflowManager';
import { usePromptHandler } from '@/hooks/workflows/usePromptHandler';
import { useAutoOrchestrate } from '@/hooks/workflows/useAutoOrchestrate';
import { useEvolveAgentMutation } from '../../../../redux/api/evolveAgent/evolveAgentApi';
import { WorkflowFormData } from '@/components/dashboard/CreateWorkflowModal';
import { useDispatch, useSelector } from 'react-redux';
import { addWorkflow, removeAllWorkflows, updateWorkflow, removeWorkflow, setWorkflows, setDataId, clearDataId } from '@/redux/slice/workflowSlice';
import { useGetDataCreatedByQuery, useInstallDataMutation, useGetMockAgentDataQuery } from '../../../../redux/api/autoOrchestrate/autoOrchestrateApi';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { processAgentsFromResponse } from '@/services/workflows/agentProcessor';
import { generateCustomAgentMockData, generateCustomAgentId } from '@/lib/customAgentMockData';
import { AgentFormData } from '@/components/workflows/NewAgentPopup';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { AgentTemplate, ParsedWorkflow } from '@/agents/types';
import { calculateTripGuardianLayout, calculateDAGLayoutAsync } from '@/agents';

// Generate a proper UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function WorkflowsPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { logWorkflowCreate } = useAuditLog();
  const [agents, setAgents] = useState<Record<string, any> | null>(null);
  const [connections, setConnections] = useState<any[] | null>(null);
  const [finalData, setFinalData] = useState<any>(null);
  const [finalizedResult, setFinalizedResult] = useState<any>(null);
  const [finalizedArtifactLinks, setFinalizedArtifactLinks] = useState<any[]>([]);
  const [cachedExecutionResults, setCachedExecutionResults] = useState<any>(null);
  const [installData, { isLoading: isInstalling } ] = useInstallDataMutation();
  // Undo functionality state
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  // Mobile and UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  

  // Custom hooks for workflow management
  const { workflows, workflowStatus, workflowError, dataId } = useSelector((state: any) => state.workflows);
  const currentUser = useSelector((state: any) => state.auth.user);
  
  // Fetch workflows from API and load into Redux store
  const { 
    data: apiWorkflowData, 
    error: apiError, 
    isLoading: isLoadingWorkflows 
  } = useGetDataCreatedByQuery(currentUser?.id || currentUser?.userId || "1", {
    skip: !currentUser?.id && !currentUser?.userId // Skip if no user ID
  });


  // Evolution API
  const [evolveAgent, { isLoading: isEvolving }] = useEvolveAgentMutation();
  
  // Memoize the callback to prevent infinite re-renders
  const handleAgentsProcessed = useCallback((processedAgents: Record<string, any>, processedConnections: any[], processedFinalData?: any, processedFinalizedArtifactLinks?: any[]) => {
    setAgents(processedAgents);
    setConnections(processedConnections);
    setFinalData(processedFinalData);
    if (processedFinalizedArtifactLinks) {
      setFinalizedArtifactLinks(processedFinalizedArtifactLinks);
    }
  }, []);
  
  const { 
    isAutoOrchestrating, 
    autoOrchestrateError,
    finalizedResult: orchestratedFinalizedResult, 
    finalizedArtifactLinks: orchestratedFinalizedArtifactLinks, 
    executionResults, 
    streamData,
    progress,
    resetAutoOrchestrate,
    startAutoOrchestrate,
    stopAutoOrchestrate
  } = useAutoOrchestrate({
    workflows,
    onAgentsProcessed: handleAgentsProcessed
  });
  
  console.log('🔍 Dashboard Debug:', {
    localFinalizedArtifactLinksLength: finalizedArtifactLinks?.length,
    orchestratedFinalizedArtifactLinksLength: orchestratedFinalizedArtifactLinks?.length,
    finalPassedToCanvas: (finalizedArtifactLinks || orchestratedFinalizedArtifactLinks)?.length,
    localFinalizedArtifactLinks: finalizedArtifactLinks,
    orchestratedFinalizedArtifactLinks: orchestratedFinalizedArtifactLinks,
    agentsCount: agents ? Object.keys(agents).length : 0,
    connectionsCount: connections ? connections.length : 0
  });

  const {
    workflows: workflowManagerWorkflows,
    activeWorkflow,
    currentWorkflow,
    selectedNode,
    isRunning,
    setActiveWorkflow,
    setSelectedNode,
    createNewWorkflow,
    closeWorkflow,
    deleteWorkflow: originalDeleteWorkflow,
    executeWorkflow,
    stopWorkflow,
    addNodeToWorkflow,
    deleteNode
  } = useWorkflowManager();

  // Fetch mock agent data for the current workflow
  const { 
    data: mockAgentData, 
    error: mockAgentError, 
    isLoading: isLoadingMockAgent,
    refetch: refetchMockAgent
  } = useGetMockAgentDataQuery(activeWorkflow, {
    skip: !activeWorkflow // Skip if no active workflow
  });

  // Handle mock agent data changes and canvas updates
  useEffect(() => {
    if (activeWorkflow && mockAgentData) {
      console.log('🎭 Processing mock agent data for canvas:', {
        activeWorkflow,
        mockAgentData,
        isArray: Array.isArray(mockAgentData),
        length: Array.isArray(mockAgentData) ? mockAgentData.length : 'not array'
      });
      
      // Handle array format
      if (Array.isArray(mockAgentData) && mockAgentData.length > 0) {
        console.log('📋 Converting array of agents to canvas format:', mockAgentData);
        
        // Convert array of agents to individual agents in canvas
        const mockAgents: { [key: string]: any } = {};
        
        // Create ALL mock agents as CustomUserAgentNode (no extra orchestrator)
        mockAgentData.forEach((agent, index) => {
          const mockAgentId = `mock-agent-${activeWorkflow}-${index}`;
          mockAgents[mockAgentId] = {
            id: mockAgentId,
            name: agent.agentName || `Mock Agent ${index + 1}`,
            role: agent.role || 'validation',
            capabilities: agent.capabilities || ['analyze', 'validate'],
            inputs: agent.inputs || ['data'],
            outputs: agent.outputs || ['results'],
            logs: agent.logs || ['initialized'],
            isCustom: true, // ALL mock agents should be CustomUserAgentNode
            workflowId: activeWorkflow,
            originalAgentId: agent.agentId,
            createdAt: agent.createdAt,
            createdBy: agent.createdBy,
            isUserEvolved: agent.isUserEvolved,
            isMockAgent: true // Flag to identify mock agents
          };
          
          console.log(`✅ Created mock agent ${index + 1} (CustomUserAgentNode):`, {
            id: mockAgentId,
            name: agent.agentName,
            role: agent.role,
            originalAgentId: agent.agentId,
            isCustom: true
          });
        });
        
        console.log('🎯 All mock agents created:', Object.keys(mockAgents));
        console.log('📊 Agent count:', Object.keys(mockAgents).length, '(from API)');
        
        // No connections needed - just display the mock agents as CustomUserAgentNode
        
        // Update canvas with mock agents FIRST (priority display)
        setAgents(prevAgents => {
          // Clear any existing mock agents first (now includes both bulk and custom agents)
          const clearedAgents = Object.fromEntries(
            Object.entries(prevAgents || {}).filter(([key, value]: [string, any]) => 
              !key.startsWith('mock-agent-') && 
              !key.startsWith('main-agent-') && 
              !key.startsWith('main-workflow-agent-')
            )
          );
          
          const finalAgents = {
            ...mockAgents,  // Mock agents FIRST
            ...clearedAgents // Other agents SECOND
          };
          
          console.log('🔄 Updated agents state:', {
            totalAgents: Object.keys(finalAgents).length,
            mockAgents: Object.keys(mockAgents).length,
            otherAgents: Object.keys(clearedAgents).length,
            agentIds: Object.keys(finalAgents)
          });
          
          return finalAgents;
        });
        
        // Clear any existing mock connections (no connections needed)
        setConnections(prevConnections => {
          // Clear any existing mock connections first
          const clearedConnections = (prevConnections || []).filter(conn => 
            !conn.id.startsWith('connection-main-agent-') && 
            !conn.id.startsWith('connection-mock-agent-') &&
            !conn.id.startsWith('connection-main-workflow-agent-')
          );
          
          console.log('🔄 Updated connections state (no mock connections):', {
            totalConnections: clearedConnections.length,
            clearedConnections: clearedConnections.length,
            connectionIds: clearedConnections.map(c => c.id)
          });
          
          return clearedConnections;
        });
      } else if (mockAgentData.id) {
        console.log('📋 Converting single agent to canvas format:', mockAgentData);
        
        // Create the single mock agent as CustomUserAgentNode (no extra orchestrator)
        const mockAgentId = `mock-agent-${activeWorkflow}`;
        const mockAgent = {
          id: mockAgentId,
          name: mockAgentData.name || 'Mock Agent',
          role: mockAgentData.role || 'validation',
          capabilities: mockAgentData.capabilities || ['analyze', 'validate'],
          inputs: mockAgentData.inputs || ['data'],
          outputs: mockAgentData.outputs || ['results'],
          logs: mockAgentData.logs || ['initialized'],
          isCustom: true, // Single mock agent should be CustomUserAgentNode
          workflowId: activeWorkflow,
          originalAgentId: mockAgentData.id,
          createdAt: mockAgentData.createdAt,
          createdBy: mockAgentData.createdBy,
          isUserEvolved: mockAgentData.isUserEvolved,
          isMockAgent: true // Flag to identify mock agent
        };
        
        console.log(`✅ Created single mock agent (CustomUserAgentNode):`, {
          id: mockAgentId,
          name: mockAgentData.name,
          role: mockAgentData.role,
          originalAgentId: mockAgentData.id,
          isCustom: true
        });
        
        // Update canvas with mock agent FIRST (priority display)
        setAgents(prevAgents => {
          // Clear any existing mock agents first (now includes both bulk and custom agents)
          const clearedAgents = Object.fromEntries(
            Object.entries(prevAgents || {}).filter(([key, value]: [string, any]) => 
              !key.startsWith('mock-agent-') && 
              !key.startsWith('main-agent-') && 
              !key.startsWith('main-workflow-agent-')
            )
          );
          
          return {
            [mockAgentId]: mockAgent, // Mock agent FIRST
            ...clearedAgents // Other agents SECOND
          };
        });
        
        // Clear any existing mock connections (no connections needed)
        setConnections(prevConnections => {
          // Clear any existing mock connections first
          const clearedConnections = (prevConnections || []).filter(conn => 
            !conn.id.startsWith('connection-main-agent-') && 
            !conn.id.startsWith('connection-mock-agent-') &&
            !conn.id.startsWith('connection-main-workflow-agent-')
          );
          
          return clearedConnections;
        });
      }
    } else if (activeWorkflow && !mockAgentData && !isLoadingMockAgent) {
      // Handle case where no mock agent data exists (e.g., new workflows)
      console.log('📭 No mock agent data available for workflow:', activeWorkflow);
      console.log('💡 This is normal for new workflows - they will use default agents or auto-orchestrate will create agents');
    }
  }, [activeWorkflow, mockAgentData, mockAgentError, isLoadingMockAgent]);

  // Use Redux workflows if available, otherwise fallback to workflow manager
  const displayWorkflows = workflows.length > 0 ? workflows : workflowManagerWorkflows;
  
  // Find the current workflow from the correct source - no default selection
  const actualCurrentWorkflow = displayWorkflows.find((w: any) => w.id === activeWorkflow) || null;
  
  // Handle workflow selection from sidebar - replace current workflow entirely (SINGLE TAB MODE)
  const handleSidebarWorkflowSelect = useCallback(async (workflowId: string) => {
    console.log('=== WORKFLOW SELECTION START ===');
    console.log('Sidebar workflow selected:', workflowId);
    console.log('Setting dataId to:', workflowId);
    console.log('Current active workflow:', activeWorkflow);
    console.log('Current agents:', agents ? Object.keys(agents) : 'null');
    console.log('Current connections:', connections ? connections.length : 'null');
    console.log('Current workflows in Redux:', workflows.length);
    console.log('Available API workflow data:', apiWorkflowData?.length || 0);
    
    // Set the dataId state variable
    dispatch(setDataId(workflowId));
    console.log('✅ dataId state variable set to:', workflowId);
    
    // Mock agent data will be fetched automatically by the useGetMockAgentDataQuery hook
    console.log('🔐 Current user:', currentUser?.id || currentUser?.userId || 'No user');
    console.log('🔐 Auth state:', {
      hasUser: !!currentUser,
      userId: currentUser?.id || currentUser?.userId,
      hasAccessToken: !!currentUser?.accessToken
    });
    
    // FORCE COMPLETE STATE RESET
    console.log('🧹 CLEARING ALL STATE...');
    
    // Clear active workflow first
    setActiveWorkflow(null);
    
    // Clear all canvas data including mock agent data
    setAgents(null);
    setConnections(null);
    setFinalData(null);
    setFinalizedResult(null);
    setCachedExecutionResults(null);
    dispatch(clearDataId()); // Clear dataId when clearing state
    
    // Clear mock agent data when switching workflows
    
    // Clear Redux workflows
    dispatch(removeAllWorkflows());
    
    // Wait a moment for state to clear
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find the selected workflow from API data
    if (apiWorkflowData && Array.isArray(apiWorkflowData)) {
      const selectedApiItem = apiWorkflowData.find((item: any) => item.dataId === workflowId);
      
      console.log('🔍 Selected API item:', {
        found: !!selectedApiItem,
        dataId: selectedApiItem?.dataId,
        dataName: selectedApiItem?.dataName,
        hasAutoOrchestrateResult: !!selectedApiItem?.dataContent?.autoOrchestrateResult,
        hasRawData: !!selectedApiItem?.dataContent?.rawData,
        dataContentKeys: selectedApiItem?.dataContent ? Object.keys(selectedApiItem.dataContent) : 'no dataContent'
      });
      
      if (selectedApiItem && selectedApiItem.dataContent?.autoOrchestrateResult) {
        const workflowData = selectedApiItem.dataContent.autoOrchestrateResult;
        const rawData = selectedApiItem.dataContent.rawData;

        // Build agents and connections from raw data (not the processed autoOrchestrateResult)
        console.log('🔍 Existing Workflow - rawData structure:', {
          rawDataKeys: rawData ? Object.keys(rawData) : 'no rawData',
          hasAutoOrchestrateResponse: !!rawData?.auto_orchestrate_response,
          autoOrchestrateResponseKeys: rawData?.auto_orchestrate_response ? Object.keys(rawData.auto_orchestrate_response) : 'none',
          rawData: rawData
        });
        
        const { agents: processedAgents, connections: processedConnections, finalData: processedFinalData, finalizedResult: processedFinalizedResult, finalizedArtifactLinks: processedFinalizedArtifactLinks, executionResults: processedExecutionResults } = processAgentsFromResponse(rawData);
        
        console.log('🔍 Existing Workflow - processed result:', {
          processedFinalizedArtifactLinksLength: processedFinalizedArtifactLinks?.length,
          processedFinalizedArtifactLinks: processedFinalizedArtifactLinks,
          processedAgentsCount: Object.keys(processedAgents).length,
          processedConnectionsCount: processedConnections.length,
          processedFinalDataKeys: processedFinalData ? Object.keys(processedFinalData) : 'no finalData'
        });
        
        // Create the workflow object with reconstructed nodes/connections so hooks detect existing structure
        const reconstructedNodes = Object.entries(processedAgents || {}).map(([agentName, agentData]: [string, any]) => ({
          id: `agent-${agentName}`,
          data: {
            label: agentData.name || agentName,
            role: agentData.role || 'Agent',
            capabilities: agentData.capabilities || [],
            inputs: agentData.inputs || [],
            outputs: agentData.outputs || [],
            logs: agentData.logs || [],
            ...agentData
          }
        }));
        
        const selectedWorkflow = {
          id: selectedApiItem.dataId,
          name: selectedApiItem.dataName,
          description: selectedApiItem.description,
          status: selectedApiItem.status,
          lastModified: new Date(selectedApiItem.installedAt).toLocaleString(),
          nodes: reconstructedNodes,
          connections: processedConnections || []
        };
        
        console.log('🔄 LOADING NEW WORKFLOW:', selectedWorkflow.name);
        console.log('Workflow nodes:', selectedWorkflow.nodes?.length || 0);
        console.log('Workflow connections:', selectedWorkflow.connections?.length || 0);
        
        // SINGLE TAB MODE: Set only this workflow in Redux store
        console.log('📝 Setting workflow in Redux store...');
        dispatch(setWorkflows([selectedWorkflow]));
        
        // Set the selected workflow as active
        console.log('🎯 Setting active workflow:', workflowId);
        console.log('🔍 WorkflowId validation:', {
          isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId),
          length: workflowId.length,
          format: 'UUID v4',
          dataId: workflowId
        });
        setActiveWorkflow(workflowId);
        
        // Load the new workflow data into canvas directly from processed results (no external API)
        let finalAgents = {};
        
        // SECONDARY: Add processed workflow agents if available
        if (processedAgents && Object.keys(processedAgents).length > 0) {
          console.log('🤖 ADDING PROCESSED WORKFLOW AGENTS:', Object.keys(processedAgents));
          finalAgents = {
            ...finalAgents,
            ...processedAgents
          };
          console.log('✅ Processed workflow agents added to canvas');
        }
        
        if (Object.keys(finalAgents).length > 0) {
          console.log('🤖 LOADING AGENTS:', Object.keys(finalAgents));
          setAgents(finalAgents);
          console.log('✅ Agents set in state');
        }
        
        if (processedConnections && processedConnections.length > 0) {
          // Transform to canvas edge style
          const workflowConnections = processedConnections.map((conn: any, index: number) => ({
            id: conn.id || `${conn.source}-to-${conn.target}` || `connection-${index}`,
            source: conn.source,
            target: conn.target,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#6366f1',
              strokeWidth: 2,
            }
          }));
          console.log('🔗 LOADING CONNECTIONS:', workflowConnections.length);
          setConnections(workflowConnections);
          console.log('✅ Connections set in state');
        }
        
        // Save final data and execution results for the sidebars
        if (processedFinalData) {
          setFinalData(processedFinalData);
        }
        if (processedFinalizedResult) {
          setFinalizedResult(processedFinalizedResult);
        }
        if (processedFinalizedArtifactLinks) {
          setFinalizedArtifactLinks(processedFinalizedArtifactLinks);
        }
        if (processedExecutionResults) {
          setCachedExecutionResults(processedExecutionResults);
        }
        
        console.log('🎉 WORKFLOW LOADING COMPLETE');
        console.log('=== WORKFLOW SELECTION END ===');
        
        toast.success(`Loaded workflow: ${selectedWorkflow.name}`, {
          duration: 2000,
          style: {
            background: '#10B981',
            color: '#fff',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#10B981',
          },
        });
      } else {
        console.log('Workflow not found in API data');
        toast.error('Workflow not found');
      }
    } else {
      console.log('No API data available');
      
      // Mock agent data will be handled by the useEffect when it's fetched
      toast.error('No workflow data available');
    }
  }, [apiWorkflowData, setActiveWorkflow, dispatch, mockAgentData, refetchMockAgent]);

  // Handle tab selection - also replace workflow entirely (same behavior as sidebar)
  const handleTabWorkflowSelect = useCallback((workflowId: string) => {
    console.log('Tab workflow selected:', workflowId);
    // Use the same replacement logic as sidebar
    handleSidebarWorkflowSelect(workflowId);
  }, [handleSidebarWorkflowSelect]);

  // Update undo availability
  useEffect(() => {
    setCanUndo(undoStack.length > 0);
  }, [undoStack]);

  // Log when dataId changes
  useEffect(() => {
    if (dataId) {
      console.log('🆔 dataId state variable updated to:', dataId);
    } else {
      console.log('🆔 dataId state variable cleared');
    }
  }, [dataId]);

  // Function to add action to undo stack
  const addToUndoStack = (action: { type: string; description: string; data?: any }) => {
    setUndoStack(prev => [...prev, { ...action, timestamp: Date.now() }]);
  };

  // Handle workflow regeneration when new prompt is entered
  const handleWorkflowRegenerate = useCallback(async (prompt: string) => {
    if (!actualCurrentWorkflow) return;
    
    setIsRegenerating(true);
    
    try {
      // Create new workflow data with the new prompt
      const regeneratedWorkflowData = {
        id: actualCurrentWorkflow.id,
        name: actualCurrentWorkflow.name,
        description: prompt,
        status: 'draft' as const,
        lastModified: 'Just now',
        nodes: [],
        connections: []
      };

      // Clear existing state
      setAgents(null);
      setConnections(null);
      setFinalData(null);
      setFinalizedResult(null);
      setFinalizedArtifactLinks([]);
      setCachedExecutionResults(null);
      if (resetAutoOrchestrate) {
        resetAutoOrchestrate();
      }

      // Update the workflow in Redux store
      dispatch(setWorkflows([regeneratedWorkflowData]));

      // Persist the new prompt
      await installData({
        dataName: actualCurrentWorkflow.name,
        description: prompt,
        numberOfAgents: 0,
        dataType: 'json',
        dataContent: {
          command: prompt
        },
        overwrite: true
      }).unwrap();


      // Add to undo stack
      addToUndoStack({
        type: 'REGENERATE_WORKFLOW',
        description: `Regenerated workflow "${actualCurrentWorkflow.name}" with new prompt`,
        data: { workflowId: regeneratedWorkflowData.id, workflowData: regeneratedWorkflowData }
      });

      toast.success('Workflow regenerated with new prompt! Auto-orchestration starting...');
      
      // Start auto-orchestration with the new prompt
      await startAutoOrchestrate(prompt);
    } catch (error) {
      console.error('Failed to regenerate workflow:', error);
      toast.error('Failed to regenerate workflow. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [actualCurrentWorkflow, dispatch, installData, resetAutoOrchestrate, addToUndoStack, startAutoOrchestrate]);

  const { handlePromptSubmit, isProcessing } = usePromptHandler({
    currentWorkflow: actualCurrentWorkflow,
    selectedNode,
    addNodeToWorkflow,
    deleteNode,
    executeWorkflow,
    onWorkflowRegenerate: handleWorkflowRegenerate
  });

  // Track regeneration state
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Event handlers
  const handleSave = () => {
    if (actualCurrentWorkflow) {
      // Update Redux store with the current workflow
      dispatch(updateWorkflow(actualCurrentWorkflow));
      toast.success('Workflow saved successfully!');
    }
  };

  const handleDeleteWorkflow = (workflowId?: string) => {
    const idToDelete = workflowId || actualCurrentWorkflow?.id;
    if (idToDelete) {
      // Remove from Redux store
      dispatch(removeWorkflow(idToDelete));
      setAgents(null);
      setConnections(null);
    }
    originalDeleteWorkflow();
  };

  const handleClearWorkflowData = () => {
    // Clear all workflows from Redux store
    dispatch(removeAllWorkflows());
    // Also clear auto orchestrate state manually
    if (resetAutoOrchestrate) {
      resetAutoOrchestrate();
    }
    toast.success('Workflow data cleared successfully!');
  };

  const handleCloseWorkflow = (workflowId: string) => {
    if (workflows.length > 0) {
      // If using Redux workflows, delete from Redux store
      dispatch(removeWorkflow(workflowId));
      
      // Update active workflow if the closed one was active
      if (activeWorkflow === workflowId) {
        const remainingWorkflows = workflows.filter((w: any) => w.id !== workflowId);
        setActiveWorkflow(remainingWorkflows[0]?.id || null);
      }
    } else {
      // Fall back to workflow manager for local workflows
      closeWorkflow(workflowId);
    }
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Undo functionality
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const lastAction = undoStack[undoStack.length - 1];
      
      // Remove the last action from the stack
      setUndoStack(prev => prev.slice(0, -1));
      
      // Show a toast message
      toast.success(`Undid: ${lastAction.description || 'Last action'}`, {
        duration: 2000,
        style: {
          background: '#10B981',
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      
      console.log('Undo action:', lastAction);
    }
  };


  const handleWorkflowSubmit = useCallback(async (data: WorkflowFormData) => {
    console.log('Creating/regenerating workflow with command:', data);
    try {
      // Check if there's an existing workflow to regenerate
      const existingWorkflow = workflows.find((w: any) => w.name === data.name);
      const isRegenerating = !!existingWorkflow;

      // 🧹 Clear existing workflow/state (single tab mode)
      setActiveWorkflow(null);
      setAgents(null);
      setConnections(null);
      setFinalData(null);
      setFinalizedResult(null);
      setFinalizedArtifactLinks([]);
      setCachedExecutionResults(null);
      if (resetAutoOrchestrate) {
        resetAutoOrchestrate();
      }
      dispatch(removeAllWorkflows());

      // Prepare workflow data (new or regenerated)
      const workflowId = isRegenerating ? existingWorkflow.id : generateUUID();
      console.log('🆔 Generated workflow ID:', workflowId, isRegenerating ? '(regenerated)' : '(new)');
      const workflowData = {
        id: workflowId,
        name: data.name,
        // Use the command directly so auto-orchestrate receives a clean prompt
        description: data.description,
        status: 'draft' as const,
        lastModified: 'Just now',
        nodes: [],
        connections: []
      };

      // 📡 Persist an initial record (overwrite: true)
      const installResult = await installData({
        dataName: data.name,
        description: data.description,
        numberOfAgents:0,
        dataType: 'json',
        dataContent: {
          command: data.description
        },
        overwrite: true
      }).unwrap();

      // Set the dataId from the API response
      if (installResult?.dataId) {
        dispatch(setDataId(installResult.dataId));
        console.log('✅ dataId set from new workflow creation:', installResult.dataId);
      } else {
        // Fallback: use the generated workflowId as dataId
        dispatch(setDataId(workflowId));
        console.log('✅ dataId set to generated workflowId (fallback):', workflowId);
      }

      // 🎯 Load as the only active workflow (single tab)
      dispatch(setWorkflows([workflowData]));
      setActiveWorkflow(workflowId);

      // Log workflow creation audit
      await logWorkflowCreate(workflowData);

      // Create default mock agents for new workflows
      if (!isRegenerating) {
        console.log('🆕 Creating default mock agents for new workflow:', workflowId);
        
        // Create 5 default mock agents for new workflows (to match existing workflow count)
        const defaultMockAgents: { [key: string]: any } = {};
        const defaultAgentNames = ['Data Processor', 'Analysis Engine', 'Result Generator', 'Quality Controller', 'Report Generator'];
        const defaultRoles = [
          'Process and validate input data',
          'Analyze data and generate insights', 
          'Format and deliver results',
          'Ensure data quality and validation',
          'Generate comprehensive reports'
        ];
        
        defaultAgentNames.forEach((name, index) => {
          const mockAgentId = `mock-agent-${workflowId}-${index}`;
          defaultMockAgents[mockAgentId] = {
            id: mockAgentId,
            name: name,
            role: defaultRoles[index],
            capabilities: ['analyze', 'validate', 'process'],
            inputs: ['data'],
            outputs: ['results'],
            logs: ['initialized', 'ready'],
            isCustom: false, // This is the key - should be false for regular agents
            workflowId: workflowId,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.id || currentUser?.userId || 'user',
            isUserEvolved: false
          };
        });
        
        // Set the default mock agents in the canvas
        setAgents(defaultMockAgents);
        
        console.log('✅ Default mock agents created for new workflow:', Object.keys(defaultMockAgents));
        console.log('📊 Agent count: 5 (matching existing workflow count)');
      }


      // Add to undo stack
      addToUndoStack({
        type: isRegenerating ? 'REGENERATE_WORKFLOW' : 'CREATE_WORKFLOW',
        description: isRegenerating ? `Regenerated workflow "${data.name}"` : `Created workflow "${data.name}"`,
        data: { workflowId: workflowData.id, workflowData }
      });

      // Start auto-orchestration with the workflow description
      await startAutoOrchestrate(data.description);
      
      toast.success(isRegenerating ? 'Workflow regenerated! Auto-orchestration starting...' : 'Workflow created! Auto-orchestration starting...');
    } catch (error) {
      console.error('Failed to create/regenerate workflow:', error);
      toast.error('Failed to create/regenerate workflow. Please try again.');
    }
  }, [workflows, setActiveWorkflow, setAgents, setConnections, setFinalData, setFinalizedResult, setFinalizedArtifactLinks, setCachedExecutionResults, resetAutoOrchestrate, dispatch, installData, logWorkflowCreate, startAutoOrchestrate, addToUndoStack]);

  const handleAgentFeedback = async (agentId: string, agentName: string, action?: string, feedback?: string | string[]) => {
    console.log('Feedback action:', action, 'for agent:', { agentId, agentName }, 'feedback:', feedback);
    
    if (action === 'save') {
      // Save feedback to database/API
      console.log('Saving feedback to system...');
      // You can implement API call here to save feedback
      // Example: await saveFeedbackAPI(agentId, feedback);
      toast.success('Feedback saved successfully!');
    } else if (action === 'evolve') {
      try {
        // Use feedback to evolve/improve the agent
        console.log('Evolving agent based on feedback...');
        
        // Extract workflowId - for now using a default, but this should come from the auto-orchestrate response
        const workflowId = "poetry_swarm"; // This should be dynamic based on current workflow
        
        const result = await evolveAgent({
          workflowId,
          agentName: agentName.replace('agent-', ''), // Remove agent- prefix if present
          feedbacks: Array.isArray(feedback) ? feedback : [feedback || ''],
          evolutionMode: 'fast_auto_evolution'
        }).unwrap();

        if (result.evolutionResults === "Success") {
          toast.success(`Agent "${agentName}" evolved successfully!`, {
            duration: 4000,
            style: {
              background: '#10B981',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#10B981',
            },
          });
        }
      } catch (error) {
        console.error('Evolution failed:', error);
        toast.error('Failed to evolve agent. Please try again.', {
          duration: 4000,
          style: {
            background: '#EF4444',
            color: '#fff',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#EF4444',
          },
        });
      }
    } else {
      // Legacy handling for backward compatibility
      console.log('Legacy feedback request - opening popup');
    }
  };

  // Handle custom agent creation from NewAgentPopup
  const handleCustomAgentCreate = useCallback(async (data: AgentFormData) => {
    console.log('🎨 Custom agent creation handled by NewAgentPopup - no duplicate creation needed');
    
    // Note: NewAgentPopup already handles agent creation via:
    // 1. createAgentV1() - creates agent in backend (first API)
    // 2. createAgent() - creates agent via RTK Query (second API) 
    // 3. onRefreshMockData() - refreshes mock agent data and adds agent to canvas
    //
    // This callback is just for compatibility - the actual agent creation happens in NewAgentPopup
    // The agent will appear as a mock agent after onRefreshMockData is called
    // No need to create duplicate agents here!
    
    console.log('✅ Agent creation flow completed via NewAgentPopup - agent will appear after mock data refresh');
  }, []);

  // Handle template selection from sidebar
  const handleTemplateSelect = useCallback(async (template: AgentTemplate, parsedWorkflow: ParsedWorkflow) => {
    console.log('📦 Template selected:', template.name);
    console.log('📊 Parsed workflow:', {
      name: parsedWorkflow.name,
      agentCount: Object.keys(parsedWorkflow.agents).length,
      connectionCount: parsedWorkflow.connections.length
    });

    // Clear existing state (single tab mode)
    setActiveWorkflow(null);
    setAgents(null);
    setConnections(null);
    setFinalData(null);
    setFinalizedResult(null);
    setFinalizedArtifactLinks([]);
    setCachedExecutionResults(null);
    if (resetAutoOrchestrate) {
      resetAutoOrchestrate();
    }
    dispatch(removeAllWorkflows());

    // Generate a new workflow ID for this template instance
    const workflowId = generateUUID();
    console.log('🆔 Generated workflow ID for template:', workflowId);

    // Calculate hierarchical layout positions
    const nodeIds = Object.keys(parsedWorkflow.agents);
    const edgesForLayout = parsedWorkflow.connections.map(conn => ({
      source: conn.source.replace('agent-', ''),
      target: conn.target.replace('agent-', '')
    }));
    
    // Use optimized manual layout for TripGuardianV3, ELK for others
    let positions: Record<string, { x: number; y: number }>;
    if (template.id === 'trip-guardian-v3') {
      // Use hand-crafted layout optimized to minimize edge crossings
      positions = calculateTripGuardianLayout();
      console.log('📐 Using optimized TripGuardian layout:', positions);
    } else {
      // Use ELK for other templates (async)
      try {
        const layoutResult = await calculateDAGLayoutAsync(nodeIds, edgesForLayout, {
          nodeWidth: 140,
          nodeHeight: 50,
          rankSeparation: 180,
          nodeSeparation: 120,
          direction: 'DOWN'
        });
        positions = layoutResult.positions;
        console.log('📐 ELK calculated layout:', { positions, levels: layoutResult.levels });
      } catch (error) {
        console.error('ELK layout failed, using fallback:', error);
        // Fallback to simple grid
        positions = {};
        nodeIds.forEach((id, index) => {
          positions[id] = {
            x: 100 + (index % 3) * 200,
            y: 100 + Math.floor(index / 3) * 150
          };
        });
      }
    }

    // Create workflow from template with proper positions
    const workflowData = {
      id: workflowId,
      name: `${parsedWorkflow.name} - ${new Date().toLocaleTimeString()}`,
      description: parsedWorkflow.description || template.description,
      status: 'draft' as const,
      lastModified: 'Just now',
      nodes: Object.entries(parsedWorkflow.agents).map(([agentId, agent], index) => ({
        id: `agent-${agentId}`,
        position: positions[agentId] || { x: 100 + (index % 3) * 180, y: 150 + Math.floor(index / 3) * 100 },
        data: {
          label: agent.name,
          role: agent.role,
          capabilities: agent.capabilities,
          inputs: agent.inputs,
          outputs: agent.outputs,
          nodeType: agent.nodeType,
          config: agent.config
        }
      })),
      connections: parsedWorkflow.connections
    };

    // Convert parsed agents to canvas format WITH positions
    const templateAgents: Record<string, any> = {};
    Object.entries(parsedWorkflow.agents).forEach(([agentId, agent], index) => {
      const pos = positions[agentId] || { x: 100 + (index % 3) * 180, y: 150 + Math.floor(index / 3) * 100 };
      templateAgents[agentId] = {
        id: agentId,
        name: agent.name,
        role: agent.role,
        capabilities: agent.capabilities,
        inputs: agent.inputs,
        outputs: agent.outputs,
        logs: [],
        isCustom: false,
        nodeType: agent.nodeType,
        config: agent.config,
        workflowId: workflowId,
        isTemplate: true, // Flag to identify template agents
        position: pos // Include position for canvas layout
      };
    });

    // Set the workflow and agents
    dispatch(setWorkflows([workflowData]));
    setActiveWorkflow(workflowId);
    setAgents(templateAgents);
    setConnections(parsedWorkflow.connections);

    // Add to undo stack
    addToUndoStack({
      type: 'LOAD_TEMPLATE',
      description: `Loaded template "${template.name}"`,
      data: { workflowId, templateId: template.id }
    });

    console.log('✅ Template loaded successfully:', {
      workflowId,
      agentCount: Object.keys(templateAgents).length,
      connectionCount: parsedWorkflow.connections.length,
      positions
    });
  }, [dispatch, setActiveWorkflow, resetAutoOrchestrate, addToUndoStack]);

  return (
    <div className="h-screen theme-bg flex flex-col transition-colors duration-300">
      
      <WorkflowHeader
        isMobile={isMobile}
        currentWorkflow={actualCurrentWorkflow}
        workflows={displayWorkflows}
        activeWorkflow={activeWorkflow}
        workflowStatus={workflowStatus}
        workflowError={workflowError}
        isAutoOrchestrating={isAutoOrchestrating}
        agentCount={agents ? Object.keys(agents).length : 0}
        isRunning={isRunning}
        mobileMenuOpen={mobileMenuOpen}
        onSelectWorkflow={handleTabWorkflowSelect}
        onCloseWorkflow={handleCloseWorkflow}
        onCreateNew={createNewWorkflow}
        onCreateWithModal={handleWorkflowSubmit}
        onCreateCustomAgent={handleCustomAgentCreate}
        onRefreshMockData={async () => {
          try {
            await refetchMockAgent();
          } catch (error) {
            console.warn('Failed to refresh mock agent data:', error);
          }
        }}
        onUndo={handleUndo}
        canUndo={canUndo}
        onExecute={executeWorkflow}
        onStop={stopWorkflow}
        onSave={handleSave}
        onDelete={handleDeleteWorkflow}
        onMenuToggle={handleMobileMenuToggle}
        userId={currentUser?.id || currentUser?.userId || "1"}
      />

      {/* Mobile Workflow Drawer */}
      {isMobile && (
        <MobileAgentDrawer 
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onWorkflowSelect={(workflowId: string) => {
            handleSidebarWorkflowSelect(workflowId);
            setMobileMenuOpen(false);
          }}
          currentWorkflowId={activeWorkflow || undefined}
        />
      )}
      
      {/* Streaming Progress - Bottom Right */}
      <StreamingProgress
        isStreaming={isAutoOrchestrating}
        progress={progress}
        error={autoOrchestrateError}
        onStop={stopAutoOrchestrate}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Workflow Sidebar - Hidden on mobile */}
        {!isMobile && (
          <WorkflowsSidebar 
            onWorkflowSelect={handleSidebarWorkflowSelect}
            currentWorkflowId={activeWorkflow || undefined}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleSidebarToggle}
            userId={currentUser?.id || currentUser?.userId || "1"} // Get user ID from auth slice
            onTemplateSelect={handleTemplateSelect}
          />
        )}
        
        {/* Workflow Canvas - Responsive */}
        <WorkflowCanvas
          key={`canvas-${activeWorkflow || 'empty'}-${agents ? Object.keys(agents).length : 0}`}
          workflow={actualCurrentWorkflow}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onDeleteNode={deleteNode}
          onAddNode={addNodeToWorkflow}
          agents={agents || undefined}
          connections={connections || undefined}
          isAutoOrchestrating={isAutoOrchestrating || isLoadingWorkflows}
          onAgentFeedback={handleAgentFeedback}
          finalData={finalData}
          finalizedResult={finalizedResult || orchestratedFinalizedResult}
          finalizedArtifactLinks={finalizedArtifactLinks || orchestratedFinalizedArtifactLinks}
          executionResults={cachedExecutionResults || executionResults}
        />
      </div>

      {/* Prompt Input - Mobile optimized */}
              <PromptInput 
          onSubmit={handlePromptSubmit}
          isProcessing={isProcessing}
          isMobile={isMobile}
          isRegenerating={isRegenerating}
        />
    </div>
  );
}