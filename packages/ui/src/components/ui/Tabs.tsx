'use client';

import React, { createContext, useContext, useState } from 'react';
import { cn } from '@numezis/server/lib/utils';

// =============================================================================
// TABS CONTEXT
// =============================================================================

interface TabsContextValue {
    activeTab: string;
    setActiveTab: (id: string) => void;
    variant: TabsVariant;
}

const TabsContext = createContext<TabsContextValue | null>(null);

// =============================================================================
// TABS COMPONENT
// =============================================================================

export type TabsVariant = 'default' | 'pills' | 'underline' | 'segment';

export interface TabsProps {
    children: React.ReactNode;
    /** Default active tab */
    defaultValue: string;
    /** Controlled value */
    value?: string;
    /** Change handler */
    onValueChange?: (value: string) => void;
    /** Visual variant */
    variant?: TabsVariant;
    className?: string;
}

export function Tabs({
    children,
    defaultValue,
    value,
    onValueChange,
    variant = 'default',
    className,
}: TabsProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const activeTab = value !== undefined ? value : internalValue;

    const setActiveTab = (id: string) => {
        if (value === undefined) {
            setInternalValue(id);
        }
        onValueChange?.(id);
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

// =============================================================================
// TABS LIST
// =============================================================================

export interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabsList must be used within Tabs');

    const { variant } = context;

    return (
        <div
            role="tablist"
            className={cn(
                'flex',
                variant === 'default' && 'gap-1 border-b border-border-subtle pb-1',
                variant === 'pills' && 'gap-1 p-1 rounded-lg bg-bg-elevated',
                variant === 'underline' && 'gap-4 border-b border-border-subtle',
                variant === 'segment' && 'gap-0 p-1 rounded-lg bg-bg-elevated',
                className
            )}
        >
            {children}
        </div>
    );
}

// =============================================================================
// TAB TRIGGER
// =============================================================================

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Unique value for this tab */
    value: string;
    children: React.ReactNode;
}

export function TabTrigger({ value, children, className, ...props }: TabTriggerProps) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabTrigger must be used within Tabs');

    const { activeTab, setActiveTab, variant } = context;
    const isActive = activeTab === value;

    return (
        <button
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(value)}
            className={cn(
                'relative inline-flex items-center justify-center font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',

                // Default variant
                variant === 'default' && [
                    'px-4 py-2 text-sm rounded-md',
                    isActive
                        ? 'bg-state-selected text-text-primary border border-border-strong'
                        : 'text-text-secondary hover:text-text-primary hover:bg-state-hover',
                ],

                // Pills variant
                variant === 'pills' && [
                    'px-3 py-1.5 text-sm rounded-md',
                    isActive
                        ? 'bg-bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary',
                ],

                // Underline variant
                variant === 'underline' && [
                    'px-1 py-2 text-sm border-b-2 -mb-px',
                    isActive
                        ? 'border-emerald-500 text-text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong',
                ],

                // Segment variant
                variant === 'segment' && [
                    'flex-1 px-4 py-2 text-sm',
                    'first:rounded-l-md last:rounded-r-md',
                    isActive
                        ? 'bg-bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary',
                ],

                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

// =============================================================================
// TAB CONTENT
// =============================================================================

export interface TabContentProps {
    /** Value matching the TabTrigger */
    value: string;
    children: React.ReactNode;
    className?: string;
    /** Force render even when not active */
    forceMount?: boolean;
}

export function TabContent({ value, children, className, forceMount = false }: TabContentProps) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabContent must be used within Tabs');

    const { activeTab } = context;
    const isActive = activeTab === value;

    if (!isActive && !forceMount) return null;

    return (
        <div
            role="tabpanel"
            hidden={!isActive}
            className={cn('mt-4', className)}
        >
            {children}
        </div>
    );
}
