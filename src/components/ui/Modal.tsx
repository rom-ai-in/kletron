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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-[6px]"
        >
            <div className="relative flex h-full w-full max-w-4xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 shadow-[0_30px_60px_rgba(2,6,23,0.75)]">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-t-[32px] bg-slate-950/90 px-6 py-5">
                    <div>
                        {title && <p className="text-[11px] text-slate-500">{title}</p>}
                        {subtitle && <h3 className="text-3xl font-semibold text-white">{subtitle}</h3>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white"
                    >
                        Close
                    </button>
                </div>
                <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
                    <div className="h-full min-h-0 overflow-y-auto pr-2 scrollbar-elegant space-y-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
