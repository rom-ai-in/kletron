'use client';

import React from 'react';
import { X, Pin } from 'lucide-react';
import type { ThreadLiveStatus } from '@kletron/shared/chatTypes';

export type TabLiveStatus = ThreadLiveStatus;

export interface ConversationTabItem {
  id: string;
  title: string;
  isPinned?: boolean;
  liveStatus?: TabLiveStatus;
}

export interface ConversationTabsProps {
  tabs: ConversationTabItem[];
  activeTabId?: string | null;
  onTabSelect?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabPin?: (tabId: string) => void;
  className?: string;
}

function TabStatusDot({ status }: { status?: TabLiveStatus }) {
  if (!status || status === 'idle') return null;
  const styles: Record<string, string> = {
    running: 'h-2.5 w-2.5 bg-status-success shadow-[0_0_0_2px_var(--status-success-bg)] animate-pulse',
    completed: 'h-2 w-2 bg-status-success/60',
    completed_unread: 'h-2.5 w-2.5 bg-status-info ring-2 ring-status-info/55 shadow-[0_0_0_2px_var(--status-info-bg)]',
    waiting: 'h-2 w-2 bg-status-warning ring-1 ring-status-warning/50',
    error: 'h-2.5 w-2.5 bg-status-error shadow-[0_0_0_2px_var(--status-error-bg)] ring-2 ring-status-error/50',
  };
  return <span className={`rounded-full flex-shrink-0 ${styles[status] ?? ''}`} />;
}

export function ConversationTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabPin,
  className = '',
}: ConversationTabsProps) {
  if (tabs.length === 0) return null;

  // Sort: pinned first, then by order
  const sorted = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return (
    <div className={`flex items-stretch glass-titlebar overflow-x-auto scrollbar-elegant ${className}`}>
      {sorted.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-border-subtle transition-colors min-w-0 max-w-[200px] ${
              isActive
                ? 'bg-bg-app text-text-primary border-b-2 border-b-blue-500'
                : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
            }`}
            onClick={() => onTabSelect?.(tab.id)}
            onDoubleClick={() => onTabPin?.(tab.id)}
          >
            {tab.isPinned && <Pin className="h-2.5 w-2.5 text-text-muted flex-shrink-0 rotate-45" />}
            <TabStatusDot status={tab.liveStatus} />
            <span className="truncate">{tab.title || 'Untitled'}</span>
            {!tab.isPinned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose?.(tab.id);
                }}
                className="ml-auto p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary hover:bg-state-hover transition-all flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
