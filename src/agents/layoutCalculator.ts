/**
 * DAG Layout Calculator for M Language Workflows
 * Uses ELK (Eclipse Layout Kernel) for optimal node positioning and edge routing
 * ELK provides advanced algorithms that handle 100+ edges efficiently
 */

import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

// Create ELK instance
const elk = new ELK();

interface LayoutEdge {
  source: string;
  target: string;
}

interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  levels: Record<string, number>;
}

/**
 * Calculate hierarchical positions for nodes using ELK algorithm
 * ELK provides superior edge routing and crossing minimization compared to Dagre
 */
export async function calculateDAGLayoutAsync(
  nodeIds: string[],
  edges: LayoutEdge[],
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSeparation?: number;
    nodeSeparation?: number;
    direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
  } = {}
): Promise<LayoutResult> {
  const {
    nodeWidth = 150,
    nodeHeight = 60,
    rankSeparation = 150,
    nodeSeparation = 100,
    direction = 'DOWN'
  } = options;

  // Build ELK graph structure with aggressive crossing minimization
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      // Core algorithm
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      
      // Spacing
      'elk.spacing.nodeNode': String(nodeSeparation),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(rankSeparation),
      'elk.spacing.edgeNode': '60',
      'elk.spacing.edgeEdge': '40',
      'elk.padding': '[top=50,left=100,bottom=50,right=100]',
      
      // Edge routing - use SPLINES for smoother non-crossing edges
      'elk.edgeRouting': 'SPLINES',
      'elk.layered.edgeRouting.splines.mode': 'CONSERVATIVE',
      
      // Aggressive crossing minimization
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.crossingMinimization.semiInteractive': 'false',
      'elk.layered.thoroughness': '100',  // Max thoroughness for crossing minimization
      
      // Node placement optimization
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      
      // Consider order for better results
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
      'elk.layered.mergeEdges': 'true',
      'elk.layered.mergeHierarchyEdges': 'true',
      
      // Optimize long edges
      'elk.layered.wrapping.strategy': 'OFF',
      'elk.layered.unnecessaryBendpoints': 'true'
    },
    children: nodeIds.map(id => ({
      id,
      width: nodeWidth,
      height: nodeHeight
    })),
    edges: edges
      .filter(edge => {
        const sourceId = edge.source.replace('agent-', '');
        const targetId = edge.target.replace('agent-', '');
        return nodeIds.includes(sourceId) && nodeIds.includes(targetId);
      })
      .map((edge, index) => ({
        id: `edge-${index}`,
        sources: [edge.source.replace('agent-', '')],
        targets: [edge.target.replace('agent-', '')]
      }))
  };

  try {
    // Run ELK layout algorithm
    const layoutedGraph = await elk.layout(graph);

    // Extract positions
    const positions: Record<string, { x: number; y: number }> = {};
    const levels: Record<string, number> = {};

    layoutedGraph.children?.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        positions[node.id] = {
          x: node.x,
          y: node.y
        };
        // Calculate level based on y position
        levels[node.id] = Math.round(node.y / (nodeHeight + rankSeparation));
      }
    });

    return { positions, levels };
  } catch (error) {
    console.error('ELK layout error:', error);
    // Fallback to simple grid layout
    return calculateFallbackLayout(nodeIds, nodeWidth, nodeHeight);
  }
}

/**
 * Synchronous wrapper that returns a Promise-based layout
 * For backward compatibility with existing code
 */
export function calculateDAGLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSeparation?: number;
    nodeSeparation?: number;
    direction?: 'TB' | 'BT' | 'LR' | 'RL';
  } = {}
): LayoutResult {
  // For synchronous calls, use the manual TripGuardian layout or fallback
  // The async version should be preferred for ELK
  const directionMap: Record<string, 'DOWN' | 'UP' | 'LEFT' | 'RIGHT'> = {
    'TB': 'DOWN',
    'BT': 'UP',
    'LR': 'RIGHT',
    'RL': 'LEFT'
  };
  
  // Return fallback layout for sync calls
  // The async version (calculateDAGLayoutAsync) should be used for ELK
  return calculateFallbackLayout(
    nodeIds, 
    options.nodeWidth || 150, 
    options.nodeHeight || 60,
    options.rankSeparation || 150,
    options.nodeSeparation || 100
  );
}

/**
 * Fallback grid layout when ELK is not available or fails
 */
function calculateFallbackLayout(
  nodeIds: string[],
  nodeWidth: number = 150,
  nodeHeight: number = 60,
  rankSeparation: number = 150,
  nodeSeparation: number = 100
): LayoutResult {
  const positions: Record<string, { x: number; y: number }> = {};
  const levels: Record<string, number> = {};
  const columns = 3;
  
  nodeIds.forEach((id, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions[id] = {
      x: 100 + col * (nodeWidth + nodeSeparation),
      y: 100 + row * (nodeHeight + rankSeparation)
    };
    levels[id] = row;
  });
  
  return { positions, levels };
}

