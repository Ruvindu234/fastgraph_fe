import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useAutoOrchestrateMutation, useInstallDataMutation } from '@/redux/api/autoOrchestrate/autoOrchestrateApi';
import { useLogAuditMutation } from '@/redux/api/audit/auditApi';
import { selectCurrentUser } from '@/redux/slice/authSlice';
import { mockAutoOrchestrateResult } from '@/services/workflows/mockData';
import { processAgentsFromResponse } from '@/services/workflows/agentProcessor';
import type { ProcessedAgent, AgentConnection } from '@/services/workflows/agentProcessor';

interface UseAutoOrchestrateProps {
  workflows: any[];
  onAgentsProcessed: (agents: Record<string, ProcessedAgent>, connections: AgentConnection[], finalData?: any, finalizedArtifactLinks?: any[]) => void;
}

interface UseAutoOrchestrateReturn {
  isAutoOrchestrating: boolean;
  autoOrchestrateError: any;
  agents: Record<string, ProcessedAgent> | null;
  connections: AgentConnection[] | null;
  finalData: any;
  finalizedResult: any;
  finalizedArtifactLinks: any[];
  executionResults: any;
  streamData: any;
  progress: {
    step: string;
    progress: number;
    message: string;
  } | null;
  resetAutoOrchestrate: () => void;
  startAutoOrchestrate: (command: string) => void;
  stopAutoOrchestrate: () => void;
}

