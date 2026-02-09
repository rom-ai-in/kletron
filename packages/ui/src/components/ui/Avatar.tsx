'use client';

import React from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// AVATAR COMPONENT
// =============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeStyles: Record<AvatarSize, { container: string; text: string; icon: string }> = {
    xs: { container: 'w-6 h-6', text: 'text-[10px]', icon: 'w-3 h-3' },
    sm: { container: 'w-8 h-8', text: 'text-xs', icon: 'w-4 h-4' },
    md: { container: 'w-10 h-10', text: 'text-sm', icon: 'w-5 h-5' },
    lg: { container: 'w-12 h-12', text: 'text-base', icon: 'w-6 h-6' },
    xl: { container: 'w-16 h-16', text: 'text-lg', icon: 'w-8 h-8' },
};

// Gradient presets based on seed
const gradients = [
    'from-violet-500 to-pink-500',
    'from-sky-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-fuchsia-500 to-purple-500',
    'from-lime-500 to-green-500',
];

function getGradientFromSeed(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    if (email) {
        const local = email.split('@')[0];
        return local.substring(0, 2).toUpperCase();
    }
    return '??';
}

export interface AvatarProps {
    /** Image source */
    src?: string | null;
    /** Alt text for image */
    alt?: string;
    /** User name for initials fallback */
    name?: string | null;
    /** Email for initials fallback */
    email?: string | null;
    /** Size */
    size?: AvatarSize;
    /** Show status indicator */
    status?: 'online' | 'offline' | 'busy' | 'away';
    /** Square instead of rounded */
    square?: boolean;
    className?: string;
}

export function Avatar({
    src,
    alt,
    name,
    email,
    size = 'md',
    status,
    square = false,
    className,
}: AvatarProps) {
    const styles = sizeStyles[size];
    const seed = name || email || 'default';
    const gradient = getGradientFromSeed(seed);
    const initials = getInitials(name, email);

    const statusColors = {
        online: 'bg-status-success',
        offline: 'bg-text-muted',
        busy: 'bg-status-error',
        away: 'bg-status-warning',
    };

    const statusSizes: Record<AvatarSize, string> = {
        xs: 'w-1.5 h-1.5',
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3',
        xl: 'w-3.5 h-3.5',
    };

    return (
        <div className={cn('relative inline-flex shrink-0', className)}>
            {src ? (
                <img
                    src={src}
                    alt={alt || name || 'Avatar'}
                    className={cn(
                        'object-cover',
                        styles.container,
                        square ? 'rounded-md' : 'rounded-full'
                    )}
                />
            ) : (
                <div
                    className={cn(
                        'flex items-center justify-center font-medium text-white bg-gradient-to-br',
                        styles.container,
                        styles.text,
                        gradient,
                        square ? 'rounded-md' : 'rounded-full'
                    )}
                >
                    {initials}
                </div>
            )}

            {status && (
                <span
                    className={cn(
                        'absolute bottom-0 right-0 rounded-full ring-2 ring-bg-surface',
                        statusColors[status],
                        statusSizes[size]
                    )}
                />
            )}
        </div>
    );
}

// =============================================================================
// AVATAR GROUP
// =============================================================================

export interface AvatarGroupProps {
    children: React.ReactNode;
    /** Maximum avatars to show */
    max?: number;
    /** Size for all avatars */
    size?: AvatarSize;
    className?: string;
}

export function AvatarGroup({ children, max = 5, size = 'md', className }: AvatarGroupProps) {
    const childArray = React.Children.toArray(children);
    const displayChildren = max ? childArray.slice(0, max) : childArray;
    const remaining = childArray.length - displayChildren.length;
    const styles = sizeStyles[size];

    return (
        <div className={cn('flex -space-x-2', className)}>
            {displayChildren.map((child, index) => (
                <div key={index} className="ring-2 ring-bg-surface rounded-full">
                    {React.isValidElement(child)
                        ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
                        : child
                    }
                </div>
            ))}
            {remaining > 0 && (
                <div
                    className={cn(
                        'flex items-center justify-center font-medium text-text-secondary bg-bg-elevated ring-2 ring-bg-surface rounded-full',
                        styles.container,
                        styles.text
                    )}
                >
                    +{remaining}
                </div>
            )}
        </div>
    );
}
