"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { Panel } from "../ui/Panel";

export type ConfigExplorerSectionVariant = "divided" | "stack";

export interface ConfigExplorerSectionProps {
    title: string;
    icon: LucideIcon;
    iconClassName?: string;
    /** `divided`: rows separated like Graph nodes; `stack`: padded list like Graph edges */
    variant?: ConfigExplorerSectionVariant;
    /** Right side of the section header (e.g. edit actions) */
    headerRight?: ReactNode;
    children: React.ReactNode;
    className?: string;
}

/**
 * Panel block with green-accent icon header — same pattern as Graphs explorer Nodes/Edges.
 */
export function ConfigExplorerSection({
    title,
    icon: Icon,
    iconClassName = "text-status-success-text",
    variant = "stack",
    headerRight,
    children,
    className,
}: ConfigExplorerSectionProps) {
    return (
        <Panel className={clsx("overflow-hidden p-0", className)}>
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
                    <Icon className={clsx("h-4 w-4 shrink-0", iconClassName)} />
                    <span className="truncate">{title}</span>
                </h3>
                {headerRight ? <div className="flex shrink-0 items-center gap-2">{headerRight}</div> : null}
            </div>
            {variant === "divided" ? (
                <div className="divide-y divide-border-subtle">{children}</div>
            ) : (
                <div className="space-y-2 p-5 text-xs text-text-secondary">{children}</div>
            )}
        </Panel>
    );
}

export interface ConfigExplorerRowProps {
    title: string;
    subtitle?: string;
    badge?: string;
}

/** Single row inside a `divided` ConfigExplorerSection (graph node / skill line). */
export function ConfigExplorerRow({ title, subtitle, badge }: ConfigExplorerRowProps) {
    return (
        <div className="p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
                    {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
                </div>
                {badge ? (
                    <span className="shrink-0 rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 font-mono text-[10px] text-text-muted">
                        {badge}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

export interface ConfigExplorerMonoBlockProps {
    children: React.ReactNode;
    className?: string;
}

/** Mono bordered line — same pattern as Graph edges list items. */
export function ConfigExplorerMonoBlock({ children, className }: ConfigExplorerMonoBlockProps) {
    return (
        <div
            className={clsx(
                "rounded border border-border-subtle bg-bg-app px-3 py-2 font-mono text-[11px] text-text-muted",
                className
            )}
        >
            {children}
        </div>
    );
}
