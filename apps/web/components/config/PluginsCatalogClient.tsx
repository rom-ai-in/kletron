"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, FolderOpen, Puzzle, Search } from "lucide-react";
import { listPlugins, getPlugin, type PluginDefinition } from "@kletron/shared";
import { buttonVariants, Input, Panel } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { useWorkspacePlugins } from "../../hooks/useWorkspacePlugins";
import { PluginCatalogModal } from "./PluginCatalogModal";

export function PluginsCatalogClient() {
    const plugins = listPlugins();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const { installed, isLoading: wsLoading, setInstalled } = useWorkspacePlugins(activeWorkspaceId ?? "");

    const [openId, setOpenId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);

    const openPlugin = openId ? (getPlugin(openId) ?? null) : null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return plugins;
        return plugins.filter(
            (p) =>
                p.id.includes(q) ||
                p.name.toLowerCase().includes(q) ||
                p.publisher.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q)
        );
    }, [plugins, query]);

    const { installedFiltered, availableFiltered } = useMemo(() => {
        const ins: typeof filtered = [];
        const avail: typeof filtered = [];
        for (const p of filtered) {
            if (installed[p.id]) ins.push(p);
            else avail.push(p);
        }
        const byName = (a: (typeof filtered)[0], b: (typeof filtered)[0]) => a.name.localeCompare(b.name);
        ins.sort(byName);
        avail.sort(byName);
        return { installedFiltered: ins, availableFiltered: avail };
    }, [filtered, installed]);

    const runInstall = async (pluginId: string, action: "install" | "remove") => {
        setBusyId(pluginId);
        try {
            await setInstalled(pluginId, action);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setBusyId(null);
        }
    };

    const workspaceReady = !activeWorkspaceId || !wsLoading;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Puzzle className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Plugins</h1>
                        <p className="text-sm text-text-muted">
                            Bundles of skills and connectors. Install applies to the workspace you select in
                            the shell.
                        </p>
                    </div>
                </div>
                <div className="shrink-0 text-xs text-text-muted">
                    {plugins.length} {plugins.length === 1 ? "bundle" : "bundles"}
                </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-elegant">
                {activeWorkspaceId && activeWorkspace ? (
                    <Panel className="border border-border-subtle bg-bg-elevated/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex gap-3">
                                <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
                                <div className="text-sm">
                                    <p className="font-medium text-text-primary">
                                        Install target:{" "}
                                        <span className="text-text-primary">{activeWorkspace.name}</span>
                                    </p>
                                    <p className="mt-1 text-xs text-text-muted">
                                        Use Install / Remove below or manage everything on the workspace
                                        page.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href={`/app/${activeWorkspaceId}/plugins`}
                                className={buttonVariants({
                                    variant: "secondary",
                                    size: "sm",
                                    className: "shrink-0",
                                })}
                            >
                                Workspace plugins
                            </Link>
                        </div>
                    </Panel>
                ) : (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            <span className="font-medium">Select a workspace</span> in the shell to install or
                            remove plugins from this catalog.
                        </p>
                    </Panel>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        leftIcon={Search}
                        placeholder="Search by name, publisher, or id…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        fullWidth
                        size="sm"
                        containerClassName="lg:max-w-md"
                    />
                </div>

                {activeWorkspaceId ? (
                    <div className="space-y-8">
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">
                                Installed for this workspace ({installedFiltered.length})
                            </h2>
                            {installedFiltered.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    {query.trim()
                                        ? "No installed plugins match your search."
                                        : "No plugins installed for this workspace yet."}
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                    {installedFiltered.map((p) => (
                                        <PluginCatalogCard
                                            key={p.id}
                                            plugin={p}
                                            workspaceReady={workspaceReady}
                                            activeWorkspaceId={activeWorkspaceId}
                                            installed
                                            busy={busyId === p.id}
                                            onOpen={() => setOpenId(p.id)}
                                            onInstall={() => void runInstall(p.id, "install")}
                                            onRemove={() => void runInstall(p.id, "remove")}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-text-primary">
                                Available ({availableFiltered.length})
                            </h2>
                            {availableFiltered.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                    {query.trim()
                                        ? "No available plugins match your search."
                                        : "All catalog plugins are installed for this workspace."}
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                                    {availableFiltered.map((p) => (
                                        <PluginCatalogCard
                                            key={p.id}
                                            plugin={p}
                                            workspaceReady={workspaceReady}
                                            activeWorkspaceId={activeWorkspaceId}
                                            installed={false}
                                            busy={busyId === p.id}
                                            onOpen={() => setOpenId(p.id)}
                                            onInstall={() => void runInstall(p.id, "install")}
                                            onRemove={() => void runInstall(p.id, "remove")}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((p) => (
                            <PluginCatalogCard
                                key={p.id}
                                plugin={p}
                                workspaceReady
                                activeWorkspaceId={null}
                                installed={false}
                                busy={false}
                                onOpen={() => setOpenId(p.id)}
                                onInstall={() => {}}
                                onRemove={() => {}}
                            />
                        ))}
                    </div>
                )}

                {filtered.length === 0 && !activeWorkspaceId && (
                    <Panel className="p-6 text-center">
                        <p className="text-sm text-text-secondary">No plugins match your search.</p>
                    </Panel>
                )}
            </div>

            <PluginCatalogModal
                plugin={openPlugin}
                open={Boolean(openId && openPlugin)}
                onClose={() => setOpenId(null)}
                workspacePluginActions={
                    activeWorkspaceId && openPlugin
                        ? {
                              workspaceId: activeWorkspaceId,
                              installed: !!installed[openPlugin.id],
                              busy: busyId === openPlugin.id,
                              onInstall: () => void runInstall(openPlugin.id, "install"),
                              onRemove: () => void runInstall(openPlugin.id, "remove"),
                          }
                        : null
                }
            />
        </div>
    );
}

function PluginCatalogCard({
    plugin,
    activeWorkspaceId,
    workspaceReady,
    installed,
    busy,
    onOpen,
    onInstall,
    onRemove,
}: {
    plugin: PluginDefinition;
    activeWorkspaceId: string | null;
    workspaceReady: boolean;
    installed: boolean;
    busy: boolean;
    onOpen: () => void;
    onInstall: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="group w-full text-left">
            <Panel className="h-full p-4 transition-colors group-hover:border-border-strong">
                <div
                    className="flex cursor-pointer items-start justify-between gap-4"
                    onClick={onOpen}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpen();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Puzzle className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                            <h2 className="text-sm font-semibold text-text-primary">{plugin.name}</h2>
                            {activeWorkspaceId && (
                                <>
                                    {!workspaceReady ? (
                                        <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                            …
                                        </span>
                                    ) : installed ? (
                                        <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-text">
                                            Installed
                                        </span>
                                    ) : (
                                        <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                            Not installed
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <p className="mt-1 line-clamp-3 text-xs text-text-secondary">{plugin.description}</p>
                        <p className="mt-3 text-[11px] text-text-muted">
                            {plugin.skillSlugs.length} skills · {plugin.connectorIds.length} connectors ·{" "}
                            {plugin.publisher}
                        </p>
                    </div>
                    <div className="mt-0.5 shrink-0 text-text-muted transition-colors group-hover:text-text-primary">
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </div>
                </div>
                {activeWorkspaceId && workspaceReady && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {installed ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onRemove}
                                className={buttonVariants({ variant: "secondary", size: "sm" })}
                            >
                                {busy ? "…" : "Remove"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onInstall}
                                className={buttonVariants({ variant: "primary", size: "sm" })}
                            >
                                {busy ? "…" : "Install"}
                            </button>
                        )}
                        <Link
                            href={`/app/${activeWorkspaceId}/plugins`}
                            className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                            Open workspace
                        </Link>
                    </div>
                )}
            </Panel>
        </div>
    );
}
