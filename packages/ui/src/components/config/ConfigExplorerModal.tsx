"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface ConfigExplorerModalProps {
    open: boolean;
    onClose: () => void;
    /** Upper header line (mono), e.g. `Graph: ${id}` or skill slug */
    title?: string;
    /** Primary heading under the title */
    subtitle?: string;
    /** Left side of the footer (e.g. `2 nodes • 1 edges`) */
    footerSummary?: string;
    /** Actions between footer summary and Close */
    footerExtra?: ReactNode;
    /**
     * When set, replaces the default explorer footer (e.g. wizards with Back / Next).
     * When omitted, uses footerSummary + footerExtra + Close.
     */
    footerContent?: ReactNode;
    children: ReactNode;
}

/**
 * Modal shell matching the Config / Graphs explorer layout (summary + Close footer, spaced body).
 */
export function ConfigExplorerModal({
    open,
    onClose,
    title,
    subtitle,
    footerSummary,
    footerExtra,
    footerContent,
    children,
}: ConfigExplorerModalProps) {
    const footer =
        footerContent ??
        (
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-xs text-text-muted">{footerSummary ?? ""}</div>
                <div className="flex shrink-0 items-center gap-2">
                    {footerExtra}
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        );

    return (
        <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
            <div className="space-y-5">{children}</div>
        </Modal>
    );
}
