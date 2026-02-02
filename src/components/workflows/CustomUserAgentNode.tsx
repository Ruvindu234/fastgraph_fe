'use client';

import { User, Crown } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';

interface CustomUserAgentNodeProps {
  data: {
    label: string;
    role: string;
    capabilities?: string[];
    isCustom?: boolean;
  };
  selected?: boolean;
  id: string;
}

/**
 * CustomUserAgentNode - Matches project theme system
 * Features: Theme-aware, properly sized, consistent with project design
 */
export function CustomUserAgentNode({ data, selected, id }: CustomUserAgentNodeProps) {
  return (
    <div 
      className={`relative theme-card-bg rounded-lg border-2 transition-all theme-shadow cursor-pointer group ${
        selected 
          ? 'shadow-lg shadow-purple-500/30' 
          : 'hover:shadow-purple-400/20'
      }`}
      style={{
        padding: '8px 10px',
        minWidth: '110px',
        maxWidth: '130px',
        fontSize: '9px',
        borderColor: selected ? '#a855f7' : '#8b5cf6',
        boxShadow: selected 
          ? '0 0 0 1px rgba(168, 85, 247, 0.5), 0 10px 20px -5px rgba(168, 85, 247, 0.3)'
          : '0 0 0 1px rgba(139, 92, 246, 0.3)',
      }}
    >
      {/* Connection Handles - TOP/BOTTOM for hierarchical DAG layout */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#8b5cf6',
          width: 8,
          height: 8,
          border: '2px solid white',
          top: -4,
          boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)'
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#8b5cf6',
          width: 8,
          height: 8,
          border: '2px solid white',
          bottom: -4,
          boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)'
        }}
      />
      
      {/* Badge */}
      <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[6.5px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-0.5">
        <Crown className="w-2 h-2" strokeWidth={2.5} />
        <span>BULK AGENT</span>
      </div>
      
      {/* Compact agent content */}
      <div className="flex items-center space-x-2">
        <div className="p-1 rounded bg-purple-500/10 flex-shrink-0 border border-purple-500/20">
          <User className="w-3 h-3 text-purple-500 dark:text-purple-400" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="theme-text-primary font-semibold text-[9.5px] leading-tight truncate">
            {data.label}
          </div>
          <div className="theme-text-muted text-[8px] leading-tight truncate mt-0.5">
            {data.role}
          </div>
        </div>
      </div>
      
      {/* Status dot */}
      <div className="absolute top-4 right-2">
        <div className="relative">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
        </div>
      </div>
    </div>
  );
}

