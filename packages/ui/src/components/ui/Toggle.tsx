'use client';

import React, { forwardRef } from 'react';
import { cn } from '@numezis/server/lib/utils';

// =============================================================================
// TOGGLE / SWITCH COMPONENT
// =============================================================================

export type ToggleSize = 'sm' | 'md' | 'lg';

const sizeStyles: Record<ToggleSize, { track: string; thumb: string; translate: string }> = {
    sm: {
        track: 'w-8 h-4',
        thumb: 'w-3 h-3',
        translate: 'translate-x-4',
    },
    md: {
        track: 'w-10 h-5',
        thumb: 'w-4 h-4',
        translate: 'translate-x-5',
    },
    lg: {
        track: 'w-12 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-6',
    },
};

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    /** Controlled checked state */
    checked?: boolean;
    /** Default checked state (uncontrolled) */
    defaultChecked?: boolean;
    /** Change handler */
    onChange?: (checked: boolean) => void;
    /** Toggle size */
    size?: ToggleSize;
    /** Label text */
    label?: string;
    /** Description text */
    description?: string;
    /** Show label on the left */
    labelLeft?: boolean;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
    (
        {
            checked,
            defaultChecked = false,
            onChange,
            size = 'md',
            label,
            description,
            labelLeft = false,
            disabled,
            className,
            ...props
        },
        ref
    ) => {
        const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
        const isChecked = checked !== undefined ? checked : internalChecked;
        const styles = sizeStyles[size];

        const handleClick = () => {
            if (disabled) return;
            const newValue = !isChecked;
            if (checked === undefined) {
                setInternalChecked(newValue);
            }
            onChange?.(newValue);
        };

        const toggle = (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={isChecked}
                disabled={disabled}
                onClick={handleClick}
                className={cn(
                    'relative inline-flex shrink-0 rounded-full transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app',
                    styles.track,
                    isChecked
                        ? 'bg-emerald-500 focus:ring-emerald-500/50'
                        : 'bg-bg-elevated focus:ring-focus-ring',
                    disabled && 'opacity-50 cursor-not-allowed',
                    className
                )}
                {...props}
            >
                <span
                    className={cn(
                        'inline-block rounded-full bg-white shadow-sm transition-transform',
                        'translate-x-0.5',
                        styles.thumb,
                        isChecked && styles.translate
                    )}
                    style={{ marginTop: '2px' }}
                />
            </button>
        );

        if (!label) return toggle;

        return (
            <label
                className={cn(
                    'flex items-start gap-3 cursor-pointer',
                    labelLeft && 'flex-row-reverse justify-end',
                    disabled && 'cursor-not-allowed opacity-50'
                )}
            >
                {toggle}
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                    {description && (
                        <span className="text-xs text-text-muted mt-0.5">{description}</span>
                    )}
                </div>
            </label>
        );
    }
);

Toggle.displayName = 'Toggle';

// Alias
export const Switch = Toggle;
