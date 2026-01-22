"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ListTodo,
    PlayCircle,
    Settings,
    Layers,
    Folder,
    Terminal,
    History,
    Copy,
    Check,
    Database
} from "lucide-react";

const navItems = [
    {
        label: "Workbench",
        icon: Terminal,
        href: "/",
    },
    {
        label: "Campaigns",
        icon: Layers,
        href: "/campaigns",
    },
    {
        label: "Execution Runs",
        icon: PlayCircle,
        href: "/runs",
    },
    {
        label: "Vector Index",
        icon: Database,
        href: "/vectors",
    },
    {
        label: "History",
        icon: History,
        href: "/history",
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const [runningCount, setRunningCount] = useState(0);
    const [targetDir, setTargetDir] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchRunningCount = async () => {
            try {
                const res = await fetch("/api/runs?limit=100");
                if (res.ok) {
                    const data = await res.json();
                    const running = data.runs?.filter((r: any) => r.status === "RUNNING").length || 0;
                    setRunningCount(running);
                }
            } catch (e) {
                console.error("Failed to fetch running count", e);
            }
        };

        const fetchEnv = async () => {
            try {
                const res = await fetch("/api/env");
                if (res.ok) {
                    const data = await res.json();
                    setTargetDir(data.targetDir || null);
                }
            } catch (e) {
                console.error("Failed to fetch env", e);
            }
        };

        void fetchRunningCount();
        void fetchEnv();
        const interval = setInterval(() => void fetchRunningCount(), 10000);
        return () => clearInterval(interval);
    }, []);

    const handleCopyPath = () => {
        if (!targetDir) return;
        void navigator.clipboard.writeText(targetDir).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <aside className="flex h-full w-64 flex-col border-r border-border-subtle bg-bg-surface text-text-primary">
            <div className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-primary text-bg-surface">
                    <LayoutDashboard className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                    Numezis Coder
                </span>
            </div>

            <nav className="flex-1 space-y-1 p-3">
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Main Menu
                </div>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    const showBadge = item.href === "/runs" && runningCount > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                                ? "bg-state-selected text-text-primary"
                                : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                }`}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? "text-text-primary" : "text-text-muted"}`} />
                            <span className="flex-1">{item.label}</span>
                            {showBadge && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white animate-pulse">
                                    {runningCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="space-y-4 border-t border-border-subtle p-4">
                {targetDir && (
                    <div className="space-y-1.5">
                        <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                            Target Repository
                        </div>
                        <div className="group relative flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-elevated/50 p-2 transition hover:border-border-strong">
                            <div className="flex flex-1 items-center gap-2 overflow-hidden">
                                <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                                <span className="truncate text-[11px] font-mono text-text-secondary">
                                    {targetDir}
                                </span>
                            </div>
                            <button
                                onClick={handleCopyPath}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                title="Copy Path"
                            >
                                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500" />
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-xs font-medium text-text-primary">Admin</p>
                        <p className="truncate text-[10px] text-text-muted">Numezis Platform</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
