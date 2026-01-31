'use client';

import { Plus, X, Undo2, Bot } from 'lucide-react';
import { Workflow } from '@/types/workflow';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { CreateWorkflowModal, WorkflowFormData } from '@/components/dashboard/CreateWorkflowModal';
import { NewAgentPopup } from './NewAgentPopup';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface WorkflowTabsProps {
  workflows: Workflow[];
  activeWorkflow: string | null;
  onSelectWorkflow: (workflowId: string) => void;
  onCloseWorkflow: (workflowId: string) => void;
  onCreateNew: () => void;
  onCreateWithModal?: (data: WorkflowFormData) => void;
  onCreateCustomAgent?: (data: any) => void; // Handler for custom agent creation
  onRefreshMockData?: () => Promise<void>; // Handler for refreshing mock agent data
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgentPopupOpen, setIsAgentPopupOpen] = useState(false);
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
            {/* <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseWorkflow(workflow.id);
              }}
              className="theme-text-muted hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button> */}
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
                setIsModalOpen(true);
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

        {/* New Agent Button - Only active when there's an active workflow */}
        <button
          onClick={() => {
            if (activeWorkflow) {
              setIsAgentPopupOpen(true);
            } else {
              // Show a helpful message when no workflow is selected
              toast.error('Please select a workflow first to create agents', {
                duration: 3000,
                icon: '⚠️',
              });
            }
          }}
          disabled={!activeWorkflow}
          className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
            activeWorkflow
              ? 'theme-text-secondary hover:theme-text-primary theme-hover-bg'
              : 'theme-text-muted cursor-not-allowed opacity-50'
          }`}
          title={activeWorkflow ? 'Create new agent' : 'Select a workflow first to create agents'}
        >
          <Bot className={`w-4 h-4 ${!activeWorkflow ? 'opacity-50' : ''}`} />
          <span className="text-sm">New Agent</span>
        </button>
      </div>

      {/* Create Workflow Modal */}
      {onCreateWithModal && (
        <CreateWorkflowModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data: WorkflowFormData) => {
            onCreateWithModal(data);
            setIsModalOpen(false);
          }}
        />
      )}

      {/* New Agent Popup */}
      <NewAgentPopup
        isOpen={isAgentPopupOpen}
        onClose={() => setIsAgentPopupOpen(false)}
        onSubmit={(data) => {
          if (onCreateCustomAgent) {
            onCreateCustomAgent(data);
          }
          setIsAgentPopupOpen(false);
        }}
        workflowId={activeWorkflow || undefined}
        userId={userId}
        onRefreshMockData={onRefreshMockData}
      />
    </div>
  );
}