'use client';

import { useState, useCallback, useMemo } from 'react';
import { agentTemplates, AgentTemplate, parseMLanguage, convertToWorkflow, ParsedWorkflow } from '@/agents';
import { getTemplateContent } from '@/agents/templates';

export interface UseTemplatesReturn {
  templates: AgentTemplate[];
  loadTemplate: (templateId: string) => ParsedWorkflow | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing M Language agent templates
 * Provides access to available templates and functionality to load them
 */
export function useTemplates(): UseTemplatesReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all available templates
  const templates = useMemo(() => agentTemplates, []);

  /**
   * Load and parse a template by its ID
   */
  const loadTemplate = useCallback((templateId: string): ParsedWorkflow | null => {
    setIsLoading(true);
    setError(null);

    try {
      // Find the template
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        setError(`Template not found: ${templateId}`);
        setIsLoading(false);
        return null;
      }

      // Get the raw content
      const content = getTemplateContent(template.fileName);
      if (!content) {
        setError(`Template content not found: ${template.fileName}`);
        setIsLoading(false);
        return null;
      }

      // Parse the M Language content
      const spec = parseMLanguage(content);
      if (!spec) {
        setError(`Failed to parse template: ${template.fileName}`);
        setIsLoading(false);
        return null;
      }

      // Convert to workflow format
      const workflow = convertToWorkflow(spec);
      
      setIsLoading(false);
      return workflow;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading template';
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, [templates]);

  return {
    templates,
    loadTemplate,
    isLoading,
    error
  };
}
