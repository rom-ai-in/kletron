'use client';

import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

export type TextareaSize = 'sm' | 'md' | 'lg';

const sizeStyles: Record<TextareaSize, string> = {
    sm: 'px-2.5 py-2 text-xs min-h-[80px]',
    md: 'px-3 py-2.5 text-sm min-h-[100px]',
    lg: 'px-4 py-3 text-base min-h-[120px]',
};

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
    /** Textarea size */
    size?: TextareaSize;
    /** Error state */
    error?: boolean;
    /** Error message */
    errorMessage?: string;
    /** Success state */
    success?: boolean;
    /** Hide resize handle */
    noResize?: boolean;
    /** Full width */
    fullWidth?: boolean;
    /** Max character count */
    maxLength?: number;
    /** Show character count */
    showCharCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        {
            size = 'md',
            error = false,
            errorMessage,
            success = false,
            noResize = false,
            fullWidth = true,
            maxLength,
            showCharCount = false,
            className,
            value,
            ...props
        },
        ref
    ) => {
        const charCount = typeof value === 'string' ? value.length : 0;

        return (
            <div className={cn('relative', fullWidth && 'w-full')}>
                <textarea
                    ref={ref}
                    value={value}
                    maxLength={maxLength}
                    className={cn(
                        // Base styles
                        'w-full rounded-md font-normal transition-colors',
                        'bg-bg-surface border border-border-subtle',
                        'text-text-primary',
                        'placeholder:text-text-muted',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0',
                        'focus:border-border-strong focus:ring-focus-ring/50',
                        'hover:border-border-strong',
                        'disabled:opacity-50 disabled:cursor-not-allowed',

                        // Size
                        sizeStyles[size],

                        // Resize
                        noResize ? 'resize-none' : 'resize-y',

                        // States
                        error && 'border-status-error-border focus:border-status-error-border focus:ring-status-error-border',
                        success && 'border-status-success-border focus:border-status-success-border focus:ring-status-success-border',

                        className
                    )}
                    {...props}
                />

                {(errorMessage || showCharCount) && (
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                        {errorMessage ? (
                            <p className="text-xs text-status-error-text">{errorMessage}</p>
                        ) : (
                            <span />
                        )}

                        {showCharCount && (
                            <span className={cn(
                                'text-[10px] tabular-nums',
                                maxLength && charCount >= maxLength ? 'text-status-error-text' : 'text-text-muted'
                            )}>
                                {charCount}{maxLength ? `/${maxLength}` : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';
