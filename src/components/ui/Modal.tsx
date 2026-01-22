"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: ReactNode;
};

export function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [open, onClose]);

    if (!open) return null;

    const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === overlayRef.current) {
            onClose();
        }
    };

    return (
        <div
            ref={overlayRef}
            onMouseDown={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
            <div className="relative flex h-full w-full max-w-4xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-6 py-4">
                    <div>
                        {title && <p className="text-[11px] font-mono text-text-muted">{title}</p>}
                        {subtitle && <h3 className="text-lg font-semibold text-text-primary">{subtitle}</h3>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
                    >
                        Close
                    </button>
                </div>
                <div className="flex-1 overflow-hidden px-6 pb-6 pt-4 bg-bg-surface">
                    <div className="h-full min-h-0 overflow-y-auto pr-2 scrollbar-elegant space-y-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
