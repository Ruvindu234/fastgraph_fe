import { AgentTemplate } from './types';

/**
 * Registry of available local M Language agent templates
 * These templates appear in the "Templates" section of the workflow sidebar
 */
export const agentTemplates: AgentTemplate[] = [
  {
    id: 'trip-guardian-v3',
    name: 'TripGuardianV3',
    description: 'Travel companion focused on safe, verifiable guidance with weather, safety, and cultural tips',
    category: 'travel',
    icon: '🌍',
    version: '3.0',
    fileName: 'TripGuardianV3.mlang',
    capabilities: ['trip-guardian', 'weather', 'safety', 'culture', 'logistics']
  }
];

/**
 * Get all available agent templates
 */
export function getAgentTemplates(): AgentTemplate[] {
  return agentTemplates;
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): AgentTemplate | undefined {
  return agentTemplates.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): AgentTemplate[] {
  return agentTemplates.filter(template => template.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  return [...new Set(agentTemplates.map(template => template.category))];
}
