'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@numezis/server/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Info, X, type LucideIcon } from 'lucide-react';

// =============================================================================
// TOAST TYPES
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

// =============================================================================
// TOAST CONTEXT
// =============================================================================

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    position: ToastPosition;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// =============================================================================
// TOAST PROVIDER
// =============================================================================

export interface ToastProviderProps {
    children: React.ReactNode;
    /** Position of toasts */
    position?: ToastPosition;
    /** Default duration in ms (0 = no auto-dismiss) */
    defaultDuration?: number;
}

export function ToastProvider({
    children,
    position = 'bottom-right',
    defaultDuration = 5000,
}: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? defaultDuration,
        };

        setToasts(prev => [...prev, newToast]);

        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, newToast.duration);
        }

        return id;
    }, [defaultDuration]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const positionStyles: Record<ToastPosition, string> = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-center': 'top-4 left-1/2 -translate-x-1/2',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    };

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, position }}>
            {children}
            {mounted && createPortal(
                <div
                    className={cn(
                        'fixed z-[100] flex flex-col gap-2',
                        positionStyles[position]
                    )}
                >
                    {toasts.map(toast => (
                        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

// =============================================================================
// TOAST ITEM
// =============================================================================

const typeConfig: Record<ToastType, { icon: LucideIcon; className: string }> = {
    success: {
        icon: CheckCircle2,
        className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
    error: {
        icon: XCircle,
        className: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    },
    warning: {
        icon: AlertCircle,
        className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    },
    info: {
        icon: Info,
        className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
};

interface ToastItemProps {
    toast: Toast;
    onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const config = typeConfig[toast.type];
    const Icon = config.icon;

    return (
        <div
            role="alert"
            className={cn(
                'flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[320px] max-w-[420px]',
                'bg-bg-elevated border-border-subtle',
                'animate-in slide-in-from-right-full fade-in duration-200'
            )}
        >
            <div className={cn('shrink-0 p-1 rounded', config.className)}>
                <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{toast.title}</p>
                {toast.description && (
                    <p className="text-xs text-text-muted mt-1">{toast.description}</p>
                )}
                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            onDismiss();
                        }}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 mt-2"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>

            <button
                onClick={onDismiss}
                className="shrink-0 p-1 rounded hover:bg-state-hover transition-colors"
            >
                <X className="w-4 h-4 text-text-muted" />
            </button>
        </div>
    );
}

// =============================================================================
// USE TOAST HOOK
// =============================================================================

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }

    const { addToast, removeToast } = context;

    return {
        toast: addToast,
        dismiss: removeToast,
        success: (title: string, description?: string) =>
            addToast({ type: 'success', title, description }),
        error: (title: string, description?: string) =>
            addToast({ type: 'error', title, description }),
        warning: (title: string, description?: string) =>
            addToast({ type: 'warning', title, description }),
        info: (title: string, description?: string) =>
            addToast({ type: 'info', title, description }),
    };
}
