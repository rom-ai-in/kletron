'use client';

import { cn } from '../../lib/utils';

export interface ConversationThreadSkeletonProps {
  className?: string;
}

/**
 * Placeholder layout while a thread is hydrating — matches chat column width and typical message shapes.
 */
export function ConversationThreadSkeleton({ className }: ConversationThreadSkeletonProps) {
  return (
    <div
      className={cn('space-y-6 animate-pulse px-2 py-6', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading conversation"
    >
      <div className="flex justify-end">
        <div className="h-9 w-[58%] max-w-md rounded-xl bg-bg-elevated" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-4/5 max-w-2xl rounded bg-bg-elevated" />
        <div className="h-3.5 w-3/4 max-w-xl rounded bg-bg-elevated" />
        <div className="h-3.5 w-2/3 max-w-lg rounded bg-bg-elevated" />
      </div>
      <div className="h-14 w-full max-w-2xl rounded-lg bg-bg-elevated/90" />
      <div className="space-y-2">
        <div className="h-3.5 w-[85%] max-w-2xl rounded bg-bg-elevated" />
        <div className="h-3.5 w-3/5 max-w-lg rounded bg-bg-elevated" />
      </div>
    </div>
  );
}
