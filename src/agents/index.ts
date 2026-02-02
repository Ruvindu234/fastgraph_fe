// M Language Agent Templates Module
// This module provides functionality for loading and parsing M Language agent specifications

export * from './types';
export * from './registry';
export * from './parser';

// Re-export commonly used items
export { agentTemplates, getAgentTemplates, getTemplateById } from './registry';
export { parseMLanguage, convertToWorkflow } from './parser';
