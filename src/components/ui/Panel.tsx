import React from "react";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    headerAction?: React.ReactNode;
    variant?: "default" | "elevated" | "outlined";
}

export function Panel({ className = "", title, headerAction, variant = "default", children, ...props }: PanelProps) {
    const variants = {
        default: "bg-bg-surface border-border-subtle",
        elevated: "bg-bg-elevated border-border-strong shadow-lg",
        outlined: "bg-transparent border-2 border-border-strong",
    };

    return (
        <section
            className={`flex flex-col overflow-hidden rounded-lg border shadow-sm ${variants[variant]} ${className}`}
            {...props}
        >
            {(title || headerAction) && (
                <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 bg-bg-surface">
                    {title && (
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            {title}
                        </h3>
                    )}
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            <div className="flex-1 overflow-hidden relative">
                {children}
            </div>
        </section>
    );
}
