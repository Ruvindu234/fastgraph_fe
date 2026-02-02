// M Language Agent Templates Module
// This module provides functionality for loading and parsing M Language agent specifications

export * from './types';
export * from './registry';
export * from './parser';
export * from './layoutCalculator';

// Re-export commonly used items
export { agentTemplates, getAgentTemplates, getTemplateById } from './registry';
export { parseMLanguage, convertToWorkflow } from './parser';
export { 
  calculateDAGLayout, 
  calculateDAGLayoutAsync,
  calculateDAGLayoutWithEdges, 
  calculateDAGLayoutWithEdgesAsync,
  calculateTripGuardianLayout,
  calculateTemplateLayoutAsync
} from './layoutCalculator';
