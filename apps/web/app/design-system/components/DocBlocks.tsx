"use client";

import type { ReactNode } from "react";

export function DocSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="space-y-6">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold text-text-primary border-b border-border-subtle pb-3">{title}</h2>
                {description ? (
                    <p className="text-sm text-text-secondary max-w-3xl">{description}</p>
                ) : null}
            </div>
            {children}
        </section>
    );
}

export function DocSubSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                {description ? (
                    <p className="text-xs text-text-muted max-w-3xl">{description}</p>
                ) : null}
            </div>
            {children}
        </div>
    );
}

export function DocCard({
    title,
    description,
    children,
    footer,
    actions,
}: {
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-3">
            {(title || description) && (
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        {title ? <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</h4> : null}
                        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex-shrink-0">{actions}</div> : null}
                </div>
            )}
            {children}
            {footer ? <div className="pt-2 border-t border-border-subtle text-xs text-text-muted">{footer}</div> : null}
        </div>
    );
}

export function DocRules({ rules }: { rules: string[] }) {
    return (
        <ul className="space-y-1 text-xs text-text-secondary">
            {rules.map((rule) => (
                <li key={rule} className="leading-relaxed">• {rule}</li>
            ))}
        </ul>
    );
}

export function DocCode({ code, language = "tsx" }: { code: string; language?: string }) {
    return (
        <pre className="rounded-lg border border-border-subtle bg-bg-app p-3 overflow-x-auto text-xs text-text-secondary">
            <code className={`language-${language}`}>{code}</code>
        </pre>
    );
}

export function DocDivider({ label }: { label?: string }) {
    return (
        <div className="flex items-center gap-3 text-xs text-text-muted">
            <div className="h-px flex-1 bg-border-subtle" />
            {label ? <span className="uppercase tracking-widest">{label}</span> : null}
            <div className="h-px flex-1 bg-border-subtle" />
        </div>
    );
}
