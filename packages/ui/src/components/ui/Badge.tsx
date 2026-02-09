'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import {
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    Pause,
    AlertCircle,
    Loader2,
    type LucideIcon
} from 'lucide-react';

// =============================================================================
// CVA BADGE VARIANTS
// =============================================================================

const badgeVariants = cva(
    'inline-flex items-center font-bold tracking-wider border',
    {
        variants: {
            variant: {
                default: 'bg-text-muted/10 text-text-secondary border-border-subtle',
                outline: 'bg-transparent text-text-secondary border-border-strong',
                success: 'bg-status-success-bg text-status-success-text border-status-success-border',
                error: 'bg-status-error-bg text-status-error-text border-status-error-border',
                warning: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
                info: 'bg-status-info-bg text-status-info-text border-status-info-border',
                pending: 'bg-status-warning-bg text-status-warning-text border-status-warning-border',
                running: 'bg-status-success-bg text-status-success-text border-status-success-border',
                paused: 'bg-text-muted/10 text-text-secondary border-border-subtle',
                completed: 'bg-status-success-bg text-status-success-text border-status-success-border',
                failed: 'bg-status-error-bg text-status-error-text border-status-error-border',
            },
            size: {
                xs: 'px-1.5 py-0.5 text-[9px] gap-1',
                sm: 'px-2 py-0.5 text-[10px] gap-1',
                md: 'px-2.5 py-1 text-xs gap-1.5',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'sm',
        },
    }
);

export { badgeVariants };

export type BadgeVariant =
    | 'default'
    | 'outline'
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'pending'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed';

export type BadgeSize = 'xs' | 'sm' | 'md';

const variantIcons: Record<BadgeVariant, LucideIcon | null> = {
    default: null,
    outline: null,
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: AlertCircle,
    pending: Clock,
    running: Play,
    paused: Pause,
    completed: CheckCircle2,
    failed: XCircle,
};

const iconSizes: Record<BadgeSize, string> = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
};

// =============================================================================
// BADGE COMPONENT
// =============================================================================

export interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    /** Show variant-specific icon */
    showIcon?: boolean;
    /** Custom icon override */
    icon?: LucideIcon;
    /** Show spinning animation (for running states) */
    spinning?: boolean;
    /** Make badge a pill (fully rounded) */
    pill?: boolean;
    /** Uppercase text */
    uppercase?: boolean;
    className?: string;
}

export function Badge({
    children,
    variant = 'default',
    size = 'sm',
    showIcon = false,
    icon: CustomIcon,
    spinning = false,
    pill = false,
    uppercase = true,
    className,
}: BadgeProps) {
    const Icon = CustomIcon || (showIcon ? variantIcons[variant] : null);
    const shouldSpin = spinning || variant === 'running';

    return (
        <span
            className={cn(
                badgeVariants({ variant, size }),
                pill ? 'rounded-full' : 'rounded-md',
                uppercase && 'uppercase',
                className
            )}
        >
            {Icon && (
                <Icon
                    className={cn(
                        iconSizes[size],
                        shouldSpin && 'animate-spin'
                    )}
                />
            )}
            {children}
        </span>
    );
}

// =============================================================================
// STATUS BADGE (Semantic wrapper)
// =============================================================================

export type StatusType = 'completed' | 'running' | 'paused' | 'failed' | 'pending' | 'idle';

const statusToVariant: Record<StatusType, BadgeVariant> = {
    completed: 'completed',
    running: 'running',
    paused: 'paused',
    failed: 'failed',
    pending: 'pending',
    idle: 'default',
};

const statusLabels: Record<StatusType, string> = {
    completed: 'Completed',
    running: 'Running',
    paused: 'Paused',
    failed: 'Failed',
    pending: 'Pending',
    idle: 'Idle',
};

export interface StatusBadgeProps {
    status: StatusType;
    size?: BadgeSize;
    /** Override the label */
    label?: string;
    className?: string;
}

export function StatusBadge({ status, size = 'sm', label, className }: StatusBadgeProps) {
    return (
        <Badge
            variant={statusToVariant[status]}
            size={size}
            showIcon
            spinning={status === 'running'}
            className={className}
        >
            {label || statusLabels[status]}
        </Badge>
    );
}

// =============================================================================
// LOADING BADGE
// =============================================================================

export function LoadingBadge({ className }: { className?: string }) {
    return (
        <Badge variant="info" size="sm" className={className}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading
        </Badge>
    );
}
