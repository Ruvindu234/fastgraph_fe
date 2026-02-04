'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Bot, Sparkles } from 'lucide-react';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AgentPromptFormData) => void;
}

export interface AgentPromptFormData {
  name: string;
  prompt: string;
}

export function CreateAgentModal({ isOpen, onClose, onSubmit }: CreateAgentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<AgentPromptFormData>({
    defaultValues: {
      name: generateDefaultName(),
      prompt: ''
    }
  });
  
  const formData = watch();

  // Generate a default agent name
  function generateDefaultName(): string {
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
    return `Agent ${timestamp}`;
  }

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        name: generateDefaultName(),
        prompt: ''
      });
    }
  }, [isOpen, reset]);

  const onSubmitHandler = async (data: AgentPromptFormData) => {
    setIsSubmitting(true);
    onSubmit(data);
    handleClose();
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing during submission
    
    // Reset form
    reset({
      name: generateDefaultName(),
      prompt: ''
    });
    setFocusedField(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Agent"
      maxWidth="max-w-2xl"
      headerColor="purple"
      headerIcon="Bot"
    >
      <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-4">
        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium theme-text-primary mb-1.5">
            Agent Name *
          </label>
          <div className="relative">
            <input
              type="text"
              {...register('name', {
                required: 'Agent name is required',
                maxLength: {
                  value: 200,
                  message: 'Agent name must be 200 characters or less'
                }
              })}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              maxLength={200}
              className={`w-full theme-input-bg theme-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : focusedField === 'name'
                    ? 'focus:ring-purple-500 focus:border-purple-500 transform scale-[1.02]'
                    : 'focus:ring-purple-500'
              }`}
              placeholder="Enter agent name"
              disabled={isSubmitting}
            />
            {focusedField === 'name' && !errors.name && (
              <div className="absolute -top-1 -right-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          {errors.name && (
            <div className="mt-1 text-xs text-red-500 flex items-center animate-in slide-in-from-left-2 duration-200">
              <Icon name="AlertCircle" className="w-3 h-3 mr-1" />
              <span>{errors.name.message}</span>
            </div>
          )}
        </div>

        {/* Agent Prompt */}
        <div>
          <label className="block text-sm font-medium theme-text-primary mb-1.5 flex items-center gap-2">
            <span>Agent Prompt *</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          </label>
          <div className="relative">
            <textarea
              {...register('prompt', {
                required: 'Agent prompt is required',
                minLength: {
                  value: 10,
                  message: 'Prompt must be at least 10 characters'
                }
              })}
              onFocus={() => setFocusedField('prompt')}
              onBlur={() => setFocusedField(null)}
              rows={6}
              className={`w-full theme-input-bg theme-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all duration-200 resize-none ${
                errors.prompt
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : focusedField === 'prompt'
                    ? 'focus:ring-purple-500 focus:border-purple-500 transform scale-[1.02]'
                    : 'focus:ring-purple-500'
              }`}
              placeholder="Describe what you want this agent to do...&#10;&#10;Example: Create a data validation agent that checks user inputs for required fields and formats."
              disabled={isSubmitting}
            />
            {focusedField === 'prompt' && !errors.prompt && (
              <div className="absolute -top-1 -right-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          {errors.prompt && (
            <div className="mt-1 text-xs text-red-500 flex items-center animate-in slide-in-from-left-2 duration-200">
              <Icon name="AlertCircle" className="w-3 h-3 mr-1" />
              <span>{errors.prompt.message}</span>
            </div>
          )}
          <p className="mt-1.5 text-xs theme-text-muted">
            💡 Tip: Be specific about the agent's role, capabilities, and expected outputs
          </p>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t theme-border mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Bot}
            disabled={isSubmitting}
            className={`transition-all duration-200 hover:scale-105 ${
              isSubmitting ? 'animate-pulse' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Creating Agent...
              </>
            ) : (
              'Create Agent'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
