"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TAB_CONFIG } from "../config";

const DEFAULT_TAB_ID = "foundation";

function getActiveTabId(pathname: string | null) {
    if (!pathname) return DEFAULT_TAB_ID;
    const segment = pathname.split("/")[2] ?? "";
    return TAB_CONFIG.find((tab) => tab.id === segment)?.id ?? DEFAULT_TAB_ID;
}

export default function DesignSystemShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const activeTabId = getActiveTabId(pathname);

    return (
        <div className="min-h-screen bg-bg-app">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary">Numezis Design System</h1>
                            <p className="text-xs text-text-muted">Cursor-Level UI Reference • v4.0</p>
                            <p className="text-[10px] text-amber-400 uppercase tracking-[0.2em] mt-1">
                                Mac App preview—expect the UI to evolve.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs">Custom Mac App</span>
                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">v4.0</span>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="sticky top-[73px] z-30 border-b border-border-subtle bg-bg-surface">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 py-2">
                        {TAB_CONFIG.map((tab) => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <Link
                                    key={tab.id}
                                    href={`/design-system/${tab.id}`}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                        ? "bg-state-selected text-text-primary border border-border-strong"
                                        : "text-text-secondary hover:text-text-primary hover:bg-state-hover"
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>

            <footer className="border-t border-border-subtle bg-bg-surface mt-16">
                <div className="max-w-7xl mx-auto px-6 py-6 text-center">
                    <p className="text-xs text-text-muted">🧠 Numezis Design System v4.0 • Custom Mac App Edition • February 2026</p>
                </div>
            </footer>
        </div>
    );
}
