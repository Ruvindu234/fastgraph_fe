// M Language Type Definitions

export interface MLanguageMeta {
  name: string;
  capabilities: string[];
  version?: string;
  description: string;
  system_prompt?: string;
  welcome_message?: string;
  extract_variables?: string[];
  guardrails?: {
    max_tokens_per_request?: number;
    max_requests_per_hour?: number;
    safety_rules?: string[];
    redirect_guidance?: string;
    required_disclaimers?: string[];
    prohibited_topics?: string[];
  };
}

export interface MLanguageNode {
  id: string;
  type: 'llm' | 'http_request' | 'function' | 'condition';
  name: string;
  config: {
    model?: string;
    prompt?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    optional?: boolean;
  };
}

export interface MLanguageEdge {
  source: string;
  target: string;
}

export interface MLanguageSpec {
  agentName: string;
  meta: MLanguageMeta;
  schedule?: {
    interval: string;
    mode: string;
  };
  nodes: MLanguageNode[];
  edges: MLanguageEdge[];
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  fileName: string;
  capabilities: string[];
}

export interface ParsedWorkflowAgent {
  name: string;
  role: string;
  capabilities: string[];
  inputs: string[];
  outputs: string[];
  nodeType: 'llm' | 'http_request' | 'function' | 'condition';
  config: MLanguageNode['config'];
}

export interface ParsedWorkflow {
  name: string;
  description: string;
  agents: Record<string, ParsedWorkflowAgent>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: null;
    targetHandle: null;
    type: string;
  }>;
  meta: MLanguageMeta;
}