export function useAutoOrchestrate({
  workflows,
  onAgentsProcessed
}: UseAutoOrchestrateProps): UseAutoOrchestrateReturn {
  const [agents, setAgents] = useState<Record<string, ProcessedAgent> | null>(null);
  const [connections, setConnections] = useState<AgentConnection[] | null>(null);
  const [finalData, setFinalData] = useState<any>(null);
  const [finalizedResult, setFinalizedResult] = useState<any>(null);
  const [finalizedArtifactLinks, setFinalizedArtifactLinks] = useState<any[]>([]);
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [streamData, setStreamData] = useState<any>(null);
  const [progress, setProgress] = useState<{ step: string; progress: number; message: string } | null>(null);
  const [isAutoOrchestrating, setIsAutoOrchestrating] = useState(false);
  const [autoOrchestrateError, setAutoOrchestrateError] = useState<any>(null);
  const hasAutoOrchestrated = useRef(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const user = useSelector(selectCurrentUser);

  console.log('user 123', user);

  const [autoOrchestrate] = useAutoOrchestrateMutation();
  const [installData] = useInstallDataMutation();
  const [logAudit] = useLogAuditMutation();

  // Reset function to clear auto orchestrate state
  const resetAutoOrchestrate = useCallback(() => {
    console.log('Resetting auto orchestrate state...');
    setAgents(null);
    setConnections(null);
    setFinalData(null);
    setFinalizedResult(null);
    setFinalizedArtifactLinks([]);
    setExecutionResults(null);
    setStreamData(null);
    setProgress(null);
    setAutoOrchestrateError(null);
    setIsAutoOrchestrating(false);
    hasAutoOrchestrated.current = false;
    
    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    console.log('Auto orchestrate state reset successfully');
  }, []);

  const stopAutoOrchestrate = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsAutoOrchestrating(false);
  }, []);

  const startAutoOrchestrate = useCallback(async (command: string) => {
    console.log('🚀 startAutoOrchestrate called with command:', command);
    
    if (!command) {
      console.error('No command provided for auto orchestrate');
      return;
    }

    // Check if already orchestrating
    if (isAutoOrchestrating) {
      console.warn('Auto orchestrate already in progress, skipping...');
      return;
    }

    // Reset state before starting
    resetAutoOrchestrate();
    setIsAutoOrchestrating(true);
    setAutoOrchestrateError(null);

    // Log workflow start
    try {
      await logAudit({
        action: 'other',
        resource: 'data',
        description: `Workflow started: Auto-orchestrate execution`,
        details: `Command: ${command}`,
        task: 'workflow-execution',
        endpoint: '/api/v1/auto-orchestrate',
        method: 'POST',
        statusCode: 200,
        metadata: {
          command,
          startTime: new Date().toISOString(),
          eventType: 'workflow_start'
        },
        createdBy: user?.id || user?.userId || 'unknown-user',
        userAgent: navigator.userAgent
      }).unwrap();
    } catch (auditError) {
      console.warn('Failed to log workflow start:', auditError);
    }

    try {
      // Use direct external API call and handle streaming response
      const url = `https://fatgraph-prod-twu675cviq-uc.a.run.app/autoOrchestrateStreamSSE?command=${encodeURIComponent(command)}`;
      console.log('🔗 Calling external API directly:', url);
      
      // Set initial progress
      setProgress({
        step: 'initializing',
        progress: 0,
        message: 'Starting auto orchestration...'
      });

      // Make direct API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      console.log('📡 API response status:', response.status);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let finalData = null;
      let buffer = '';

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
              console.log('📨 Stream data received:', {
                event: jsonData.event,
                step: jsonData.step,
                hasAutoOrchestrateResponse: !!jsonData.auto_orchestrate_response,
                autoOrchestrateResponseKeys: jsonData.auto_orchestrate_response ? Object.keys(jsonData.auto_orchestrate_response) : 'none',
                fullData: jsonData
              });
              
              // Update progress based on event type
              if (jsonData.event === 'step_start') {
                setProgress({
                  step: jsonData.step,
                  progress: 0,
                  message: jsonData.message || `Starting ${jsonData.step}...`
                });
              } else if (jsonData.event === 'progress') {
                setProgress({
                  step: jsonData.step,
                  progress: jsonData.progress,
                  message: jsonData.message || `Processing ${jsonData.step}... ${jsonData.progress}%`
                });
              } else if (jsonData.event === 'workflow_complete') {
                finalData = jsonData;
                console.log('✅ Workflow completed, final data:', {
                  event: finalData.event,
                  hasAutoOrchestrateResponse: !!finalData.auto_orchestrate_response,
                  autoOrchestrateResponseKeys: finalData.auto_orchestrate_response ? Object.keys(finalData.auto_orchestrate_response) : 'none',
                  hasSwarmResult: !!finalData.auto_orchestrate_response?.swarm_result,
                  swarmResultKeys: finalData.auto_orchestrate_response?.swarm_result ? Object.keys(finalData.auto_orchestrate_response.swarm_result) : 'none',
                  fullData: finalData
                });
              }
              
              // Update stream data for UI
              setStreamData(jsonData);
              
            } catch (parseError) {
              console.warn('Failed to parse stream data:', parseError, 'Line:', line);
            }
          }
        }
      }

      if (!finalData) {
        throw new Error('No complete workflow data received from stream');
      }

      console.log('📨 Final API response data:', finalData);
      console.log('🔍 Raw data structure analysis:', {
        hasAutoOrchestrateResponse: !!finalData?.auto_orchestrate_response,
        autoOrchestrateResponseKeys: finalData?.auto_orchestrate_response ? Object.keys(finalData.auto_orchestrate_response) : [],
        hasSwarmResult: !!finalData?.auto_orchestrate_response?.swarm_result,
        swarmResultKeys: finalData?.auto_orchestrate_response?.swarm_result ? Object.keys(finalData.auto_orchestrate_response.swarm_result) : [],
        hasExecutionResults: !!finalData?.auto_orchestrate_response?.swarm_result?.execution_results,
        executionResultsKeys: finalData?.auto_orchestrate_response?.swarm_result?.execution_results ? Object.keys(finalData.auto_orchestrate_response.swarm_result.execution_results) : [],
        hasFinalData: !!finalData?.auto_orchestrate_response?.swarm_result?.final_data,
        finalDataKeys: finalData?.auto_orchestrate_response?.swarm_result?.final_data ? Object.keys(finalData.auto_orchestrate_response.swarm_result.final_data) : []
      });

      // Process the result
      const { agents: processedAgents, connections: processedConnections, finalData: processedFinalData, finalizedResult: processedFinalizedResult, finalizedArtifactLinks: processedFinalizedArtifactLinks, executionResults: processedExecutionResults } = 
        processAgentsFromResponse(finalData);
      
      console.log('🔍 useAutoOrchestrate Debug:', {
        processedAgentsCount: Object.keys(processedAgents).length,
        processedAgentsKeys: Object.keys(processedAgents),
        processedConnectionsCount: processedConnections.length,
        processedFinalizedArtifactLinksLength: processedFinalizedArtifactLinks?.length,
        processedFinalizedArtifactLinks: processedFinalizedArtifactLinks,
        // Debug each agent's data
        agentsData: Object.entries(processedAgents).map(([name, agent]) => ({
          name,
          hasInputValues: !!agent.inputValues && Object.keys(agent.inputValues).length > 0,
          inputValuesKeys: agent.inputValues ? Object.keys(agent.inputValues) : [],
          inputValues: agent.inputValues,
          hasAgentInput: !!agent.agentInput,
          agentInput: agent.agentInput ? agent.agentInput.substring(0, 100) + '...' : null
        }))
      });
     
      setAgents(processedAgents);
      setConnections(processedConnections);
      setFinalData(processedFinalData);
      setFinalizedResult(processedFinalizedResult);
      setFinalizedArtifactLinks(processedFinalizedArtifactLinks || []);
      setExecutionResults(processedExecutionResults);
      onAgentsProcessed(processedAgents, processedConnections, processedFinalData, processedFinalizedArtifactLinks);

      // Update progress to complete
      setProgress({
        step: 'completed',
        progress: 100,
        message: 'Auto orchestration completed'
      });

      // Save the auto orchestrate result using useInstallDataMutation
      if (user?.id) {
        try {
                console.log('💾 Attempting to save auto orchestrate data...', {
                  userId: user.id,
                  dataName: command.length > 50 ? `${command.substring(0, 47)}...` : command,
                  dataType: 'json',
                  numberOfAgents: Object.keys(processedAgents).length,
                  processedAgentsKeys: Object.keys(processedAgents),
                  dataContentKeys: finalData ? Object.keys(finalData) : 'no finalData',
                  autoOrchestrateResponseKeys: finalData?.auto_orchestrate_response ? Object.keys(finalData.auto_orchestrate_response) : 'no auto_orchestrate_response'
                });

          // Prepare data content with fallback - structure it to match UI expectations
          //noe build
          let dataContent: any = {
            autoOrchestrateResult: {
              nodes: processedConnections.length > 0 ? Object.keys(processedAgents).map(agentId => ({
                id: `agent-${agentId}`,
                type: 'agent',
                position: { x: 0, y: 0 },
                data: processedAgents[agentId]
              })) : [],
              connections: processedConnections
            },
            rawData: finalData.auto_orchestrate_response || finalData
          };
          
          console.log('🔍 DataContent Debug:', {
            finalDataKeys: finalData ? Object.keys(finalData) : 'no finalData',
            autoOrchestrateResponseKeys: finalData?.auto_orchestrate_response ? Object.keys(finalData.auto_orchestrate_response) : 'no auto_orchestrate_response',
            dataContentKeys: dataContent ? Object.keys(dataContent) : 'no dataContent',
            dataContentType: typeof dataContent,
            dataContentStringified: JSON.stringify(dataContent, null, 2)
          });
          
          // If data is too large or invalid, create a summary
          const dataStr = JSON.stringify(dataContent);
          if (dataStr.length > 5 * 1024 * 1024) { // 5MB limit
            console.warn('⚠️ Data too large, creating summary...');
            dataContent = {
              autoOrchestrateResult: {
                nodes: [],
                connections: []
              },
              summary: 'Auto orchestrate result (data too large for storage)',
              command: command,
              agentsCount: Object.keys(processedAgents).length,
              connectionsCount: processedConnections.length,
              timestamp: new Date().toISOString(),
              originalDataSize: dataStr.length
            };
          }

          // Calculate number of agents - use processedAgents if available, otherwise try to extract from data
          let numberOfAgents = Object.keys(processedAgents).length;
          if (numberOfAgents === 0) {
            // Try to extract agent count from the raw data
            const rawData = dataContent?.rawData;
            const swarmSpec = rawData?.swarm_result?.swarm_spec;
            if (swarmSpec?.agents) {
              numberOfAgents = Object.keys(swarmSpec.agents).length;
            } else if (rawData?.m_language_spec) {
              // Count agents in the M Language spec string
              const agentMatches = rawData.m_language_spec.match(/agent\s+\w+/g);
              numberOfAgents = agentMatches ? agentMatches.length : 1; // Default to 1 if we can't count
            } else {
              numberOfAgents = 1; // Default fallback
            }
          }

          console.log('📊 Agent count calculation:', {
            processedAgentsCount: Object.keys(processedAgents).length,
            calculatedNumberOfAgents: numberOfAgents,
            swarmSpecAgents: dataContent?.rawData?.swarm_result?.swarm_spec?.agents ? Object.keys(dataContent.rawData.swarm_result.swarm_spec.agents) : 'none',
            hasMLanguageSpec: !!dataContent?.rawData?.m_language_spec
          });

          // Truncate command for a reasonable workflow name (max 50 chars)
          const truncatedName = command.length > 50 
            ? `${command.substring(0, 47)}...` 
            : command;
          
          const saveResult = await installData({
            dataName: truncatedName,
            description: command,
            dataType: 'json',
            dataContent: dataContent,
            numberOfAgents: numberOfAgents,
            overwrite: false
          }).unwrap();

          console.log('✅ Auto orchestrate data saved successfully:', saveResult);

        } catch (error) {
          console.error('❌ Error saving auto orchestrate data:', error);
          console.error('Error details:', {
            errorType: typeof error,
            errorMessage: (error as any)?.message || 'No message',
            errorStatus: (error as any)?.status || 'No status',
            errorData: (error as any)?.data || 'No data',
            errorStack: (error as any)?.stack || 'No stack',
            fullError: error
          });
          
          // Don't throw the error, just log it so the workflow can continue
          console.warn('⚠️ Continuing despite save error...');
        }
      } else {
        console.warn('⚠️ No user ID available, skipping data save');
      }

      setIsAutoOrchestrating(false);

      // Log workflow completion
      try {
        await logAudit({
          action: 'other',
          resource: 'data',
          description: `Workflow completed: Auto-orchestrate execution`,
          details: `Command: ${command}, Agents: ${Object.keys(processedAgents).length}, Connections: ${processedConnections.length}`,
          task: 'workflow-execution',
          endpoint: '/api/v1/auto-orchestrate',
          method: 'POST',
          statusCode: 200,
          metadata: {
            command,
            agentsCount: Object.keys(processedAgents).length,
            connectionsCount: processedConnections.length,
            endTime: new Date().toISOString(),
            eventType: 'workflow_completed'
          },
          createdBy: user?.id || user?.userId || 'unknown-user',
          userAgent: navigator.userAgent
        }).unwrap();
      } catch (auditError) {
        console.warn('Failed to log workflow completion:', auditError);
      }
    } catch (error) {
      console.error('Error calling auto orchestrate API:', error);
      setAutoOrchestrateError(error);
      setIsAutoOrchestrating(false);
    }
  }, [user, installData, onAgentsProcessed, resetAutoOrchestrate, isAutoOrchestrating]);

  // Removed automatic workflow execution - workflows should only run when explicitly requested
  // useEffect(() => {
  //   const autoOrchestrateFirstWorkflow = async () => {
  //     // Reset auto-orchestrate state for new prompts
  //     if (hasAutoOrchestrated.current) {
  //       console.log('Auto orchestrate already completed, skipping...');
  //       return;
  //     }

  //     if (workflows.length === 0) {
  //       console.log('No workflows available for auto orchestrate');
  //       return;
  //     }

  //     const firstWorkflow = workflows[0];
  //     const firstWorkflowDescription = firstWorkflow?.description;
      
  //     if (firstWorkflowDescription) {
  //       console.log('Auto orchestrating with command:', firstWorkflowDescription);
  //       hasAutoOrchestrated.current = true;
  //       await startAutoOrchestrate(firstWorkflowDescription);
  //     }
  //   };

  //   autoOrchestrateFirstWorkflow();
  // }, [workflows, startAutoOrchestrate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isAutoOrchestrating,
    autoOrchestrateError,
    agents,
    connections,
    finalData,
    finalizedResult,
    finalizedArtifactLinks,
    executionResults,
    streamData,
    progress,
    resetAutoOrchestrate,
    startAutoOrchestrate,
    stopAutoOrchestrate
  };
}