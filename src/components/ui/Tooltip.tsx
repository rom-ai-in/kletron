'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/src/lib/utils';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
    children: React.ReactElement;
    /** Tooltip content */
    content: React.ReactNode;
    /** Position relative to trigger */
    position?: TooltipPosition;
    /** Delay before showing (ms) */
    delay?: number;
    /** Whether tooltip is disabled */
    disabled?: boolean;
    className?: string;
}

export function Tooltip({
    children,
    content,
    position = 'top',
    delay = 200,
    disabled = false,
    className,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);
    const triggerRef = useRef<HTMLElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        setMounted(true);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const updatePosition = () => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        let x = 0;
        let y = 0;

        switch (position) {
            case 'top':
                x = rect.left + scrollX + rect.width / 2;
                y = rect.top + scrollY - 8;
                break;
            case 'bottom':
                x = rect.left + scrollX + rect.width / 2;
                y = rect.bottom + scrollY + 8;
                break;
            case 'left':
                x = rect.left + scrollX - 8;
                y = rect.top + scrollY + rect.height / 2;
                break;
            case 'right':
                x = rect.right + scrollX + 8;
                y = rect.top + scrollY + rect.height / 2;
                break;
        }

        setCoords({ x, y });
    };

    const handleMouseEnter = () => {
        if (disabled) return;
        timeoutRef.current = setTimeout(() => {
            updatePosition();
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    const positionStyles: Record<TooltipPosition, string> = {
        top: '-translate-x-1/2 -translate-y-full',
        bottom: '-translate-x-1/2',
        left: '-translate-x-full -translate-y-1/2',
        right: '-translate-y-1/2',
    };

    const arrowStyles: Record<TooltipPosition, string> = {
        top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-bg-elevated border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-bg-elevated border-l-transparent border-r-transparent border-t-transparent',
        left: 'right-0 top-1/2 translate-x-full -translate-y-1/2 border-l-bg-elevated border-t-transparent border-b-transparent border-r-transparent',
        right: 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-r-bg-elevated border-t-transparent border-b-transparent border-l-transparent',
    };

    // Clone child to attach ref and handlers
    const trigger = React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleMouseEnter,
        onBlur: handleMouseLeave,
    });

    return (
        <>
            {trigger}
            {mounted && isVisible && createPortal(
                <div
                    role="tooltip"
                    className={cn(
                        'fixed z-[60] px-2.5 py-1.5 text-xs font-medium rounded-md',
                        'bg-bg-elevated text-text-primary shadow-lg border border-border-subtle',
                        'animate-in fade-in zoom-in-95 duration-100',
                        positionStyles[position],
                        className
                    )}
                    style={{ left: coords.x, top: coords.y }}
                >
                    {content}
                    <span
                        className={cn('absolute w-0 h-0 border-4', arrowStyles[position])}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
