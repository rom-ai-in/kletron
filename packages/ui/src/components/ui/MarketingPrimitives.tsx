'use client';

import React from 'react';
import { cn } from '../../lib/utils';

/** Max-width content column — use on every marketing section */
export const marketingContainer = 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';

export const MarketingEyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div
        className={cn(
            'inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-bg-surface/80 px-3 py-1.5 text-[11px] sm:text-xs font-medium text-text-secondary backdrop-blur-sm',
            className,
        )}
    >
        {children}
    </div>
);

export const MarketingHeroTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <h1 className={cn('text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-text-primary leading-[1.1]', className)}>
        {children}
    </h1>
);

export const MarketingLead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <p className={cn('text-base sm:text-lg text-text-muted max-w-2xl leading-relaxed', className)}>{children}</p>
);

export const MarketingSectionTitle: React.FC<{
    children: React.ReactNode;
    subtitle?: React.ReactNode;
    className?: string;
    /** `start` aligns with left-column marketing layouts; `center` for centered heroes and editorial sections. */
    align?: 'center' | 'start';
}> = ({ children, subtitle, className, align = 'center' }) => (
    <div className={cn('mb-10 sm:mb-14', align === 'center' ? 'text-center' : 'text-left', className)}>
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl md:text-3xl">{children}</h2>
        {subtitle ? (
            <div
                className={cn(
                    'text-sm leading-relaxed text-text-muted',
                    align === 'center' ? 'mx-auto max-w-lg' : 'max-w-2xl',
                )}
            >
                {subtitle}
            </div>
        ) : null}
    </div>
);

/** Primary CTA — Kletron accent */
export const marketingBtnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--kletron-accent)] px-5 py-3 text-sm font-medium text-white shadow-lg shadow-[color:var(--kletron-accent)]/25 transition hover:bg-[color:var(--kletron-accent-hover)] hover:shadow-[color:var(--kletron-accent)]/35 active:scale-[0.98]';

/** Secondary outline */
export const marketingBtnSecondary =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-bg-surface/60 px-5 py-3 text-sm font-medium text-text-primary backdrop-blur-sm transition hover:bg-bg-elevated hover:border-white/[0.14] active:scale-[0.98]';

/** Ghost / minimal */
export const marketingBtnGhost =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:text-text-primary hover:bg-white/[0.04]';

/** Compact — nav bar */
export const marketingNavBtnPrimary =
    'inline-flex items-center justify-center rounded-xl bg-[color:var(--kletron-accent)] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-md shadow-[color:var(--kletron-accent)]/25 transition hover:bg-[color:var(--kletron-accent-hover)] active:scale-[0.98]';

export const marketingNavBtnGhost =
    'inline-flex items-center justify-center rounded-xl px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-text-muted transition hover:text-text-primary hover:bg-white/[0.05]';

/** Feature / content card */
export const MarketingCard: React.FC<{
    children: React.ReactNode;
    className?: string;
    featured?: boolean;
}> = ({ children, className, featured }) => (
    <div
        className={cn(
            'group rounded-2xl border border-white/[0.06] bg-bg-surface/40 p-5 sm:p-6 backdrop-blur-sm transition duration-300',
            'hover:border-white/[0.1] hover:bg-bg-surface/70 hover:shadow-xl hover:shadow-black/20',
            featured && 'border-[color:var(--kletron-accent)]/35 bg-gradient-to-b from-[color:var(--kletron-accent)]/[0.06] to-transparent ring-1 ring-[color:var(--kletron-accent)]/20',
            className,
        )}
    >
        {children}
    </div>
);

/** Icon chip inside cards */
export const MarketingIconCircle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div
        className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-bg-elevated/80 text-text-secondary transition group-hover:border-[color:var(--kletron-accent)]/30 group-hover:text-[color:var(--kletron-accent)]',
            className,
        )}
    >
        {children}
    </div>
);
