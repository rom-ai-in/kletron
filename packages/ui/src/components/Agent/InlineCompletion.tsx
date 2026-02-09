'use client';

import React from 'react';

export interface InlineCompletionProps {
    /** The ghost text suggestion */
    text: string;
    /** Whether the completion is visible */
    visible?: boolean;
    /** Callback when Tab is pressed (accept) */
    onAccept?: () => void;
    /** Callback when Escape is pressed (dismiss) */
    onDismiss?: () => void;
    className?: string;
}

export function InlineCompletion({
    text,
    visible = true,
    onAccept,
    onDismiss,
    className = '',
}: InlineCompletionProps) {
    if (!visible || !text) return null;

    return (
        <span
            className={`text-text-muted italic pointer-events-none select-none ${className}`}
            data-testid="inline-completion"
        >
            {text}
        </span>
    );
}

// Hook for managing inline completion state
export interface UseInlineCompletionOptions {
    suggestions: string[];
    delay?: number;
    enabled?: boolean;
}

export interface UseInlineCompletionResult {
    currentSuggestion: string | null;
    showSuggestion: boolean;
    accept: () => void;
    dismiss: () => void;
    next: () => void;
    previous: () => void;
}

export function useInlineCompletion({
    suggestions,
    delay = 300,
    enabled = true,
}: UseInlineCompletionOptions): UseInlineCompletionResult {
    const [index, setIndex] = React.useState(0);
    const [show, setShow] = React.useState(false);

    React.useEffect(() => {
        if (!enabled || suggestions.length === 0) {
            setShow(false);
            return;
        }

        const timer = setTimeout(() => {
            setShow(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [suggestions, delay, enabled]);

    const accept = React.useCallback(() => {
        setShow(false);
    }, []);

    const dismiss = React.useCallback(() => {
        setShow(false);
    }, []);

    const next = React.useCallback(() => {
        setIndex(i => (i + 1) % suggestions.length);
    }, [suggestions.length]);

    const previous = React.useCallback(() => {
        setIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    }, [suggestions.length]);

    return {
        currentSuggestion: suggestions[index] || null,
        showSuggestion: show && suggestions.length > 0,
        accept,
        dismiss,
        next,
        previous,
    };
}

// Multi-line completion display
export interface MultiLineCompletionProps {
    lines: string[];
    visible?: boolean;
    onAccept?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export function MultiLineCompletion({
    lines,
    visible = true,
    onAccept,
    onDismiss,
    className = '',
}: MultiLineCompletionProps) {
    if (!visible || lines.length === 0) return null;

    return (
        <div
            className={`font-mono text-text-muted italic pointer-events-none select-none ${className}`}
            data-testid="multiline-completion"
        >
            {lines.map((line, i) => (
                <div key={i} className="whitespace-pre">
                    {line}
                </div>
            ))}
        </div>
    );
}