/**
 * Calculate layout with ELK and return edge paths for smooth routing
 */
export async function calculateDAGLayoutWithEdgesAsync(
  nodeIds: string[],
  edges: LayoutEdge[],
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSeparation?: number;
    nodeSeparation?: number;
  } = {}
): Promise<{
  positions: Record<string, { x: number; y: number }>;
  edgePaths: Array<{ id: string; source: string; target: string; sections?: any[] }>;
}> {
  const {
    nodeWidth = 150,
    nodeHeight = 60,
    rankSeparation = 100,
    nodeSeparation = 50
  } = options;

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(nodeSeparation),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(rankSeparation),
      'elk.spacing.edgeNode': '60',
      'elk.spacing.edgeEdge': '40',
      'elk.edgeRouting': 'SPLINES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
      'elk.layered.thoroughness': '100',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.mergeEdges': 'true'
    },
    children: nodeIds.map(id => ({
      id,
      width: nodeWidth,
      height: nodeHeight
    })),
    edges: edges
      .filter(edge => {
        const sourceId = edge.source.replace('agent-', '');
        const targetId = edge.target.replace('agent-', '');
        return nodeIds.includes(sourceId) && nodeIds.includes(targetId);
      })
      .map((edge, index) => ({
        id: `edge-${index}`,
        sources: [edge.source.replace('agent-', '')],
        targets: [edge.target.replace('agent-', '')]
      }))
  };

  const layoutedGraph = await elk.layout(graph);

  const positions: Record<string, { x: number; y: number }> = {};
  layoutedGraph.children?.forEach(node => {
    if (node.x !== undefined && node.y !== undefined) {
      positions[node.id] = { x: node.x, y: node.y };
    }
  });

  // Extract edge paths from ELK
  const edgePaths: Array<{ id: string; source: string; target: string; sections?: any[] }> = [];
  (layoutedGraph.edges as ElkExtendedEdge[])?.forEach(edge => {
    edgePaths.push({
      id: edge.id,
      source: edge.sources[0],
      target: edge.targets[0],
      sections: edge.sections
    });
  });

  return { positions, edgePaths };
}

/**
 * Backward compatibility wrapper
 */
export function calculateDAGLayoutWithEdges(
  nodeIds: string[],
  edges: LayoutEdge[],
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSeparation?: number;
    nodeSeparation?: number;
  } = {}
): {
  positions: Record<string, { x: number; y: number }>;
  edgePaths: Array<{ id: string; source: string; target: string; points: Array<{ x: number; y: number }> }>;
} {
  const result = calculateFallbackLayout(
    nodeIds,
    options.nodeWidth,
    options.nodeHeight,
    options.rankSeparation,
    options.nodeSeparation
  );
  
  return {
    positions: result.positions,
    edgePaths: []
  };
}

/**
 * Convenience function to get position for a specific node
 */
export function getNodePosition(
  nodeId: string,
  positions: Record<string, { x: number; y: number }>
): { x: number; y: number } {
  return positions[nodeId] || { x: 100, y: 100 };
}

/**
 * Calculate optimized layout for TripGuardianV3 workflow
 * Manually positioned to minimize edge crossings for this specific DAG structure
 */
export function calculateTripGuardianLayout(): Record<string, { x: number; y: number }> {
  const centerX = 400;
  const leftX = 100;
  const rightX = 700;
  const middleLeftX = 250;
  const middleRightX = 550;
  
  const levelSpacing = 180;
  const startY = 80;
  
  return {
    'getDate': { x: centerX, y: startY },
    'extractDetails': { x: middleLeftX, y: startY + levelSpacing },
    'extractCity': { x: middleRightX, y: startY + levelSpacing },
    'knowledgeCheck': { x: leftX, y: startY + levelSpacing * 2 },
    'checkWeather': { x: centerX, y: startY + levelSpacing * 2 },
    'fetchReviews': { x: rightX, y: startY + levelSpacing * 2 },
    'reviewSummarizer': { x: leftX, y: startY + levelSpacing * 3 },
    'newsAlert': { x: centerX, y: startY + levelSpacing * 3 },
    'geniusLoci': { x: rightX, y: startY + levelSpacing * 3 },
    'generateReport': { x: centerX, y: startY + levelSpacing * 4 },
  };
}

/**
 * Calculate layout using ELK for any template (async version)
 * This is the recommended function for new templates
 */
export async function calculateTemplateLayoutAsync(
  templateId: string,
  nodeIds: string[],
  edges: LayoutEdge[],
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSeparation?: number;
    nodeSeparation?: number;
  } = {}
): Promise<Record<string, { x: number; y: number }>> {
  // Use manual layout for TripGuardianV3
  if (templateId === 'trip-guardian-v3') {
    return calculateTripGuardianLayout();
  }
  
  // Use ELK for all other templates
  const result = await calculateDAGLayoutAsync(nodeIds, edges, {
    ...options,
    direction: 'DOWN'
  });
  
  return result.positions;
}
