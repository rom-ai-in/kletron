'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { type LucideIcon } from 'lucide-react';

// =============================================================================
// CARD COMPONENT
// =============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Card variant */
    variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
    /** Padding size */
    padding?: 'none' | 'sm' | 'md' | 'lg';
    /** Interactive hover state */
    interactive?: boolean;
    /** Selected state */
    selected?: boolean;
}

const variantStyles = {
    default: 'bg-bg-surface border border-border-subtle',
    elevated: 'bg-bg-elevated border border-border-subtle shadow-md',
    outlined: 'bg-transparent border border-border-strong',
    ghost: 'bg-transparent border-none',
};

const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

export function Card({
    variant = 'default',
    padding = 'md',
    interactive = false,
    selected = false,
    className,
    children,
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'rounded-lg transition-all',
                variantStyles[variant],
                paddingStyles[padding],
                interactive && 'cursor-pointer hover:border-border-strong hover:bg-state-hover',
                selected && 'border-emerald-500/50 bg-emerald-500/5',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

// =============================================================================
// CARD HEADER
// =============================================================================

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Title */
    title?: string;
    /** Subtitle/description */
    subtitle?: string;
    /** Icon */
    icon?: LucideIcon;
    /** Icon color class */
    iconClassName?: string;
    /** Action element (button, etc) */
    action?: React.ReactNode;
}

export function CardHeader({
    title,
    subtitle,
    icon: Icon,
    iconClassName,
    action,
    className,
    children,
    ...props
}: CardHeaderProps) {
    if (children) {
        return (
            <div className={cn('flex items-start justify-between gap-4', className)} {...props}>
                {children}
            </div>
        );
    }

    return (
        <div className={cn('flex items-start justify-between gap-4', className)} {...props}>
            <div className="flex items-start gap-3">
                {Icon && (
                    <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        'bg-state-selected border border-border-subtle',
                        iconClassName
                    )}>
                        <Icon className="w-5 h-5 text-text-secondary" />
                    </div>
                )}
                <div>
                    {title && <h3 className="text-sm font-medium text-text-primary">{title}</h3>}
                    {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

// =============================================================================
// CARD CONTENT
// =============================================================================

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> { }

export function CardContent({ className, ...props }: CardContentProps) {
    return <div className={cn('text-sm text-text-secondary', className)} {...props} />;
}

// =============================================================================
// CARD FOOTER
// =============================================================================

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> { }

export function CardFooter({ className, ...props }: CardFooterProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border-subtle',
                className
            )}
            {...props}
        />
    );
}

// =============================================================================
// STAT CARD (Preset)
// =============================================================================

export interface StatCardProps {
    title: string;
    value: string | number;
    change?: {
        value: string;
        positive?: boolean;
    };
    icon?: LucideIcon;
    className?: string;
}

export function StatCard({ title, value, change, icon: Icon, className }: StatCardProps) {
    return (
        <Card className={className}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</span>
                {change && (
                    <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        change.positive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                    )}>
                        {change.value}
                    </span>
                )}
            </div>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-text-primary">{value}</span>
                {Icon && <Icon className="w-5 h-5 text-text-muted" />}
            </div>
        </Card>
    );
}

// =============================================================================
// FEATURE CARD (Preset)
// =============================================================================

export interface FeatureCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    iconColor?: string;
    action?: React.ReactNode;
    className?: string;
}

export function FeatureCard({
    title,
    description,
    icon: Icon,
    iconColor = 'text-emerald-400',
    action,
    className,
}: FeatureCardProps) {
    return (
        <Card interactive className={className}>
            <CardHeader
                icon={Icon}
                iconClassName={cn('bg-emerald-500/10 border-emerald-500/20', iconColor)}
                title={title}
                subtitle={description}
                action={action}
            />
        </Card>
    );
}
