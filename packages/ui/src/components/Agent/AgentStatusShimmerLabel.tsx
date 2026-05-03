'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface AgentStatusShimmerLabelProps {
    children: React.ReactNode;
    className?: string;
    /** When false, plain muted text (no sweep). */
    active?: boolean;
    /** Base tone for gradient endpoints (highlight uses `--text-primary`). */
    tone?: 'muted' | 'secondary';
    /** Extra typography (e.g. `font-semibold`). Avoid `text-*` color utilities; use `tone` instead. */
    textClassName?: string;
}

const TONE_VAR: Record<NonNullable<AgentStatusShimmerLabelProps['tone']>, string> = {
    muted: 'var(--text-muted)',
    secondary: 'var(--text-secondary)',
};

/**
 * Status label with a soft highlight through the letterforms only (`background-clip: text`).
 * A solid underlay keeps the label readable if the clipped layer fails; reduced motion hides the overlay.
 */
export function AgentStatusShimmerLabel({
    children,
    className,
    active = true,
    tone = 'muted',
    textClassName,
}: AgentStatusShimmerLabelProps) {
    if (!active) {
        return (
            <span className={cn('font-medium text-text-secondary', textClassName, className)}>{children}</span>
        );
    }

    const toneStyle = { ['--shimmer-base' as string]: TONE_VAR[tone] };

    const bodyTypography = cn('font-medium', textClassName);

    return (
        <span
            className={cn(
                'inline-grid max-w-full min-w-0 align-baseline [&>*]:col-start-1 [&>*]:row-start-1',
                className,
            )}
            style={toneStyle}
        >
            <span className={cn('min-w-0 text-[color:var(--shimmer-base)]', bodyTypography)}>{children}</span>
            <span
                aria-hidden
                className={cn(
                    'min-w-0',
                    'bg-clip-text [-webkit-background-clip:text] text-transparent [-webkit-text-fill-color:transparent]',
                    'bg-no-repeat motion-safe:animate-text-shimmer',
                    'bg-[length:220%_100%]',
                    // Narrow bright band so glyphs stay near base luminance between peaks
                    'bg-[linear-gradient(90deg,var(--shimmer-base)_0%,var(--shimmer-base)_40%,var(--text-primary)_50%,var(--shimmer-base)_60%,var(--shimmer-base)_100%)]',
                    'motion-reduce:hidden',
                    bodyTypography,
                )}
            >
                {children}
            </span>
        </span>
    );
}
