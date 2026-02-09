'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox, Search, FileQuestion, AlertTriangle, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

export type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-data';

export interface EmptyStateProps {
    /** Pre-built variant */
    variant?: EmptyStateVariant;
    /** Custom icon - can be a LucideIcon component or a ReactNode */
    icon?: LucideIcon | React.ReactNode;
    /** Title text */
    title?: string;
    /** Description text */
    description?: string;
    /** Primary action */
    action?: {
        label: string;
        onClick: () => void;
    };
    /** Secondary action */
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    /** Size */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    children?: React.ReactNode;
}

const variantConfig: Record<EmptyStateVariant, { icon: LucideIcon; title: string; description: string }> = {
    default: {
        icon: Inbox,
        title: 'No items yet',
        description: 'Get started by creating your first item.',
    },
    search: {
        icon: Search,
        title: 'No results found',
        description: 'Try adjusting your search or filter criteria.',
    },
    error: {
        icon: AlertTriangle,
        title: 'Something went wrong',
        description: 'We encountered an error. Please try again.',
    },
    'no-data': {
        icon: FileQuestion,
        title: 'No data available',
        description: 'There is no data to display at this time.',
    },
};

const sizeStyles = {
    sm: {
        icon: 'w-8 h-8',
        iconContainer: 'w-14 h-14',
        title: 'text-sm',
        description: 'text-xs',
        padding: 'py-6',
    },
    md: {
        icon: 'w-10 h-10',
        iconContainer: 'w-16 h-16',
        title: 'text-base',
        description: 'text-sm',
        padding: 'py-10',
    },
    lg: {
        icon: 'w-12 h-12',
        iconContainer: 'w-20 h-20',
        title: 'text-lg',
        description: 'text-sm',
        padding: 'py-16',
    },
};

export function EmptyState({
    variant = 'default',
    icon: CustomIcon,
    title,
    description,
    action,
    secondaryAction,
    size = 'md',
    className,
    children,
}: EmptyStateProps) {
    const config = variantConfig[variant];
    const displayTitle = title || config.title;
    const displayDescription = description || config.description;
    const styles = sizeStyles[size];

    // Render icon - either custom ReactNode, LucideIcon, or default variant icon
    const renderIcon = () => {
        if (CustomIcon) {
            // Check if it's a React element (ReactNode) or a LucideIcon component
            if (React.isValidElement(CustomIcon)) {
                return CustomIcon;
            }
            // It's a LucideIcon component
            const IconComponent = CustomIcon as LucideIcon;
            return <IconComponent className={cn(styles.icon, 'text-text-muted')} />;
        }
        const DefaultIcon = config.icon;
        return <DefaultIcon className={cn(styles.icon, 'text-text-muted')} />;
    };

    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center',
            styles.padding,
            className
        )}>
            <div className={cn(
                'rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4',
                styles.iconContainer
            )}>
                {renderIcon()}
            </div>

            <h3 className={cn('font-medium text-text-primary', styles.title)}>
                {displayTitle}
            </h3>

            <p className={cn('text-text-muted mt-1 max-w-sm', styles.description)}>
                {displayDescription}
            </p>

            {children}

            {(action || secondaryAction) && (
                <div className="flex items-center gap-3 mt-6">
                    {action && (
                        <Button onClick={action.onClick} size={size === 'sm' ? 'sm' : 'md'}>
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="ghost"
                            onClick={secondaryAction.onClick}
                            size={size === 'sm' ? 'sm' : 'md'}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// LOADING STATE
// =============================================================================

export interface LoadingStateProps {
    /** Loading message */
    message?: string;
    /** Size */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LoadingState({ message = 'Loading...', size = 'md', className }: LoadingStateProps) {
    const styles = sizeStyles[size];

    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center',
            styles.padding,
            className
        )}>
            <div className={cn(
                'rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4',
                styles.iconContainer
            )}>
                <div className={cn(
                    'border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin',
                    size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
                )} />
            </div>
            <p className={cn('text-text-muted', styles.description)}>{message}</p>
        </div>
    );
}

// =============================================================================
// ERROR STATE
// =============================================================================

export interface ErrorStateProps {
    /** Error title */
    title?: string;
    /** Error message */
    message?: string;
    /** Retry action */
    onRetry?: () => void;
    /** Size */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    message = 'We encountered an error loading this content.',
    onRetry,
    size = 'md',
    className,
}: ErrorStateProps) {
    return (
        <EmptyState
            variant="error"
            title={title}
            description={message}
            action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
            size={size}
            className={className}
        />
    );
}
