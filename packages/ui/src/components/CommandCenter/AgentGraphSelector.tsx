'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, FileText, Code2, ChevronDown, Check } from 'lucide-react';

export interface AgentGraph {
  id: string;
  name: string;
  description?: string;
}

export interface AgentGraphSelectorProps {
  graphs: AgentGraph[];
  selectedGraphId?: string | null;
  onGraphSelect?: (graphId: string) => void;
  loading?: boolean;
  className?: string;
}

/** Map graph name to an icon */
function getGraphIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('ask') || lower.includes('chat') || lower.includes('question'))
    return <MessageSquare className="w-2.5 h-2.5" />;
  if (lower.includes('plan') || lower.includes('research') || lower.includes('analyze'))
    return <FileText className="w-2.5 h-2.5" />;
  if (lower.includes('coder') || lower.includes('code'))
    return <Code2 className="w-2.5 h-2.5" />;
  if (lower.includes('explore') || lower.includes('discover'))
    return <FileText className="w-2.5 h-2.5" />;
  return <Code2 className="w-2.5 h-2.5" />;
}

export function AgentGraphSelector({
  graphs,
  selectedGraphId,
  onGraphSelect,
  loading = false,
  className = '',
}: AgentGraphSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Position the portal dropdown above the trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.top, // dropdown bottom aligns to trigger top
      left: rect.right - 224, // w-56 = 224px, right-aligned
      width: 224,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [isOpen]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const selected = graphs.find((g) => g.id === selectedGraphId);
  const displayLabel = selected?.name ?? 'Graph';
  const shortLabel = displayLabel.length > 18 ? displayLabel.slice(0, 16) + '…' : displayLabel;

  if (loading) {
    return (
      <div className={`flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] text-text-muted animate-pulse ${className}`}>
        Loading…
      </div>
    );
  }

  if (graphs.length === 0) {
    return (
      <div className={`flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] text-text-muted ${className}`}>
        No graphs
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Compact trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
        title={selected?.description || selected?.name || 'Select agent graph'}
      >
        {selected ? getGraphIcon(selected.name) : <Code2 className="w-2.5 h-2.5" />}
        <span className="truncate max-w-[120px]">{shortLabel}</span>
        <ChevronDown className={`w-2.5 h-2.5 text-text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal dropdown — escapes any stacking context from backdrop-filter / overflow parents */}
      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] w-56 max-h-72 overflow-y-auto rounded-lg border border-border-strong bg-bg-surface shadow-2xl"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            transform: 'translateY(-100%) translateY(-4px)', // position above trigger with 4px gap
          }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-subtle">
            Agent Graphs
          </div>
          {graphs.map((graph) => {
            const isActive = graph.id === selectedGraphId;
            return (
              <button
                key={graph.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGraphSelect?.(graph.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary'
                }`}
              >
                <span className="flex-shrink-0 text-text-muted">
                  {getGraphIcon(graph.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{graph.name}</div>
                  {graph.description && (
                    <div className="text-[10px] text-text-muted truncate">{graph.description}</div>
                  )}
                </div>
                {isActive && (
                  <Check className="w-3 h-3 text-status-success-text flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
