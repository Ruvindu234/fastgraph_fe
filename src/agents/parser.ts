import { MLanguageSpec, MLanguageNode, MLanguageEdge, MLanguageMeta, ParsedWorkflow, ParsedWorkflowAgent } from './types';

/**
 * M Language Parser
 * Parses M Language specification files into workflow-compatible structures
 */

/**
 * Parse an M Language specification string into a structured object
 */
export function parseMLanguage(content: string): MLanguageSpec | null {
  try {
    // Extract agent name
    const agentNameMatch = content.match(/agent\s+(\w+)\s*\{/);
    if (!agentNameMatch) {
      console.error('Could not find agent name in M Language spec');
      return null;
    }
    const agentName = agentNameMatch[1];

    // Parse meta section
    const meta = parseMetaSection(content);
    if (!meta) {
      console.error('Could not parse meta section');
      return null;
    }

    // Parse schedule section (optional)
    const schedule = parseScheduleSection(content);

    // Parse nodes section
    const nodes = parseNodesSection(content);

    // Parse edges section
    const edges = parseEdgesSection(content);

    return {
      agentName,
      meta,
      schedule,
      nodes,
      edges
    };
  } catch (error) {
    console.error('Error parsing M Language spec:', error);
    return null;
  }
}

/**
 * Parse the meta section of the M Language spec
 */
function parseMetaSection(content: string): MLanguageMeta | null {
  const metaMatch = content.match(/meta\s*\{([\s\S]*?)\n\s*\}/);
  if (!metaMatch) return null;

  const metaContent = metaMatch[1];

  // Extract simple string fields
  const name = extractStringField(metaContent, 'name') || 'Unknown Agent';
  const version = extractStringField(metaContent, 'version');
  const description = extractStringField(metaContent, 'description') || '';
  const welcome_message = extractStringField(metaContent, 'welcome_message');
  
  // Extract multi-line string fields (triple quotes)
  const system_prompt = extractMultilineString(metaContent, 'system_prompt');
  
  // Extract array fields
  const capabilities = extractArrayField(metaContent, 'capabilities');
  const extract_variables = extractArrayField(metaContent, 'extract_variables');

  // Parse guardrails (nested object)
  const guardrails = parseGuardrails(metaContent);

  return {
    name,
    capabilities,
    version,
    description,
    system_prompt,
    welcome_message,
    extract_variables,
    guardrails
  };
}

/**
 * Parse guardrails section
 */
function parseGuardrails(metaContent: string): MLanguageMeta['guardrails'] | undefined {
  const guardrailsMatch = metaContent.match(/guardrails:\s*\{([\s\S]*?)\n\s*\}/);
  if (!guardrailsMatch) return undefined;

  const guardrailsContent = guardrailsMatch[1];

  return {
    max_tokens_per_request: extractNumberField(guardrailsContent, 'max_tokens_per_request'),
    max_requests_per_hour: extractNumberField(guardrailsContent, 'max_requests_per_hour'),
    safety_rules: extractArrayField(guardrailsContent, 'safety_rules'),
    redirect_guidance: extractMultilineString(guardrailsContent, 'redirect_guidance'),
    required_disclaimers: extractArrayField(guardrailsContent, 'required_disclaimers'),
    prohibited_topics: extractArrayField(guardrailsContent, 'prohibited_topics')
  };
}

/**
 * Parse schedule section
 */
function parseScheduleSection(content: string): { interval: string; mode: string } | undefined {
  const scheduleMatch = content.match(/schedule\s*\{([\s\S]*?)\}/);
  if (!scheduleMatch) return undefined;

  const scheduleContent = scheduleMatch[1];
  const interval = extractStringField(scheduleContent, 'interval') || '30m';
  const mode = extractStringField(scheduleContent, 'mode') || 'manual';

  return { interval, mode };
}

/**
 * Parse nodes section
 */
function parseNodesSection(content: string): MLanguageNode[] {
  const nodes: MLanguageNode[] = [];
  
  // Match the nodes block
  const nodesBlockMatch = content.match(/nodes\s*\{([\s\S]*?)\n\s*\}\s*\n\s*edges/);
  if (!nodesBlockMatch) return nodes;

  const nodesContent = nodesBlockMatch[1];

  // Match individual node definitions: type name { ... }
  // Pattern: node_type node_name { config }
  const nodePatterns = [
    { type: 'llm' as const, regex: /llm\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g },
    { type: 'http_request' as const, regex: /http_request\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g }
  ];

  for (const pattern of nodePatterns) {
    let match;
    while ((match = pattern.regex.exec(nodesContent)) !== null) {
      const nodeName = match[1];
      const nodeContent = match[2];

      const node: MLanguageNode = {
        id: nodeName,
        type: pattern.type,
        name: nodeName,
        config: parseNodeConfig(nodeContent, pattern.type)
      };

      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Parse node configuration
 */
function parseNodeConfig(nodeContent: string, nodeType: string): MLanguageNode['config'] {
  const config: MLanguageNode['config'] = {};

  if (nodeType === 'llm') {
    config.model = extractStringField(nodeContent, 'model');
    config.prompt = extractMultilineString(nodeContent, 'prompt') || extractStringField(nodeContent, 'prompt');
  } else if (nodeType === 'http_request') {
    config.url = extractStringField(nodeContent, 'url');
    config.method = extractStringField(nodeContent, 'method');
    config.timeout = extractNumberField(nodeContent, 'timeout');
    config.optional = extractStringField(nodeContent, 'optional') === 'true';
    config.body = extractStringField(nodeContent, 'body');
    
    // Parse headers
    const headersMatch = nodeContent.match(/headers:\s*\{([\s\S]*?)\}/);
    if (headersMatch) {
      const headersContent = headersMatch[1];
      const headers: Record<string, string> = {};
      const headerLines = headersContent.match(/"([^"]+)":\s*"([^"]+)"/g);
      if (headerLines) {
        headerLines.forEach(line => {
          const parts = line.match(/"([^"]+)":\s*"([^"]+)"/);
          if (parts) {
            headers[parts[1]] = parts[2];
          }
        });
      }
      config.headers = headers;
    }
  }

  return config;
}

/**
 * Parse edges section
 */
function parseEdgesSection(content: string): MLanguageEdge[] {
  const edges: MLanguageEdge[] = [];
  
  const edgesMatch = content.match(/edges\s*\{([\s\S]*?)\n\s*\}\s*$/);
  if (!edgesMatch) return edges;

  const edgesContent = edgesMatch[1];
  
  // Match edge definitions: source -> target
  const edgeRegex = /(\w+)\s*->\s*(\w+)/g;
  let match;
  while ((match = edgeRegex.exec(edgesContent)) !== null) {
    const source = match[1];
    const target = match[2];
    
    // Skip START and END markers, we'll handle them specially
    if (source !== 'START' && target !== 'END') {
      edges.push({ source, target });
    }
  }

  return edges;
}

/**
 * Extract a simple string field value
 */
function extractStringField(content: string, fieldName: string): string | undefined {
  const regex = new RegExp(`${fieldName}:\\s*"([^"]*)"`, 'm');
  const match = content.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extract a number field value
 */
function extractNumberField(content: string, fieldName: string): number | undefined {
  const regex = new RegExp(`${fieldName}:\\s*(\\d+)`, 'm');
  const match = content.match(regex);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract a multi-line string field (triple quotes)
 */
function extractMultilineString(content: string, fieldName: string): string | undefined {
  const regex = new RegExp(`${fieldName}:\\s*"""([\\s\\S]*?)"""`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract an array field value
 */
function extractArrayField(content: string, fieldName: string): string[] {
  const regex = new RegExp(`${fieldName}:\\s*\\[([^\\]]*?)\\]`, 'm');
  const match = content.match(regex);
  if (!match) return [];

  const arrayContent = match[1];
  const items = arrayContent.match(/"([^"]+)"/g);
  return items ? items.map(item => item.replace(/"/g, '')) : [];
}

/**
 * Convert parsed M Language spec to workflow-compatible format
 */
export function convertToWorkflow(spec: MLanguageSpec): ParsedWorkflow {
  const agents: Record<string, ParsedWorkflowAgent> = {};

  // Convert nodes to agents
  for (const node of spec.nodes) {
    const role = node.type === 'llm' ? 'LLM Agent' : 'HTTP Request';
    
    // Find inputs from edges (what nodes feed into this one)
    const inputs = spec.edges
      .filter(edge => edge.target === node.id)
      .map(edge => `${edge.source}_output`);

    // Find outputs from edges (what this node feeds into)
    const outputs = spec.edges
      .filter(edge => edge.source === node.id)
      .map(edge => `${node.id}_output`);

    // Ensure unique outputs
    const uniqueOutputs = [...new Set(outputs)];
    if (uniqueOutputs.length === 0) {
      uniqueOutputs.push(`${node.id}_output`);
    }

    // Extract capabilities from the prompt or config
    const capabilities: string[] = [];
    if (node.type === 'llm') {
      capabilities.push('language-model', 'text-generation');
      if (node.config.prompt?.includes('extract')) capabilities.push('extraction');
      if (node.config.prompt?.includes('analyze')) capabilities.push('analysis');
      if (node.config.prompt?.includes('summarize')) capabilities.push('summarization');
    } else if (node.type === 'http_request') {
      capabilities.push('api-call', 'data-fetch');
      if (node.config.url?.includes('weather')) capabilities.push('weather');
      if (node.config.url?.includes('places')) capabilities.push('places-api');
    }

    agents[node.id] = {
      name: node.name,
      role,
      capabilities,
      inputs: inputs.length > 0 ? inputs : ['input'],
      outputs: uniqueOutputs,
      nodeType: node.type,
      config: node.config
    };
  }

  // Convert edges to connections
  const connections = spec.edges.map((edge, index) => ({
    id: `connection-${edge.source}-${edge.target}-${index}`,
    source: `agent-${edge.source}`,
    target: `agent-${edge.target}`,
    sourceHandle: null,
    targetHandle: null,
    type: 'default'
  }));

  return {
    name: spec.meta.name,
    description: spec.meta.description,
    agents,
    connections,
    meta: spec.meta
  };
}

/**
 * Load and parse an M Language file
 */
export async function loadMLanguageFile(fileName: string): Promise<ParsedWorkflow | null> {
  try {
    // Dynamic import of the raw file content
    const content = await import(`!!raw-loader!./${fileName}`);
    const spec = parseMLanguage(content.default || content);
    if (!spec) return null;
    return convertToWorkflow(spec);
  } catch (error) {
    console.error(`Error loading M Language file ${fileName}:`, error);
    return null;
  }
}
