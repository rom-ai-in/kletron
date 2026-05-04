'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ThreadSearchHeaderTriggerProps {
  onClick: () => void;
  /** Context label (e.g. workspace display name); falls back to generic copy. */
  placeholder: string;
  disabled?: boolean;
  /** Shorter bar for desktop title strip; web header keeps default. */
  density?: 'default' | 'compact';
  className?: string;
}

/**
 * Title-bar search control: horizontal rounded field, slightly elevated surface,
 * thin border — icon + label grouped and centered (matches unified search chrome).
 */
export function ThreadSearchHeaderTrigger({
  onClick,
  placeholder,
  disabled = false,
  density = 'default',
  className,
}: ThreadSearchHeaderTriggerProps) {
  const label = placeholder.trim() || 'Search threads…';
  const compact = density === 'compact';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Search threads"
      aria-label={`Search threads — ${label}`}
      className={cn(
        'flex w-full min-w-[140px] max-w-[min(100%,42rem)] shrink-0 items-center justify-center border transition-colors duration-150',
        /* compact = desktop title bar: 10% shorter than h-7 (28px → ~25px) */
        compact ? 'h-[1.575rem] rounded-md px-2.5' : 'h-8 rounded-lg px-3',
        'border-white/[0.12] bg-white/[0.06]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/12 focus-visible:ring-offset-0',
        disabled
          ? 'cursor-not-allowed opacity-45'
          : 'hover:border-white/[0.16] hover:bg-white/[0.08] active:bg-white/[0.07]',
        className,
      )}
    >
      <span className={cn('flex min-w-0 max-w-full items-center justify-center', compact ? 'gap-1.5' : 'gap-2')}>
        <Search
          className={cn('shrink-0 text-text-muted', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')}
          strokeWidth={2}
          aria-hidden
        />
        <span
          className={cn(
            'min-w-0 truncate font-normal leading-tight text-text-muted',
            compact ? 'text-[12px]' : 'text-[13px]',
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}
