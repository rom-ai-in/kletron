'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface AgentStatusShimmerLabelProps {
    children: React.ReactNode;
    className?: string;
    /** When false, plain muted text (no sweep). */
    active?: boolean;
    /** Merged onto the readable base text layer (e.g. `text-status-success-text font-bold`). */
    textClassName?: string;
}

/**
 * Readable status text with a Cursor-like light sweep — avoids `bg-clip-text` /
 * `text-transparent`, which often renders invisible in WebKit.
 */
export function AgentStatusShimmerLabel({
    children,
    className,
    active = true,
    textClassName,
}: AgentStatusShimmerLabelProps) {
    if (!active) {
        return (
            <span className={cn('font-medium text-text-secondary', textClassName, className)}>{children}</span>
        );
    }

    return (
        <span className={cn('relative inline-block max-w-full align-baseline', className)}>
            {/* Base copy — always opaque so it stays readable */}
            <span className={cn('relative z-[1] font-medium text-text-muted', textClassName)}>{children}</span>
            {/* Sheen paints *above* text and blends — underlay was invisible behind opaque glyphs */}
            <span
                className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[4px] motion-reduce:hidden"
                aria-hidden
            >
                <span
                    className={cn(
                        'absolute left-0 top-0 h-full w-[min(90%,18rem)] -skew-x-14',
                        'bg-gradient-to-r from-transparent via-white/70 to-transparent',
                        'opacity-95 mix-blend-plus-lighter motion-safe:animate-activity-sheen',
                    )}
                />
            </span>
        </span>
    );
}
