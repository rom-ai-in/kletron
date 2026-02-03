'use client';

import React, { createContext, useContext, forwardRef } from 'react';
import { cn } from '@/src/lib/utils';

// =============================================================================
// RADIO COMPONENT
// =============================================================================

export type RadioSize = 'sm' | 'md' | 'lg';

const sizeStyles: Record<RadioSize, { outer: string; inner: string; label: string }> = {
    sm: {
        outer: 'w-4 h-4',
        inner: 'w-2 h-2',
        label: 'text-xs',
    },
    md: {
        outer: 'w-5 h-5',
        inner: 'w-2.5 h-2.5',
        label: 'text-sm',
    },
    lg: {
        outer: 'w-6 h-6',
        inner: 'w-3 h-3',
        label: 'text-base',
    },
};

// =============================================================================
// RADIO GROUP CONTEXT
// =============================================================================

interface RadioGroupContextValue {
    value: string | undefined;
    onChange: (value: string) => void;
    name: string;
    disabled?: boolean;
    size?: RadioSize;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

// =============================================================================
// RADIO GROUP
// =============================================================================

export interface RadioGroupProps {
    children: React.ReactNode;
    /** Unique name for the radio group */
    name: string;
    /** Controlled value */
    value?: string;
    /** Default value (uncontrolled) */
    defaultValue?: string;
    /** Change handler */
    onChange?: (value: string) => void;
    /** Disable all radios */
    disabled?: boolean;
    /** Size for all radios */
    size?: RadioSize;
    /** Layout direction */
    direction?: 'horizontal' | 'vertical';
    className?: string;
}

export function RadioGroup({
    children,
    name,
    value,
    defaultValue,
    onChange,
    disabled,
    size = 'md',
    direction = 'vertical',
    className,
}: RadioGroupProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value !== undefined ? value : internalValue;

    const handleChange = (newValue: string) => {
        if (value === undefined) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
    };

    return (
        <RadioGroupContext.Provider value={{ value: currentValue, onChange: handleChange, name, disabled, size }}>
            <div
                role="radiogroup"
                className={cn(
                    'flex gap-3',
                    direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
                    className
                )}
            >
                {children}
            </div>
        </RadioGroupContext.Provider>
    );
}

// =============================================================================
// RADIO ITEM
// =============================================================================

export interface RadioProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    /** Value for this radio */
    value: string;
    /** Label text */
    label?: string;
    /** Description text */
    description?: string;
    /** Size override */
    size?: RadioSize;
}

export const Radio = forwardRef<HTMLButtonElement, RadioProps>(
    ({ value, label, description, size: sizeProp, disabled: disabledProp, className, ...props }, ref) => {
        const context = useContext(RadioGroupContext);

        if (!context) {
            throw new Error('Radio must be used within RadioGroup');
        }

        const { value: groupValue, onChange, name, disabled: groupDisabled, size: groupSize } = context;
        const isChecked = groupValue === value;
        const disabled = disabledProp || groupDisabled;
        const size = sizeProp || groupSize || 'md';
        const styles = sizeStyles[size];

        const handleClick = () => {
            if (!disabled) {
                onChange(value);
            }
        };

        const radio = (
            <button
                ref={ref}
                type="button"
                role="radio"
                aria-checked={isChecked}
                name={name}
                disabled={disabled}
                onClick={handleClick}
                className={cn(
                    'relative inline-flex items-center justify-center shrink-0',
                    'rounded-full border-2 transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app',
                    styles.outer,
                    isChecked
                        ? 'border-emerald-500 focus:ring-emerald-500/50'
                        : 'border-border-strong hover:border-text-muted focus:ring-focus-ring',
                    disabled && 'opacity-50 cursor-not-allowed',
                    className
                )}
                {...props}
            >
                {isChecked && (
                    <span className={cn('rounded-full bg-emerald-500', styles.inner)} />
                )}
            </button>
        );

        if (!label) return radio;

        return (
            <label
                className={cn(
                    'flex items-start gap-3 cursor-pointer',
                    disabled && 'cursor-not-allowed opacity-50'
                )}
            >
                {radio}
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

Radio.displayName = 'Radio';
