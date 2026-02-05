"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Settings,
    Share2,
    Folder,
    Terminal,
    History,
    Copy,
    Check,
    Database,
    Globe,
    Compass,
    Home,
    Layers,
    ChevronLeft,
    ChevronRight,
    UserCircle,
    LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";


const navItems = [
    {
        label: "App Overview",
        icon: Home,
        href: "/app",
    },
    {
        label: "Explore",
        icon: Compass,
        href: "/app/explore",
    },
    {
        label: "Deep Agent",
        icon: Terminal,
        href: "/app/deep-agent",
    },
    {
        label: "Code Comparator",
        icon: History,
        href: "/app/changes",
    },
    {
        label: "Agent Graphs",
        icon: Share2,
        href: "/app/agent-graphs",
    },
    {
        label: "Campaigns",
        icon: Layers,
        href: "/app/campaigns",
    },
    {
        label: "Vector Index",
        icon: Database,
        href: "/app/vectors",
    },
    {
        label: "Configuration",
        icon: Settings,
        href: "/app/config",
    }
];

/** Generate a stable gradient based on a string (user ID or email) */
function getAvatarGradient(seed: string): string {
    const colors = [
        'from-violet-600 to-indigo-600',
        'from-blue-600 to-cyan-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
        'from-rose-500 to-pink-500',
        'from-fuchsia-500 to-purple-500',
        'from-emerald-500 to-teal-600',
        'from-lime-500 to-emerald-500',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

/** Get initials from a name or email */
function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email) {
        const localPart = email.split('@')[0];
        return localPart.slice(0, 2).toUpperCase();
    }
    return 'U';
}

export function Sidebar() {
    const pathname = usePathname();
    const { user, profile, loading: authLoading, signOut } = useAuth();

    const [targetDir, setTargetDir] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Memoize user display values
    const displayName = useMemo(() => {
        if (profile?.full_name) return profile.full_name;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    }, [profile, user]);

    const displayEmail = useMemo(() => {
        return user?.email || 'account@numezis.ch';
    }, [user]);

    const avatarGradient = useMemo(() => {
        return getAvatarGradient(user?.id || user?.email || 'default');
    }, [user]);

    const initials = useMemo(() => {
        return getInitials(profile?.full_name, user?.email);
    }, [profile, user]);

    const isAccountActive = pathname === '/app/account' || pathname?.startsWith('/app/account/');

    useEffect(() => {
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
        void fetchEnv();
    }, []);

    const handleCopyPath = () => {
        if (!targetDir) return;
        void navigator.clipboard.writeText(targetDir).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/auth/login';
    };

    return (
        <aside
            className={`flex h-full flex-col border-r border-border-subtle bg-bg-surface text-text-primary transition-all duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"
                }`}
        >
            {/* Header */}
            <div className={`flex items-center gap-3 border-b border-border-subtle py-4 transition-all duration-300 ${isCollapsed ? "flex-col justify-center px-2 gap-4" : "px-6"}`}>
                <Link href="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-primary text-bg-surface text-lg hover:opacity-80 transition-opacity" title="Go to landing page">
                    🧠
                </Link>
                {!isCollapsed && (
                    <span className="text-sm font-semibold tracking-tight text-text-primary whitespace-nowrap overflow-hidden transition-opacity duration-300">
                        Numezis Code
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

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border-strong scrollbar-track-transparent">
                {!isCollapsed && (
                    <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap overflow-hidden transition-opacity duration-300 delay-100">
                        Main Menu
                    </div>
                )}
                {isCollapsed && <div className="h-4" />}

                {/* Nav Items */}
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && (pathname?.startsWith(item.href) ?? false));
                    const Icon = item.icon;

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
                            </div>
                            {!isCollapsed && (
                                <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className={`border-t border-border-subtle p-4 transition-all duration-300 ${isCollapsed ? "px-2" : ""}`}>
                {/* Active Workspace */}
                {targetDir && (
                    <div className={`space-y-1.5 ${isCollapsed ? "flex justify-center" : ""}`}>
                        {!isCollapsed && (
                            <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap overflow-hidden">
                                Active Workspace
                            </div>
                        )}

                        {isCollapsed ? (
                            <div className="group relative flex items-center justify-center rounded-lg p-2 transition hover:bg-bg-elevated" title={`Active Workspace: ${targetDir}`}>
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

                {/* Profile Section - Linked to /app/account */}
                <Link
                    href="/app/account"
                    title={isCollapsed ? `${displayName} - Mon compte` : undefined}
                    className={`group flex items-center rounded-lg border mt-4 transition-all duration-300 ${isAccountActive
                        ? "border-border-strong bg-state-selected"
                        : "border-border-subtle bg-bg-elevated hover:border-border-strong hover:bg-state-hover"
                        } ${isCollapsed ? "justify-center border-transparent bg-transparent p-2 mt-2 hover:bg-bg-elevated" : "gap-3 p-3"}`}
                >
                    {/* Avatar */}
                    {authLoading ? (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-bg-elevated animate-pulse" />
                    ) : (
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${avatarGradient} text-white text-xs font-semibold shadow-sm`}>
                            {initials}
                        </div>
                    )}

                    {/* User Info */}
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            {authLoading ? (
                                <>
                                    <div className="h-3 w-20 bg-bg-elevated rounded animate-pulse mb-1" />
                                    <div className="h-2.5 w-28 bg-bg-elevated rounded animate-pulse" />
                                </>
                            ) : (
                                <>
                                    <p className="truncate text-xs font-medium text-text-primary group-hover:text-text-primary">
                                        {displayName}
                                    </p>
                                    <p className="truncate text-[10px] text-text-muted">
                                        {displayEmail}
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Account indicator icon in expanded mode */}
                    {!isCollapsed && (
                        <UserCircle className={`h-4 w-4 shrink-0 transition-colors ${isAccountActive ? "text-text-primary" : "text-text-muted group-hover:text-text-secondary"}`} />
                    )}
                </Link>

                {/* Logout button in collapsed mode */}
                {isCollapsed && (
                    <button
                        onClick={handleSignOut}
                        title="Se déconnecter"
                        className="mt-2 flex w-full items-center justify-center rounded-lg p-2 text-text-muted transition hover:bg-red-500/10 hover:text-red-400"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                )}
            </div>
        </aside>
    );
}
