'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';
export type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const sizeStyles: Record<ProgressSize, string> = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
};

const variantStyles: Record<ProgressVariant, string> = {
    default: 'bg-emerald-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    info: 'bg-emerald-500',
};

const trackStyles: Record<ProgressVariant, string> = {
    default: 'bg-bg-elevated',
    success: 'bg-emerald-500/20',
    warning: 'bg-amber-500/20',
    error: 'bg-rose-500/20',
    info: 'bg-emerald-500/20',
};

export interface ProgressBarProps {
    /** Current value (0-100) */
    value: number;
    /** Maximum value */
    max?: number;
    /** Size */
    size?: ProgressSize;
    /** Color variant */
    variant?: ProgressVariant;
    /** Show percentage label */
    showLabel?: boolean;
    /** Label position */
    labelPosition?: 'top' | 'right' | 'inside';
    /** Indeterminate loading state */
    indeterminate?: boolean;
    /** Animate value changes */
    animated?: boolean;
    className?: string;
}

export function ProgressBar({
    value,
    max = 100,
    size = 'md',
    variant = 'default',
    showLabel = false,
    labelPosition = 'right',
    indeterminate = false,
    animated = true,
    className,
}: ProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const label = `${Math.round(percentage)}%`;

    if (labelPosition === 'top' && showLabel) {
        return (
            <div className={cn('w-full', className)}>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">Progress</span>
                    <span className="text-xs font-medium text-text-primary">{label}</span>
                </div>
                <div className={cn('w-full rounded-full overflow-hidden', sizeStyles[size], trackStyles[variant])}>
                    <div
                        className={cn(
                            'h-full rounded-full',
                            variantStyles[variant],
                            animated && 'transition-all duration-500 ease-out',
                            indeterminate && 'animate-progress-loader'
                        )}
                        style={{ width: indeterminate ? '100%' : `${percentage}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex items-center gap-3 w-full', className)}>
            <div className={cn('flex-1 rounded-full overflow-hidden', sizeStyles[size], trackStyles[variant])}>
                <div
                    className={cn(
                        'h-full rounded-full',
                        variantStyles[variant],
                        animated && 'transition-all duration-500 ease-out',
                        indeterminate && 'animate-progress-loader'
                    )}
                    style={{ width: indeterminate ? '100%' : `${percentage}%` }}
                >
                    {labelPosition === 'inside' && showLabel && size === 'lg' && (
                        <span className="flex items-center justify-center h-full text-[10px] font-medium text-white">
                            {label}
                        </span>
                    )}
                </div>
            </div>
            {labelPosition === 'right' && showLabel && (
                <span className="text-xs font-medium text-text-primary tabular-nums w-10 text-right">
                    {label}
                </span>
            )}
        </div>
    );
}

// =============================================================================
// CIRCULAR PROGRESS
// =============================================================================

export interface CircularProgressProps {
    /** Current value (0-100) */
    value: number;
    /** Size in pixels */
    size?: number;
    /** Stroke width */
    strokeWidth?: number;
    /** Color variant */
    variant?: ProgressVariant;
    /** Show percentage label */
    showLabel?: boolean;
    /** Indeterminate loading state */
    indeterminate?: boolean;
    className?: string;
}

export function CircularProgress({
    value,
    size = 40,
    strokeWidth = 4,
    variant = 'default',
    showLabel = false,
    indeterminate = false,
    className,
}: CircularProgressProps) {
    const percentage = Math.min(100, Math.max(0, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const colorMap: Record<ProgressVariant, string> = {
        default: '#10b981',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#f43f5e',
        info: '#10b981',
    };

    return (
        <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
            <svg
                className={cn('transform -rotate-90', indeterminate && 'animate-spin')}
                width={size}
                height={size}
            >
                {/* Track */}
                <circle
                    className="text-bg-elevated"
                    stroke="currentColor"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Progress */}
                <circle
                    stroke={colorMap[variant]}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={indeterminate ? circumference * 0.75 : offset}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    className="transition-all duration-500 ease-out"
                />
            </svg>
            {showLabel && !indeterminate && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-text-primary">
                    {Math.round(percentage)}%
                </span>
            )}
        </div>
    );
}
