"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Code2,
    Home,
    Briefcase,
    Zap,
    Clock,
    LogOut,
    Building2,
    Plus,
    MoreHorizontal,
    Network,
    SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
    DEFAULT_WORK_MODE,
    readWorkModePreference,
    writeWorkModePreference,
} from "@kletron/shared/workModePreference";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";
import { SidebarNavGroup, SidebarNavItem, SidebarSegmented } from "./nav/SidebarNav";
import { SidebarAccountBlock } from "./nav/SidebarAccountBlock";

/** Work first, Code second — the same switch the thread rail shows. */
const WORK_MODE_SEGMENTS = [
    { id: "work" as const, label: WORK_MODES.work.name, icon: Briefcase, title: WORK_MODES.work.description },
    { id: "code" as const, label: WORK_MODES.code.name, icon: Code2, title: WORK_MODES.code.description },
];

/**
 * Primary rows: New Agent → Automation → Settings.
 * "Settings" is `/app/config`, the hub that already lists AI models, embeddings,
 * context, tools, connectors, skills and plugins — its sub-pages never go in the
 * menu, you reach them from the hub.
 */
const primaryItems: Array<{ label: string; icon: typeof Plus; href: string; action?: true }> = [
    { label: "New Agent", icon: Plus, href: "/app/agent?new=1", action: true },
    { label: "Automation", icon: Zap, href: "/app/automations" },
];

/** Everything else lives behind the "More" disclosure — top-level destinations only. */
const moreItems = [
    { label: "Agent Graphs", icon: Network, href: "/app/agent-graphs" },
    { label: "History", icon: Clock, href: "/app/history" },
    { label: "Organization", icon: Building2, href: "/app/organization" },
];

/** Strip the query string so `/app/agent?new=1` still matches `/app/agent`. */
function pathOf(href: string): string {
    return href.split("?")[0];
}

export interface SidebarProps {
    /** Controlled by the app shell so the toggle can live in the header. */
    collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps = {}) {
    const pathname = usePathname();
    const router = useRouter();
    const { signOut } = useAuth();

    const isCollapsed = collapsed;
    const [moreOpen, setMoreOpen] = useState(false);

    /**
     * The mode lives with the agent workspace; here it is the entry point into it.
     * Read from the shared preference so this rail and the thread rail agree.
     */
    const { activeWorkspaceId } = useWorkspace() ?? {};
    const [workMode, setWorkMode] = useState<WorkModeId>(DEFAULT_WORK_MODE);
    useEffect(() => {
        setWorkMode(readWorkModePreference(activeWorkspaceId) ?? DEFAULT_WORK_MODE);
    }, [activeWorkspaceId]);

    const handleWorkModeSelect = (mode: WorkModeId) => {
        setWorkMode(mode);
        writeWorkModePreference(activeWorkspaceId, mode);
        router.push(`/app/agent?mode=${mode}`);
    };

    /**
     * Segment-boundary match, so `/app/agent` does not light up on
     * `/app/agent-graphs`. Query strings are ignored (`/app/agent?new=1`).
     */
    /** The Work/Code switch only reflects a current mode while on the agent surface. */
    const isAgentSurface = pathname === "/app/agent";

    const isActive = (href: string) => {
        const base = pathOf(href);
        if (pathname === base) return true;
        if (base === "/app") return false;
        return pathname?.startsWith(`${base}/`) ?? false;
    };

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/auth/login';
    };

    return (
        <aside
            className={`flex h-full flex-col border-r border-white/[0.06] bg-bg-rail text-text-primary transition-all duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"
                }`}
        >
            {/* Top: identity. The collapse control lives in the header, not here —
                two chevrons side by side read as one broken control. */}
            <div
                className={`flex h-14 shrink-0 items-center border-b border-white/[0.06] ${
                    isCollapsed ? "justify-center px-2" : "px-2"
                }`}
            >
                <SidebarAccountBlock
                    collapsed={isCollapsed}
                    onOpenAccount={() => router.push("/app/account")}
                    className={isCollapsed ? "" : "min-w-0 flex-1"}
                />
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-thin scrollbar-thumb-border-strong scrollbar-track-transparent">
                {/* Work | Code — same switch as the thread rail */}
                {isCollapsed ? (
                    <SidebarNavGroup className="mb-2">
                        {WORK_MODE_SEGMENTS.map(({ id, label, icon, title }) => (
                            <SidebarNavItem
                                key={id}
                                icon={icon}
                                label={label}
                                title={title}
                                collapsed
                                active={isAgentSurface && workMode === id}
                                onClick={() => handleWorkModeSelect(id)}
                            />
                        ))}
                    </SidebarNavGroup>
                ) : (
                    <SidebarSegmented
                        ariaLabel="Work mode"
                        options={WORK_MODE_SEGMENTS}
                        value={isAgentSurface ? workMode : undefined}
                        onChange={handleWorkModeSelect}
                        className="mb-3 flex w-full"
                    />
                )}

                <SidebarNavGroup>
                    <SidebarNavItem
                        icon={Home}
                        label="Home"
                        collapsed={isCollapsed}
                        active={pathname === "/app"}
                        href="/app"
                        LinkComponent={Link}
                    />
                    {primaryItems.map((item) => (
                        <SidebarNavItem
                            key={item.label}
                            icon={item.icon}
                            label={item.label}
                            collapsed={isCollapsed}
                            /* "New Agent" is an action, never a location — never highlighted. */
                            active={item.action ? false : isActive(item.href)}
                            href={item.href}
                            LinkComponent={Link}
                        />
                    ))}

                    {/* Collapsed: no room for the disclosure, so show the rows directly. */}
                    {isCollapsed ? (
                        moreItems.map((item) => (
                            <SidebarNavItem
                                key={item.label}
                                icon={item.icon}
                                label={item.label}
                                collapsed
                                active={isActive(item.href)}
                                href={item.href}
                                LinkComponent={Link}
                            />
                        ))
                    ) : (
                        <>
                            <SidebarNavItem
                                icon={MoreHorizontal}
                                label="More"
                                active={moreOpen}
                                expanded={moreOpen}
                                onClick={() => setMoreOpen((open) => !open)}
                                title="More"
                            />
                            {moreOpen
                                ? moreItems.map((item) => (
                                    <SidebarNavItem
                                        key={item.label}
                                        icon={item.icon}
                                        label={item.label}
                                        active={isActive(item.href)}
                                        href={item.href}
                                        LinkComponent={Link}
                                        className="pl-4"
                                    />
                                ))
                                : null}
                        </>
                    )}
                </SidebarNavGroup>
            </nav>

            {/* Bottom: Settings — the hub at /app/config, never its sub-pages. */}
            <div className="shrink-0 border-t border-white/[0.06] p-3">
                <SidebarNavItem
                    icon={SlidersHorizontal}
                    label="Settings"
                    collapsed={isCollapsed}
                    active={isActive("/app/config")}
                    href="/app/config"
                    LinkComponent={Link}
                />
                {isCollapsed && (
                    <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        title="Sign out"
                        className="mt-1 flex w-full items-center justify-center rounded-lg p-2 text-text-muted transition hover:bg-status-error-bg hover:text-status-error-text"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                )}
            </div>
        </aside>
    );
}
