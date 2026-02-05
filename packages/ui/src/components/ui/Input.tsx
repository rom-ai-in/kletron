'use client';

import React, { forwardRef } from 'react';
import { cn } from '@numezis/server/lib/utils';
import { Search, AlertCircle, Check, X, Eye, EyeOff, type LucideIcon } from 'lucide-react';

// =============================================================================
// INPUT COMPONENT
// =============================================================================

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'filled' | 'ghost';

const sizeStyles: Record<InputSize, string> = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base',
};

const iconSizes: Record<InputSize, string> = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
};

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    /** Input size */
    size?: InputSize;
    /** Visual variant */
    variant?: InputVariant;
    /** Error state */
    error?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Success state */
    success?: boolean;
    /** Left icon */
    leftIcon?: LucideIcon;
    /** Right icon */
    rightIcon?: LucideIcon;
    /** Show clear button when value is present */
    clearable?: boolean;
    /** Callback when clear button is clicked */
    onClear?: () => void;
    /** Full width */
    fullWidth?: boolean;
    /** Container className */
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            size = 'md',
            variant = 'default',
            error = false,
            errorMessage,
            success = false,
            leftIcon: LeftIcon,
            rightIcon: RightIcon,
            clearable = false,
            onClear,
            fullWidth = false,
            className,
            containerClassName,
            disabled,
            value,
            ...props
        },
        ref
    ) => {
        const hasValue = value !== undefined && value !== '';
        const showClear = clearable && hasValue && !disabled;
        const showRightIcon = RightIcon && !showClear;

        return (
            <div className={cn('relative', fullWidth && 'w-full', containerClassName)}>
                <div className="relative">
                    {LeftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <LeftIcon className={cn(iconSizes[size], 'text-text-muted')} />
                        </div>
                    )}

                    <input
                        ref={ref}
                        disabled={disabled}
                        value={value}
                        className={cn(
                            // Base styles
                            'w-full rounded-md font-normal transition-colors',
                            'placeholder:text-text-muted',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            'disabled:opacity-50 disabled:cursor-not-allowed',

                            // Size
                            sizeStyles[size],

                            // Variant styles
                            variant === 'default' && [
                                'bg-bg-surface border border-border-subtle',
                                'text-text-primary',
                                'hover:border-border-strong',
                                'focus:border-border-strong focus:ring-focus-ring/50',
                            ],
                            variant === 'filled' && [
                                'bg-bg-elevated border border-transparent',
                                'text-text-primary',
                                'hover:bg-state-hover',
                                'focus:bg-bg-surface focus:border-border-strong focus:ring-focus-ring/50',
                            ],
                            variant === 'ghost' && [
                                'bg-transparent border border-transparent',
                                'text-text-primary',
                                'hover:bg-state-hover',
                                'focus:bg-bg-surface focus:border-border-strong focus:ring-focus-ring/50',
                            ],

                            // States
                            error && 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20',
                            success && 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20',

                            // Icon padding
                            LeftIcon && 'pl-9',
                            (showRightIcon || showClear) && 'pr-9',

                            className
                        )}
                        {...props}
                    />

                    {showRightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <RightIcon className={cn(iconSizes[size], 'text-text-muted')} />
                        </div>
                    )}

                    {showClear && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-state-hover transition-colors"
                        >
                            <X className={cn(iconSizes[size], 'text-text-muted hover:text-text-secondary')} />
                        </button>
                    )}

                    {error && !showClear && !RightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <AlertCircle className={cn(iconSizes[size], 'text-rose-400')} />
                        </div>
                    )}

                    {success && !showClear && !RightIcon && !error && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Check className={cn(iconSizes[size], 'text-emerald-400')} />
                        </div>
                    )}
                </div>

                {errorMessage && (
                    <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

// =============================================================================
// SEARCH INPUT (Preset with search icon)
// =============================================================================

export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
    /** Placeholder text */
    placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    ({ placeholder = 'Search...', ...props }, ref) => {
        return (
            <Input
                ref={ref}
                type="search"
                leftIcon={Search}
                placeholder={placeholder}
                clearable
                {...props}
            />
        );
    }
);

SearchInput.displayName = 'SearchInput';

// =============================================================================
// PASSWORD INPUT (With show/hide toggle)
// =============================================================================

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> { }

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
    (props, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);

        return (
            <div className="relative">
                <Input
                    ref={ref}
                    type={showPassword ? 'text' : 'password'}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-state-hover transition-colors"
                >
                    {showPassword ? (
                        <EyeOff className="w-4 h-4 text-text-muted hover:text-text-secondary" />
                    ) : (
                        <Eye className="w-4 h-4 text-text-muted hover:text-text-secondary" />
                    )}
                </button>
            </div>
        );
    }
);

PasswordInput.displayName = 'PasswordInput';
