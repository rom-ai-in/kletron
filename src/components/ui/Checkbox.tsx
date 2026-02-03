'use client';

import React, { forwardRef, createContext, useContext } from 'react';
import { cn } from '@/src/lib/utils';
import { Check, Minus } from 'lucide-react';

// =============================================================================
// CHECKBOX COMPONENT
// =============================================================================

export type CheckboxSize = 'sm' | 'md' | 'lg';

const sizeStyles: Record<CheckboxSize, { box: string; icon: string; label: string }> = {
    sm: {
        box: 'w-4 h-4',
        icon: 'w-3 h-3',
        label: 'text-xs',
    },
    md: {
        box: 'w-5 h-5',
        icon: 'w-3.5 h-3.5',
        label: 'text-sm',
    },
    lg: {
        box: 'w-6 h-6',
        icon: 'w-4 h-4',
        label: 'text-base',
    },
};

export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    /** Controlled checked state */
    checked?: boolean;
    /** Default checked state (uncontrolled) */
    defaultChecked?: boolean;
    /** Indeterminate state */
    indeterminate?: boolean;
    /** Change handler */
    onChange?: (checked: boolean) => void;
    /** Checkbox size */
    size?: CheckboxSize;
    /** Label text */
    label?: string;
    /** Description text */
    description?: string;
    /** Error state */
    error?: boolean;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
    (
        {
            checked,
            defaultChecked = false,
            indeterminate = false,
            onChange,
            size = 'md',
            label,
            description,
            error = false,
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

        const checkbox = (
            <button
                ref={ref}
                type="button"
                role="checkbox"
                aria-checked={indeterminate ? 'mixed' : isChecked}
                disabled={disabled}
                onClick={handleClick}
                className={cn(
                    'relative inline-flex items-center justify-center shrink-0',
                    'rounded border-2 transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app',
                    styles.box,
                    isChecked || indeterminate
                        ? 'bg-emerald-500 border-emerald-500 focus:ring-emerald-500/50'
                        : 'bg-transparent border-border-strong hover:border-text-muted focus:ring-focus-ring',
                    error && !isChecked && 'border-rose-500',
                    disabled && 'opacity-50 cursor-not-allowed',
                    className
                )}
                {...props}
            >
                {(isChecked || indeterminate) && (
                    indeterminate ? (
                        <Minus className={cn(styles.icon, 'text-white')} strokeWidth={3} />
                    ) : (
                        <Check className={cn(styles.icon, 'text-white')} strokeWidth={3} />
                    )
                )}
            </button>
        );

        if (!label) return checkbox;

        return (
            <label
                className={cn(
                    'flex items-start gap-3 cursor-pointer',
                    disabled && 'cursor-not-allowed opacity-50'
                )}
            >
                {checkbox}
                <div className="flex flex-col">
                    <span className={cn('font-medium text-text-primary', styles.label)}>{label}</span>
                    {description && (
                        <span className="text-xs text-text-muted mt-0.5">{description}</span>
                    )}
                </div>
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';

// =============================================================================
// CHECKBOX GROUP
// =============================================================================

interface CheckboxGroupContextValue {
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
    size?: CheckboxSize;
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export interface CheckboxGroupProps {
    children: React.ReactNode;
    /** Controlled value */
    value?: string[];
    /** Default value (uncontrolled) */
    defaultValue?: string[];
    /** Change handler */
    onChange?: (value: string[]) => void;
    /** Disable all checkboxes */
    disabled?: boolean;
    /** Size for all checkboxes */
    size?: CheckboxSize;
    /** Layout direction */
    direction?: 'horizontal' | 'vertical';
    className?: string;
}

export function CheckboxGroup({
    children,
    value,
    defaultValue = [],
    onChange,
    disabled,
    size,
    direction = 'vertical',
    className,
}: CheckboxGroupProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value !== undefined ? value : internalValue;

    const handleChange = (newValue: string[]) => {
        if (value === undefined) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
    };

    return (
        <CheckboxGroupContext.Provider value={{ value: currentValue, onChange: handleChange, disabled, size }}>
            <div
                className={cn(
                    'flex gap-3',
                    direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
                    className
                )}
            >
                {children}
            </div>
        </CheckboxGroupContext.Provider>
    );
}

// =============================================================================
// CHECKBOX GROUP ITEM
// =============================================================================

export interface CheckboxGroupItemProps extends Omit<CheckboxProps, 'checked' | 'onChange'> {
    /** Unique value for this item */
    value: string;
}

export function CheckboxGroupItem({ value, ...props }: CheckboxGroupItemProps) {
    const context = useContext(CheckboxGroupContext);

    if (!context) {
        throw new Error('CheckboxGroupItem must be used within CheckboxGroup');
    }

    const isChecked = context.value.includes(value);

    const handleChange = (checked: boolean) => {
        if (checked) {
            context.onChange([...context.value, value]);
        } else {
            context.onChange(context.value.filter(v => v !== value));
        }
    };

    return (
        <Checkbox
            checked={isChecked}
            onChange={handleChange}
            disabled={context.disabled || props.disabled}
            size={context.size || props.size}
            {...props}
        />
    );
}
