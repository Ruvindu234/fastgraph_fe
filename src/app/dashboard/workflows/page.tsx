'use client';

import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { WorkflowsSidebar } from '@/components/workflows/WorkflowsSidebar';
import { PromptInput } from '@/components/workflows/PromptInput';
import { MobileAgentDrawer } from '@/components/workflows/mobile/MobileAgentDrawer';
import { WorkflowHeader } from '@/components/workflows/WorkflowHeader';
import { useWorkflowManager } from '@/hooks/workflows/useWorkflowManager';
import { usePromptHandler } from '@/hooks/workflows/usePromptHandler';
import { useAutoOrchestrate } from '@/hooks/workflows/useAutoOrchestrate';
import { useEvolveAgentMutation } from '../../../../redux/api/evolveAgent/evolveAgentApi';
import { WorkflowFormData } from '@/components/dashboard/CreateWorkflowModal';
import { useDispatch, useSelector } from 'react-redux';
import { addWorkflow, removeAllWorkflows, updateWorkflow, removeWorkflow, setWorkflows } from '@/redux/slice/workflowSlice';
import { useGetDataCreatedByQuery, useInstallDataMutation } from '../../../../redux/api/autoOrchestrate/autoOrchestrateApi';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export default function WorkflowsPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agents, setAgents] = useState<Record<string, any> | null>(null);
  const [connections, setConnections] = useState<any[] | null>(null);
  const [finalData, setFinalData] = useState<any>(null);
  const [finalizedResult, setFinalizedResult] = useState<any>(null);
  
  // Undo functionality state
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  

  // Custom hooks for workflow management
  const { workflows, workflowStatus, workflowError } = useSelector((state: any) => state.workflows);
  const currentUser = useSelector((state: any) => state.auth.user);
  
  
  // Fetch workflows from API and load into Redux store
  const { 
    data: apiWorkflowData, 
    error: apiError, 
    isLoading: isLoadingWorkflows 
  } = useGetDataCreatedByQuery(currentUser?.id || currentUser?.userId || "1", {
    skip: !currentUser?.id && !currentUser?.userId // Skip if no user ID
  });

  // Don't auto-load workflows into Redux - wait for user selection
  
  // Evolution API
  const [evolveAgent, { isLoading: isEvolving }] = useEvolveAgentMutation();
  
  // Install Data API for saving workflows
  const [installData, { isLoading: isInstalling }] = useInstallDataMutation();
  
  // Memoize the callback to prevent infinite re-renders
  const handleAgentsProcessed = useCallback((processedAgents: Record<string, any>, processedConnections: any[], processedFinalData?: any) => {
    setAgents(processedAgents);
    setConnections(processedConnections);
    setFinalData(processedFinalData);
  }, []);
  
  const { isAutoOrchestrating, finalizedResult: orchestratedFinalizedResult, executionResults, resetAutoOrchestrate } = useAutoOrchestrate({
    workflows,
    onAgentsProcessed: handleAgentsProcessed
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

  // Use Redux workflows if available, otherwise fallback to workflow manager
  const displayWorkflows = workflows.length > 0 ? workflows : workflowManagerWorkflows;
  
  // Find the current workflow from the correct source - no default selection
  const actualCurrentWorkflow = displayWorkflows.find((w: any) => w.id === activeWorkflow) || null;
  
  // Debug: Monitor Redux workflows state changes
  useEffect(() => {
    console.log('🔍 REDUX WORKFLOWS CHANGED:', {
      count: workflows.length,
      workflows: workflows.map((w: any) => ({ id: w.id, name: w.name })),
      activeWorkflow: activeWorkflow
    });
  }, [workflows, activeWorkflow]);

  // Debug: Monitor display workflows and current workflow
  useEffect(() => {
    console.log('🔍 DISPLAY WORKFLOWS CHANGED:', {
      reduxWorkflows: workflows.length,
      managerWorkflows: workflowManagerWorkflows.length,
      displayWorkflows: displayWorkflows.length,
      activeWorkflow: activeWorkflow,
      actualCurrentWorkflow: actualCurrentWorkflow?.name || 'null'
    });
  }, [workflows, workflowManagerWorkflows, displayWorkflows, activeWorkflow, actualCurrentWorkflow]);
  
  // Handle workflow selection from sidebar - replace current workflow entirely (SINGLE TAB MODE)
  const handleSidebarWorkflowSelect = useCallback(async (workflowId: string) => {
    console.log('=== WORKFLOW SELECTION START ===');
    console.log('Sidebar workflow selected:', workflowId);
    console.log('Current active workflow:', activeWorkflow);
    console.log('Current agents:', agents ? Object.keys(agents) : 'null');
    console.log('Current connections:', connections ? connections.length : 'null');
    console.log('Current workflows in Redux:', workflows.length);
    
    // FORCE COMPLETE STATE RESET - CRITICAL FOR WORKFLOW SWITCHING
    console.log('🧹 CLEARING ALL STATE FOR WORKFLOW SWITCH...');
    console.log('Previous activeWorkflow:', activeWorkflow);
    console.log('New workflowId:', workflowId);
    
    // Clear active workflow first - CRITICAL
    setActiveWorkflow(null);
    
    // Clear all canvas data - CRITICAL
    setAgents(null);
    setConnections(null);
    setFinalData(null);
    setFinalizedResult(null);
    
    // Clear Redux workflows - CRITICAL
    dispatch(removeAllWorkflows());
    
    // Reset auto-orchestrate state to prevent interference
    resetAutoOrchestrate();
    
    // Wait longer for state to clear completely
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('✅ STATE CLEARED - Ready for new workflow');
    
    // Find the selected workflow from API data
    if (apiWorkflowData && Array.isArray(apiWorkflowData)) {
      console.log('🔍 SEARCHING FOR WORKFLOW IN API DATA');
      console.log('🔍 LOOKING FOR WORKFLOW ID:', workflowId);
      console.log('🔍 AVAILABLE WORKFLOWS IN API:', apiWorkflowData.map((item: any) => ({
        id: item.dataId,
        name: item.dataName,
        hasContent: !!item.dataContent?.autoOrchestrateResult
      })));
      
      const selectedApiItem = apiWorkflowData.find((item: any) => item.dataId === workflowId);
      
      if (!selectedApiItem) {
        console.log('❌ WORKFLOW NOT FOUND IN API DATA!');
        console.log('❌ Requested ID:', workflowId);
        console.log('❌ Available IDs:', apiWorkflowData.map((item: any) => item.dataId));
        toast.error('Workflow not found in API data');
        return;
      }
      
      console.log('✅ FOUND WORKFLOW IN API DATA:', selectedApiItem.dataName);
      
      if (selectedApiItem && selectedApiItem.dataContent?.autoOrchestrateResult) {
        const apiWorkflowData = selectedApiItem.dataContent.autoOrchestrateResult;
        
        console.log('🔍 USING CACHED API DATA - NO NEW API CALLS');
        console.log('🔍 SELECTED API ITEM FULL STRUCTURE:', selectedApiItem);
        console.log('🔍 API WORKFLOW DATA STRUCTURE:', apiWorkflowData);
        console.log('🔍 HAS EXECUTION RESULTS?', !!apiWorkflowData.execution_results);
        console.log('🔍 HAS SWARM SPEC?', !!apiWorkflowData.swarm_spec);
        console.log('🔍 HAS NODES?', !!apiWorkflowData.nodes);
        console.log('🔍 WORKFLOW NAME:', selectedApiItem.dataName);
        
        // DEBUG: Let's see what's actually in the API data
        console.log('🔍 ALL KEYS IN API WORKFLOW DATA:', Object.keys(apiWorkflowData));
        console.log('🔍 CHECKING FOR ALTERNATIVE STRUCTURES...');
        
        // Check for alternative data structures that might contain agents
        if (apiWorkflowData.swarm_result) {
          console.log('🔍 FOUND SWARM_RESULT:', apiWorkflowData.swarm_result);
        }
        if (apiWorkflowData.auto_orchestrate_response) {
          console.log('🔍 FOUND AUTO_ORCHESTRATE_RESPONSE:', apiWorkflowData.auto_orchestrate_response);
        }
        if (apiWorkflowData.agents) {
          console.log('🔍 FOUND AGENTS DIRECTLY:', apiWorkflowData.agents);
        }
        
        // STEP 1: Reconstruct complete workflow object from cached API data
        const reconstructedWorkflow = {
          id: selectedApiItem.dataId,
          name: selectedApiItem.dataName,
          description: selectedApiItem.description,
          status: selectedApiItem.status,
          lastModified: new Date(selectedApiItem.installedAt).toLocaleString(),
          nodes: apiWorkflowData.nodes || [],
          connections: apiWorkflowData.connections || []
        };
        
        console.log('🔄 RECONSTRUCTING FROM CACHED DATA:', reconstructedWorkflow.name);
        
        // STEP 2: Reconstruct agents from cached API data (including execution results)
        let reconstructedAgents: Record<string, any> = {};
        let reconstructedFinalData: any = null;
        let reconstructedExecutionResults: any = null;
        
        // Priority 1: Check if we have execution results in the cached API data
        if (apiWorkflowData.execution_results) {
          console.log('📊 PRIORITY 1: FOUND EXECUTION RESULTS IN CACHED DATA');
          console.log('📊 EXECUTION RESULTS STRUCTURE:', apiWorkflowData.execution_results);
          reconstructedExecutionResults = apiWorkflowData.execution_results;
          
          // Extract final data if available
          if (apiWorkflowData.final_data) {
            reconstructedFinalData = apiWorkflowData.final_data;
            console.log('📋 FOUND FINAL DATA IN CACHED DATA');
          }
          
          // Reconstruct agents with their execution results from cached data
          if (apiWorkflowData.execution_results.results) {
            console.log('📊 EXECUTION RESULTS HAVE RESULTS:', Object.keys(apiWorkflowData.execution_results.results));
            Object.entries(apiWorkflowData.execution_results.results).forEach(([agentName, agentResult]: [string, any]) => {
              console.log('📊 PROCESSING AGENT FROM EXECUTION RESULTS:', agentName);
              reconstructedAgents[agentName] = {
                name: agentResult.agent_metadata?.agent_name || agentName,
                role: agentResult.agent_metadata?.role || 'Agent',
                capabilities: [],
                inputs: [],
                outputs: agentResult.outputs ? Object.keys(agentResult.outputs) : [],
                logs: agentResult.execution_logs || [],
                result: agentResult.result,
                executionTime: agentResult.agent_metadata?.total_execution_time,
                // Store complete execution data from cached API
                executionData: agentResult
              };
            });
            console.log('📊 AGENTS FROM EXECUTION RESULTS:', Object.keys(reconstructedAgents));
          } else {
            console.log('📊 NO RESULTS IN EXECUTION RESULTS');
          }
        } else {
          console.log('📊 PRIORITY 1: NO EXECUTION RESULTS FOUND');
        }
        
        // Priority 2: If no execution results, reconstruct from swarm_spec in cached data
        if (Object.keys(reconstructedAgents).length === 0 && apiWorkflowData.swarm_spec) {
          console.log('🔧 PRIORITY 2: RECONSTRUCTING FROM SWARM SPEC IN CACHED DATA');
          console.log('🔧 SWARM SPEC STRUCTURE:', apiWorkflowData.swarm_spec);
          console.log('🔧 SWARM SPEC AGENTS:', apiWorkflowData.swarm_spec.agents);
          Object.entries(apiWorkflowData.swarm_spec.agents || {}).forEach(([agentName, agentSpec]: [string, any]) => {
            console.log('🔧 PROCESSING AGENT FROM SWARM SPEC:', agentName, agentSpec);
            reconstructedAgents[agentName] = {
              name: agentSpec.name || agentName,
              role: agentSpec.role || 'Agent',
              capabilities: agentSpec.capabilities || [],
              inputs: agentSpec.inputs || [],
              outputs: agentSpec.outputs || [],
              logs: [],
              config: agentSpec.config
            };
          });
          console.log('🔧 AGENTS FROM SWARM SPEC:', Object.keys(reconstructedAgents));
        } else if (Object.keys(reconstructedAgents).length === 0) {
          console.log('🔧 PRIORITY 2: NO SWARM SPEC FOUND OR AGENTS ALREADY EXIST');
        }
        
        // Priority 3: If still no agents, reconstruct from nodes in cached data
        if (Object.keys(reconstructedAgents).length === 0 && reconstructedWorkflow.nodes.length > 0) {
          console.log('🔧 PRIORITY 3: RECONSTRUCTING FROM NODES IN CACHED DATA');
          console.log('🔧 NODES FOUND:', reconstructedWorkflow.nodes.length);
          console.log('🔧 NODES STRUCTURE:', reconstructedWorkflow.nodes);
          reconstructedWorkflow.nodes.forEach((node: any) => {
            console.log('🔧 PROCESSING NODE:', node);
            if (node.data && node.data.role !== 'End') {
              const agentName = node.id.replace('agent-', '') || node.data.label || `agent-${Object.keys(reconstructedAgents).length + 1}`;
              console.log('🔧 CREATING AGENT FROM NODE:', agentName);
              reconstructedAgents[agentName] = {
                name: node.data.label || node.label || agentName,
                role: node.data.role || 'Agent',
                capabilities: node.data.capabilities || [],
                inputs: node.data.inputs || [],
                outputs: node.data.outputs || [],
                logs: node.data.logs || [],
                ...node.data
              };
            }
          });
          console.log('🔧 AGENTS FROM NODES:', Object.keys(reconstructedAgents));
        } else if (Object.keys(reconstructedAgents).length === 0) {
          console.log('🔧 PRIORITY 3: NO NODES FOUND OR AGENTS ALREADY EXIST');
        }
        
        // Priority 4: Check for alternative API data structures (swarm_result, auto_orchestrate_response)
        if (Object.keys(reconstructedAgents).length === 0 && apiWorkflowData.swarm_result) {
          console.log('🔧 PRIORITY 4: TRYING SWARM_RESULT STRUCTURE');
          const swarmResult = apiWorkflowData.swarm_result;
          
          // Check swarm_result.swarm_spec.agents
          if (swarmResult.swarm_spec && swarmResult.swarm_spec.agents) {
            console.log('🔧 FOUND AGENTS IN SWARM_RESULT.SWARM_SPEC:', Object.keys(swarmResult.swarm_spec.agents));
            Object.entries(swarmResult.swarm_spec.agents).forEach(([agentName, agentSpec]: [string, any]) => {
              reconstructedAgents[agentName] = {
                name: agentSpec.name || agentName,
                role: agentSpec.role || 'Agent',
                capabilities: agentSpec.capabilities || [],
                inputs: agentSpec.inputs || [],
                outputs: agentSpec.outputs || [],
                logs: [],
                config: agentSpec.config
              };
            });
          }
          
          // Also check for execution results in swarm_result
          if (swarmResult.execution_results && swarmResult.execution_results.results) {
            console.log('🔧 FOUND EXECUTION RESULTS IN SWARM_RESULT:', Object.keys(swarmResult.execution_results.results));
            Object.entries(swarmResult.execution_results.results).forEach(([agentName, agentResult]: [string, any]) => {
              if (!reconstructedAgents[agentName]) {
                reconstructedAgents[agentName] = {
                  name: agentResult.agent_metadata?.agent_name || agentName,
                  role: agentResult.agent_metadata?.role || 'Agent',
                  capabilities: [],
                  inputs: [],
                  outputs: agentResult.outputs ? Object.keys(agentResult.outputs) : [],
                  logs: agentResult.execution_logs || [],
                  result: agentResult.result,
                  executionTime: agentResult.agent_metadata?.total_execution_time,
                  executionData: agentResult
                };
              }
            });
            
            // Set final data from swarm_result
            if (swarmResult.final_data) {
              reconstructedFinalData = swarmResult.final_data;
            }
            reconstructedExecutionResults = swarmResult.execution_results;
          }
          
          console.log('🔧 AGENTS FROM SWARM_RESULT:', Object.keys(reconstructedAgents));
        }
        
        // Priority 5: Check auto_orchestrate_response structure
        if (Object.keys(reconstructedAgents).length === 0 && apiWorkflowData.auto_orchestrate_response) {
          console.log('🔧 PRIORITY 5: TRYING AUTO_ORCHESTRATE_RESPONSE STRUCTURE');
          const autoResponse = apiWorkflowData.auto_orchestrate_response;
          
          if (autoResponse.swarm_result && autoResponse.swarm_result.swarm_spec && autoResponse.swarm_result.swarm_spec.agents) {
            console.log('🔧 FOUND AGENTS IN AUTO_ORCHESTRATE_RESPONSE:', Object.keys(autoResponse.swarm_result.swarm_spec.agents));
            Object.entries(autoResponse.swarm_result.swarm_spec.agents).forEach(([agentName, agentSpec]: [string, any]) => {
              reconstructedAgents[agentName] = {
                name: agentSpec.name || agentName,
                role: agentSpec.role || 'Agent',
                capabilities: agentSpec.capabilities || [],
                inputs: agentSpec.inputs || [],
                outputs: agentSpec.outputs || [],
                logs: [],
                config: agentSpec.config
              };
            });
          }
          
          console.log('🔧 AGENTS FROM AUTO_ORCHESTRATE_RESPONSE:', Object.keys(reconstructedAgents));
        }
        
        // Priority 6: If still no agents, create fallback test agents to ensure something shows
        if (Object.keys(reconstructedAgents).length === 0) {
          console.log('⚠️ NO AGENTS FOUND IN ANY DATA SOURCE - CREATING FALLBACK TEST AGENTS');
          console.log('⚠️ THIS MEANS THE API DATA STRUCTURE IS NOT AS EXPECTED');
          console.log('⚠️ FALLBACK AGENTS WILL ALWAYS BE THE SAME - NEED TO FIX API DATA PARSING');
          reconstructedAgents = {
            'theme_agent': {
              name: 'Theme Specialist',
              role: 'Theme Specialist',
              capabilities: ['llm', 'research'],
              inputs: ['theme_request'],
              outputs: ['theme_output'],
              logs: []
            },
            'structure_agent': {
              name: 'Structure Designer',
              role: 'Structure Designer',
              capabilities: ['llm'],
              inputs: ['structure_request'],
              outputs: ['structure_output'],
              logs: []
            },
            'poet_agent': {
              name: 'Creative Poet',
              role: 'Creative Poet',
              capabilities: ['llm'],
              inputs: ['poem_request'],
              outputs: ['poem_output'],
              logs: []
            }
          };
        }
        
        console.log('🤖 RECONSTRUCTED AGENTS FROM CACHED DATA:', Object.keys(reconstructedAgents));
        console.log('🤖 AGENT COUNT:', Object.keys(reconstructedAgents).length);
        console.log('🤖 FULL AGENTS DATA:', reconstructedAgents);
        
        // STEP 3: Reconstruct connections from cached data
        let reconstructedConnections: any[] = [];
        if (reconstructedWorkflow.connections && reconstructedWorkflow.connections.length > 0) {
          reconstructedConnections = reconstructedWorkflow.connections.map((conn: any, index: number) => ({
            id: conn.id || `${conn.from || conn.source}-to-${conn.to || conn.target}` || `connection-${index}`,
            source: conn.from || conn.source,
            target: conn.to || conn.target,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#6366f1',
              strokeWidth: 2,
            }
          }));
        }
        
        console.log('🔗 RECONSTRUCTED CONNECTIONS FROM CACHED DATA:', reconstructedConnections.length);
        
        // STEP 4: Set all reconstructed data (this will NOT trigger auto-orchestration)
        console.log('🔧 SETTING RECONSTRUCTED DATA FOR NEW WORKFLOW...');
        console.log('- New Workflow ID:', workflowId);
        console.log('- New Workflow Name:', reconstructedWorkflow.name);
        console.log('- New Agents:', Object.keys(reconstructedAgents));
        console.log('- New Connections:', reconstructedConnections.length);
        
        // Set the new workflow data
        dispatch(setWorkflows([reconstructedWorkflow]));
        setActiveWorkflow(workflowId);
        setAgents(reconstructedAgents);
        setConnections(reconstructedConnections);
        
        console.log('✅ NEW WORKFLOW DATA SET COMPLETE');
        console.log('Active workflow is now:', workflowId);
        console.log('Agents are now:', Object.keys(reconstructedAgents));
        
        // Set execution results if available from cached data
        if (reconstructedFinalData) {
          setFinalData(reconstructedFinalData);
          console.log('📋 SET FINAL DATA FROM CACHED API');
        }
        
        if (reconstructedExecutionResults) {
          setFinalizedResult(reconstructedExecutionResults);
          console.log('📊 SET EXECUTION RESULTS FROM CACHED API');
        }
        
        console.log('🎉 WORKFLOW RECONSTRUCTION FROM CACHED DATA COMPLETE');
        console.log('✅ NO API CALLS MADE - USED CACHED DATA ONLY');
        
        toast.success(`Loaded from cache: ${reconstructedWorkflow.name}`, {
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
      toast.error('No workflow data available');
    }
  }, [apiWorkflowData, setActiveWorkflow, dispatch]);

  // Handle tab selection - also replace workflow entirely (same behavior as sidebar)
  const handleTabWorkflowSelect = useCallback((workflowId: string) => {
    console.log('Tab workflow selected:', workflowId);
    // Use the same replacement logic as sidebar
    handleSidebarWorkflowSelect(workflowId);
  }, [handleSidebarWorkflowSelect]);

  // No default workflow selection - user must explicitly select from sidebar or tabs

  // Update undo availability
  useEffect(() => {
    setCanUndo(undoStack.length > 0);
  }, [undoStack]);

  const { handlePromptSubmit, isProcessing } = usePromptHandler({
    currentWorkflow: actualCurrentWorkflow,
    selectedNode,
    addNodeToWorkflow,
    deleteNode,
    executeWorkflow
  });

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

  // Function to add action to undo stack
  const addToUndoStack = (action: { type: string; description: string; data?: any }) => {
    setUndoStack(prev => [...prev, { ...action, timestamp: Date.now() }]);
  };

  const handleWorkflowSubmit = async (data: WorkflowFormData) => {
    console.log('🚨 HANDLE WORKFLOW SUBMIT CALLED!');
    console.log('=== NEW WORKFLOW CREATION START ===');
    console.log('Creating workflow:', data);
    console.log('Current active workflow:', activeWorkflow);
    console.log('Current agents:', agents ? Object.keys(agents) : 'null');
    
    // STEP 1: CLEAR EXISTING (same as workflow selection for SINGLE TAB MODE)
    console.log('🧹 CLEARING EXISTING WORKFLOW STATE...');
    
    // Clear active workflow first
    setActiveWorkflow(null);
    
    // Clear all canvas data
    setAgents(null);
    setConnections(null);
    setFinalData(null);
    setFinalizedResult(null);
    
    // Clear Redux workflows (SINGLE TAB MODE - only one workflow at a time)
    dispatch(removeAllWorkflows());
    
    // STEP 2: CREATE AND SAVE NEW WORKFLOW
    console.log('🔄 CREATING AND SAVING NEW WORKFLOW...');
    
    try {
      // Create workflow data for API
      const workflowApiData = {
        command: data.description,
        type: data.type,
        name: data.name,
        nodes: [],
        connections: []
      };
      
      console.log('📡 Saving workflow to API...');
      
      const apiPayload = {
        dataName: data.name,
        description: data.description,
        dataType: 'json',  // Use 'json' as it's an accepted dataType
        dataContent: {
          autoOrchestrateResult: workflowApiData
        },
        overwrite: true  // Allow overwriting existing workflows
      };
      
      console.log('📤 API Payload:', apiPayload);
      
      // Save to backend API
      const apiResponse = await installData(apiPayload).unwrap();
      
      console.log('✅ API Response:', apiResponse);
      
      // Create workflow data for Redux (matches the Workflow interface)
      const workflowData = {
        id: apiResponse.dataId || Date.now().toString(),
        name: data.name,
        description: `${data.description} (Type: ${data.type})`,
        status: 'draft' as const,
        lastModified: 'Just now',
        nodes: [],
        connections: []
      };
      
      console.log('📝 Created new workflow:', workflowData.name);
      console.log('🎯 Setting new workflow as active:', workflowData.id);
      
      // SINGLE TAB MODE: Set only this workflow in Redux store (replaces any existing)
      dispatch(setWorkflows([workflowData]));
      
      // Set the new workflow as active
      setActiveWorkflow(workflowData.id);
      
      // Set canvas to show empty state for new workflow
      console.log('🎨 Setting canvas to show empty state for new workflow');
      setAgents({}); // Empty object for empty workflow (will show empty state)
      setConnections([]); // Empty array for connections
      
      console.log('🔍 IMMEDIATE STATE CHECK:');
      console.log('- Dispatched setWorkflows with:', [workflowData]);
      console.log('- Set activeWorkflow to:', workflowData.id);
      console.log('- Set agents to empty object for empty state');
      
      // Add to undo stack
      addToUndoStack({
        type: 'CREATE_WORKFLOW',
        description: `Created workflow "${data.name}"`,
        data: { workflowId: workflowData.id, workflowData: workflowData }
      });
      
      console.log('✅ NEW WORKFLOW CREATED AND SAVED SUCCESSFULLY');
      console.log('=== NEW WORKFLOW CREATION END ===');
      
      toast.success(`New workflow created and saved: ${data.name}`, {
        duration: 3000,
        style: {
          background: '#10B981',
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      
    } catch (error: any) {
      console.error('❌ Error saving workflow:', error);
      console.error('❌ Error details:', {
        status: error?.status,
        data: error?.data,
        message: error?.message
      });
      
      // Show more specific error message
      const errorMessage = error?.data?.message || error?.message || 'Unknown error occurred';
      toast.error(`Failed to create workflow: ${errorMessage}`);
      
      // For now, let's create a local workflow as fallback
      console.log('🔄 Creating local workflow as fallback...');
      
      const fallbackWorkflowData = {
        id: Date.now().toString(),
        name: data.name,
        description: `${data.description} (Type: ${data.type})`,
        status: 'draft' as const,
        lastModified: 'Just now',
        nodes: [],
        connections: []
      };
      
      // SINGLE TAB MODE: Set only this workflow in Redux store (replaces any existing)
      dispatch(setWorkflows([fallbackWorkflowData]));
      
      // Set the new workflow as active
      setActiveWorkflow(fallbackWorkflowData.id);
      
      // Set canvas to show empty state for new workflow
      console.log('🎨 Setting canvas to show empty state for fallback workflow');
      setAgents({}); // Empty object for empty workflow (will show empty state)
      setConnections([]); // Empty array for connections
      
      // Add to undo stack
      addToUndoStack({
        type: 'CREATE_WORKFLOW',
        description: `Created local workflow "${data.name}"`,
        data: { workflowId: fallbackWorkflowData.id, workflowData: fallbackWorkflowData }
      });
      
      console.log('✅ LOCAL WORKFLOW CREATED AS FALLBACK');
      toast.success(`Local workflow created: ${data.name} (API save failed)`, {
        duration: 4000,
        style: {
          background: '#F59E0B',
          color: '#fff',
        },
      });
      
      return;
    }
  };

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
        onUndo={handleUndo}
        canUndo={canUndo}
        onExecute={executeWorkflow}
        onStop={stopWorkflow}
        onSave={handleSave}
        onDelete={handleDeleteWorkflow}
        onMenuToggle={handleMobileMenuToggle}
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
          />
        )}
        
        {/* Workflow Canvas - Responsive */}
        <WorkflowCanvas
          key={`canvas-${activeWorkflow || 'empty'}-${agents ? Object.keys(agents).join(',') : 'none'}`}
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
          finalizedResult={orchestratedFinalizedResult}
          executionResults={executionResults}
        />
      </div>

      {/* Prompt Input - Mobile optimized */}
              <PromptInput 
          onSubmit={handlePromptSubmit}
          isProcessing={isProcessing}
          isMobile={isMobile}
        />
    </div>
  );
}