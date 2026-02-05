'use client';

import React from 'react';
import { cn } from '@numezis/server/lib/utils';
import { Circle, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export type ToolUseStatus = 'running' | 'success' | 'error' | 'pending';

export interface ToolUseItem {
  id: string;
  name: string;
  detail?: string;
  meta?: string;
  status?: ToolUseStatus;
}

export interface ToolUsePanelProps {
  title?: string;
  items: ToolUseItem[];
  className?: string;
}

const statusIcon = (status?: ToolUseStatus) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin" />;
    case 'pending':
    default:
      return <Circle className="h-2.5 w-2.5 text-text-muted" />;
  }
};

export function ToolUsePanel({ title = 'Tool Use', items, className }: ToolUsePanelProps) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{title}</h3>
        <span className="text-[10px] text-text-muted">{items.length}</span>
      </div>
      <div className="space-y-2 p-3">
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-subtle bg-bg-elevated/40 p-3 text-center text-[11px] text-text-muted">
            No tool calls yet.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-2 py-2">
            <div className="mt-0.5">{statusIcon(item.status)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-text-primary truncate">{item.name}</span>
                {item.meta && <span className="text-[10px] text-text-muted">{item.meta}</span>}
              </div>
              {item.detail && (
                <p className="mt-1 text-[10px] text-text-muted truncate">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
