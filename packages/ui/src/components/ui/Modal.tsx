"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    fullHeight?: boolean;
};

export function Modal({ open, onClose, title, subtitle, children, footer, fullHeight }: ModalProps) {
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
            <div className="relative flex h-full w-full max-w-4xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl glass-elevated">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-6 py-4">
                    <div className="min-w-0 flex-1 mr-4">
                        {title && <p className="text-[11px] font-mono text-text-muted truncate">{title}</p>}
                        {subtitle && <h3 className="text-lg font-semibold text-text-primary truncate" title={subtitle}>{subtitle}</h3>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-state-hover hover:text-text-primary"
                    >
                        Close
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 min-h-0 bg-bg-surface ${fullHeight ? "" : "overflow-hidden px-6 pt-4"}`}>
                    {fullHeight ? (
                        children
                    ) : (
                        <div className="h-full overflow-y-auto pr-2 scrollbar-elegant">
                            <div className="pb-6">
                                {children}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (Fixed) */}
                {footer && (
                    <div className="border-t border-border-subtle bg-bg-elevated px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
