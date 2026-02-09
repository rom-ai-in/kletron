'use client';

import React from 'react';
import { ClipboardCheck, FileText, Clock, ArrowRight } from 'lucide-react';

export interface ReviewQueueItem {
  threadId: string;
  threadTitle: string;
  projectName?: string;
  pendingDiffCount: number;
  completedAt?: string;
}

export interface ReviewQueueProps {
  items: ReviewQueueItem[];
  onItemClick?: (threadId: string) => void;
  className?: string;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ReviewQueue({
  items,
  onItemClick,
  className = '',
}: ReviewQueueProps) {
  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-center ${className}`}>
        <ClipboardCheck className="h-6 w-6 mb-2 text-text-muted opacity-30" />
        <span className="text-xs text-text-muted">No tasks awaiting review</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary">
        <ClipboardCheck className="h-3.5 w-3.5 text-status-warning-text" />
        <span>Review Queue</span>
        <span className="ml-auto rounded-full bg-status-warning-bg text-status-warning-text px-1.5 py-0.5 text-[10px] font-semibold">
          {items.length}
        </span>
      </div>
      {items.map((item) => (
        <button
          key={item.threadId}
          type="button"
          onClick={() => onItemClick?.(item.threadId)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-state-hover hover:text-text-primary transition-colors rounded-md mx-1"
        >
          <FileText className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{item.threadTitle}</div>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              {item.projectName && <span>{item.projectName}</span>}
              <span>{item.pendingDiffCount} change(s)</span>
              {item.completedAt && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{formatRelativeTime(item.completedAt)}</span>
                </>
              )}
            </div>
          </div>
          <ArrowRight className="h-3 w-3 text-text-muted flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
