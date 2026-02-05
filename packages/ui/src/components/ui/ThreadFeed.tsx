'use client';

import React from 'react';
import { cn } from '@numezis/server/lib/utils';
import { Clock } from 'lucide-react';

export type ThreadStatus = 'active' | 'waiting' | 'idle' | 'archived';

export interface ThreadItem {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  status?: ThreadStatus;
  badge?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface ThreadFeedProps {
  title?: string;
  items: ThreadItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
  maxVisible?: number;
  showCount?: boolean;
  showTitle?: boolean;
  className?: string;
}

const statusDot: Record<ThreadStatus, string> = {
  active: 'bg-emerald-400',
  waiting: 'bg-amber-400',
  idle: 'bg-zinc-500',
  archived: 'bg-zinc-600',
};

export function ThreadFeed({
  title = 'Threads',
  items,
  activeId,
  onSelect,
  headerAction,
  footer,
  emptyState,
  maxVisible,
  showCount = true,
  showTitle = true,
  className,
}: ThreadFeedProps) {
  const visibleItems = maxVisible ? items.slice(0, maxVisible) : items;
  const remaining = maxVisible ? Math.max(items.length - visibleItems.length, 0) : 0;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          {showTitle && title ? (
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{title}</h3>
          ) : null}
          {showCount && <span className="text-[10px] text-text-muted">{items.length}</span>}
        </div>
        {headerAction}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-elegant">
        {visibleItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-subtle bg-bg-elevated/40 p-4 text-center text-[11px] text-text-muted">
            {emptyState ?? 'No threads yet.'}
          </div>
        )}

        <div className="space-y-1.5">
          {visibleItems.map((item) => {
            const isActive = item.id === activeId;
            const isPlainTitle = typeof item.title === 'string' || typeof item.title === 'number';

            const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(item.id);
              }
            };

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(item.id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'group w-full rounded-lg border px-3 py-2 text-left transition',
                  isActive
                    ? 'border-border-strong bg-state-selected'
                    : 'border-border-subtle bg-bg-surface hover:bg-state-hover'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {item.leading && <div className="shrink-0">{item.leading}</div>}
                    {item.status && (
                      <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[item.status])} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[12px] font-semibold text-text-primary">
                          {isPlainTitle ? <span className="truncate">{item.title}</span> : item.title}
                        </div>
                        {item.badge && (
                          <span className="rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[9px] font-semibold text-text-muted">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="mt-0.5 text-[10px] text-text-muted truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.meta && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock className="h-3 w-3" />
                        {item.meta}
                      </span>
                    )}
                    {item.actions}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {remaining > 0 && (
          <div className="mt-3 text-center text-[10px] text-text-muted">
            +{remaining} more threads
          </div>
        )}
      </div>

      {footer && (
        <div className="border-t border-border-subtle px-3 py-2 text-[10px] text-text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
