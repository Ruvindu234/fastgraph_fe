'use client';

import { Plus, X, Undo2, Bot } from 'lucide-react';
import { Workflow } from '@/types/workflow';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { CreateWorkflowModal, WorkflowFormData } from '@/components/dashboard/CreateWorkflowModal';
import { CreateAgentModal, AgentPromptFormData } from '@/components/workflows/CreateAgentModal';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface WorkflowTabsProps {
  workflows: Workflow[];
  activeWorkflow: string | null;
  onSelectWorkflow: (workflowId: string) => void;
  onCloseWorkflow: (workflowId: string) => void;
  onCreateNew: () => void;
  onCreateWithModal?: (data: WorkflowFormData) => void;
  onCreateCustomAgent?: (data: AgentPromptFormData) => void;
  onRefreshMockData?: () => Promise<void>;
  onUndo?: () => void;
  canUndo?: boolean;
  maxWorkflows: number;
  userId?: string;
}

export function WorkflowTabs({
  workflows,
  activeWorkflow,
  onSelectWorkflow,
  onCloseWorkflow,
  onCreateNew,
  onCreateWithModal,
  onCreateCustomAgent,
  onRefreshMockData,
  onUndo,
  canUndo = false,
  maxWorkflows,
  userId
}: WorkflowTabsProps) {
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  
  return (
    <div className="flex items-center px-4 pb-2">
      <div className="flex space-x-1 flex-1">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg cursor-pointer relative transition-colors ${
              activeWorkflow === workflow.id
                ? 'theme-bg theme-text-primary border-t-2 border-blue-500'
                : 'theme-input-bg theme-text-secondary theme-hover-bg'
            }`}
            onClick={() => onSelectWorkflow(workflow.id)}
          >
            <StatusIndicator status={workflow.status} />
            <span className="text-sm font-medium truncate max-w-[200px]" title={workflow.name}>
              {workflow.name}
            </span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Undo Button */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
              canUndo
                ? 'theme-text-secondary hover:theme-text-primary theme-hover-bg'
                : 'theme-text-muted cursor-not-allowed opacity-50'
            }`}
            title={canUndo ? 'Undo last action' : 'No actions to undo'}
          >
            <Undo2 className="w-4 h-4" />
            <span className="text-sm">Undo</span>
          </button>
        )}

        {/* New Workflow Button */}
        {workflows.length < maxWorkflows && (
          <button
            onClick={() => {
              if (onCreateWithModal) {
                setIsWorkflowModalOpen(true);
              } else {
                onCreateNew();
              }
            }}
            className="flex items-center space-x-1 px-3 py-2 theme-text-secondary hover:theme-text-primary theme-hover-bg rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Workflow</span>
          </button>
        )}

        {/* New Agent Button */}
        <button
          onClick={() => setIsAgentModalOpen(true)}
          className="flex items-center space-x-1 px-3 py-2 theme-text-secondary hover:theme-text-primary theme-hover-bg rounded-lg transition-colors"
          title="Create new agent"
        >
          <Bot className="w-4 h-4" />
          <span className="text-sm">New Agent</span>
        </button>
      </div>

      {/* Create Workflow Modal */}
      {onCreateWithModal && (
        <CreateWorkflowModal
          isOpen={isWorkflowModalOpen}
          onClose={() => setIsWorkflowModalOpen(false)}
          onSubmit={(data: WorkflowFormData) => {
            onCreateWithModal(data);
            setIsWorkflowModalOpen(false);
          }}
        />
      )}

      {/* Create Agent Modal */}
      {onCreateCustomAgent && (
        <CreateAgentModal
          isOpen={isAgentModalOpen}
          onClose={() => setIsAgentModalOpen(false)}
          onSubmit={async (data: AgentPromptFormData) => {
            onCreateCustomAgent(data);
            setIsAgentModalOpen(false);
            
            // Refresh mock data after agent creation
            if (onRefreshMockData) {
              await onRefreshMockData();
            }
          }}
        />
      )}
    </div>
  );
}