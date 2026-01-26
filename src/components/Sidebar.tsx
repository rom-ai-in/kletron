"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Settings,
    Layers,
    Share2,
    Folder,
    Terminal,
    History,
    Copy,
    Check,
    Database,
    Globe,
    FileCode,
    ChevronLeft,
    ChevronRight
} from "lucide-react";


const navItems = [
    {
        label: "Editor",
        icon: FileCode,
        href: "/editor",
    },
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
        label: "Agent Graphs",
        icon: Share2,
        href: "/agent-graphs",
    },
    {
        label: "Vector Index",
        icon: Database,
        href: "/vectors",
    },
    {
        label: "Changes",
        icon: FileCode,
        href: "/changes",
    },
    {
        label: "Activity",
        icon: History,
        href: "/history",
    },
    {
        label: "Translation Agents",
        icon: Globe,
        href: "/i18n",
    },
    {
        label: "Configuration",
        icon: Settings,
        href: "/config",
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const [runningCount, setRunningCount] = useState(0);
    const [targetDir, setTargetDir] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

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
        <aside
            className={`flex h-full flex-col border-r border-border-subtle bg-bg-surface text-text-primary transition-all duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"
                }`}
        >
            <div className={`flex items-center gap-3 border-b border-border-subtle py-4 transition-all duration-300 ${isCollapsed ? "flex-col justify-center px-2 gap-4" : "px-6"}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-primary text-bg-surface">
                    <LayoutDashboard className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                    <span className="text-sm font-semibold tracking-tight text-text-primary whitespace-nowrap overflow-hidden transition-opacity duration-300">
                        Numezis Coder
                    </span>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`flex items-center justify-center rounded-md p-1 text-text-muted hover:bg-state-hover hover:text-text-primary transition-all ${isCollapsed ? "" : "ml-auto"}`}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>

            <nav className="flex-1 space-y-1 p-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border-strong scrollbar-track-transparent">
                {!isCollapsed && (
                    <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap overflow-hidden transition-opacity duration-300 delay-100">
                        Main Menu
                    </div>
                )}
                {isCollapsed && <div className="h-4" />} {/* Spacer for collapsed mode */}

                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && (pathname?.startsWith(item.href) ?? false));
                    const Icon = item.icon;
                    const showBadge = item.href === "/history" && runningCount > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive
                                ? "bg-state-selected text-text-primary"
                                : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                } ${isCollapsed ? "justify-center" : "gap-3"}`}
                        >
                            <div className="relative flex items-center justify-center">
                                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-text-primary" : "text-text-muted group-hover:text-text-primary"}`} />
                                {showBadge && isCollapsed && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                                )}
                            </div>

                            {!isCollapsed && (
                                <>
                                    <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                                    {showBadge && (
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white animate-pulse">
                                            {runningCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={`border-t border-border-subtle p-4 transition-all duration-300 ${isCollapsed ? "px-2" : ""}`}>
                {targetDir && (
                    <div className={`space-y-1.5 ${isCollapsed ? "flex justify-center" : ""}`}>
                        {!isCollapsed && (
                            <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap overflow-hidden">
                                Target Repository
                            </div>
                        )}

                        {isCollapsed ? (
                            <div className="group relative flex items-center justify-center rounded-lg p-2 transition hover:bg-bg-elevated" title={targetDir}>
                                <Folder className="h-4 w-4 text-text-muted" />
                            </div>
                        ) : (
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
                        )}
                    </div>
                )}

                <div className={`flex items-center rounded-lg border border-border-subtle bg-bg-elevated p-3 mt-4 transition-all duration-300 ${isCollapsed ? "justify-center border-transparent bg-transparent p-0 mt-2" : "gap-3"}`}>
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500" />
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-xs font-medium text-text-primary">Admin</p>
                            <p className="truncate text-[10px] text-text-muted">Numezis Platform</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
