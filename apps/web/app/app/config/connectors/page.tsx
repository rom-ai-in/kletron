"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Plug, Search } from "lucide-react";
import { buttonVariants, Input, Panel, Skeleton } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import type { ConnectorTypeDefinition } from "@kletron/shared";
import { useConnectorCatalog, useWorkspaceConnectors } from "../../../../hooks/useConnectors";

function groupByCategory(defs: ConnectorTypeDefinition[]) {
    const map = new Map<string, ConnectorTypeDefinition[]>();
    for (const def of defs) {
        const arr = map.get(def.category) ?? [];
        arr.push(def);
        map.set(def.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function ConnectorsCatalogPage() {
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const { types, isLoading: catalogLoading, error: catalogError } = useConnectorCatalog();
    const {
        integrations,
        mcpServers,
        isLoading: wsLoading,
        error: wsError,
    } = useWorkspaceConnectors(activeWorkspaceId ?? "");

    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return types;
        return types.filter(
            (t) =>
                t.id.includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.category.includes(q)
        );
    }, [types, search]);

    const connectedCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const i of integrations) {
            m.set(i.providerId, (m.get(i.providerId) ?? 0) + 1);
        }
        return m;
    }, [integrations]);

    const { connectedDefs, notConnectedDefs } = useMemo(() => {
        const connected: ConnectorTypeDefinition[] = [];
        const notConn: ConnectorTypeDefinition[] = [];
        for (const d of filtered) {
            const c = connectedCounts.get(d.id) ?? 0;
            if (c > 0) connected.push(d);
            else notConn.push(d);
        }
        const byName = (a: ConnectorTypeDefinition, b: ConnectorTypeDefinition) =>
            a.name.localeCompare(b.name);
        connected.sort(byName);
        notConn.sort(byName);
        return { connectedDefs: connected, notConnectedDefs: notConn };
    }, [filtered, connectedCounts]);

    const groupedAll = useMemo(() => groupByCategory(filtered), [filtered]);
    const groupedConnected = useMemo(() => groupByCategory(connectedDefs), [connectedDefs]);
    const groupedNotConnected = useMemo(() => groupByCategory(notConnectedDefs), [notConnectedDefs]);

    const workspaceReady = !activeWorkspaceId || !wsLoading;
    const listError = catalogError || (activeWorkspaceId ? wsError : null);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Plug className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Connectors</h1>
                        <p className="text-sm text-text-muted">
                            Catalog of SaaS integrations. Credentials and MCP setup live on{" "}
                            {activeWorkspaceId ? (
                                <Link
                                    href={`/app/${activeWorkspaceId}/connectors`}
                                    className="text-text-secondary underline decoration-border-subtle underline-offset-2 hover:text-text-primary"
                                >
                                    workspace connectors
                                </Link>
                            ) : (
                                <span className="text-text-secondary">workspace connectors</span>
                            )}
                            .
                            {activeWorkspaceId && workspaceReady ? (
                                <>
                                    {" "}
                                    <span className="text-text-secondary">
                                        {integrations.length} integration
                                        {integrations.length !== 1 ? "s" : ""}
                                        {mcpServers.length > 0
                                            ? ` · ${mcpServers.length} MCP server${mcpServers.length !== 1 ? "s" : ""}`
                                            : ""}{" "}
                                        for the selected workspace.
                                    </span>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>
                <div className="shrink-0 text-xs text-text-muted">
                    {catalogLoading ? "…" : `${types.length} ${types.length === 1 ? "provider" : "providers"}`}
                </div>
            </div>

            <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-6 scrollbar-elegant">
                {activeWorkspaceId && activeWorkspace?.rootPath ? (
                    <Panel className="border border-border-subtle bg-bg-elevated/80 p-4">
                        <div className="flex gap-3">
                            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
                            <div className="text-sm">
                                <p className="font-medium text-text-primary">
                                    Status for workspace{" "}
                                    <span className="text-text-primary">{activeWorkspace.name}</span>
                                </p>
                                <p className="mt-1 text-xs text-text-muted">
                                    Badges reflect integrations on this workspace. MCP servers are added on
                                    the workspace connectors page ({mcpServers.length} configured).
                                </p>
                            </div>
                        </div>
                    </Panel>
                ) : activeWorkspaceId && !activeWorkspace?.rootPath ? (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            This workspace has no folder path. Connector status still reflects API
                            integrations for this workspace.
                        </p>
                    </Panel>
                ) : (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            <span className="font-medium">Select a workspace</span> in the shell to see
                            which providers are connected and to open the right workspace setup page.
                        </p>
                    </Panel>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        leftIcon={Search}
                        placeholder="Search providers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        fullWidth
                        size="sm"
                        containerClassName="lg:max-w-md"
                    />
                </div>

                {listError && (
                    <p className="text-xs text-status-error-text">Error: {listError}</p>
                )}

                {catalogLoading && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Panel key={i} className="p-4">
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-3 w-28" />
                                    <Skeleton className="h-12 w-full" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-20" />
                                        <Skeleton className="h-6 w-24" />
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                {!catalogLoading && activeWorkspaceId && (
                    <div className="space-y-8">
                        {groupedConnected.length === 0 && groupedNotConnected.length === 0 ? (
                            <p className="text-sm text-text-muted">
                                {search.trim()
                                    ? `No providers match “${search.trim()}”.`
                                    : "No connectors in the catalog."}
                            </p>
                        ) : (
                            <>
                                <section className="space-y-3">
                                    <h2 className="text-sm font-semibold text-text-primary">
                                        Connected for this workspace ({connectedDefs.length})
                                    </h2>
                                    {connectedDefs.length === 0 ? (
                                        <p className="text-xs text-text-muted">
                                            No catalog providers match your search with an active
                                            integration.
                                        </p>
                                    ) : (
                                        groupedConnected.map(([category, items]) => (
                                            <div key={`c-${category}`} className="space-y-3">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                    {category}
                                                </h3>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                    {items.map((def) => (
                                                        <ConnectorCatalogCard
                                                            key={def.id}
                                                            def={def}
                                                            connectionCount={
                                                                wsLoading
                                                                    ? undefined
                                                                    : (connectedCounts.get(def.id) ?? 0)
                                                            }
                                                            activeWorkspaceId={activeWorkspaceId}
                                                            workspaceReady={workspaceReady}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </section>

                                <section className="space-y-3">
                                    <h2 className="text-sm font-semibold text-text-primary">
                                        Not connected ({notConnectedDefs.length})
                                    </h2>
                                    {notConnectedDefs.length === 0 ? (
                                        <p className="text-xs text-text-muted">
                                            All matching providers have at least one integration, or your
                                            search left no remainder.
                                        </p>
                                    ) : (
                                        groupedNotConnected.map(([category, items]) => (
                                            <div key={`n-${category}`} className="space-y-3">
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                    {category}
                                                </h3>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                    {items.map((def) => (
                                                        <ConnectorCatalogCard
                                                            key={def.id}
                                                            def={def}
                                                            connectionCount={
                                                                wsLoading
                                                                    ? undefined
                                                                    : (connectedCounts.get(def.id) ?? 0)
                                                            }
                                                            activeWorkspaceId={activeWorkspaceId}
                                                            workspaceReady={workspaceReady}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                )}

                {!catalogLoading && !activeWorkspaceId && (
                    <div className="space-y-8">
                        {groupedAll.length === 0 ? (
                            <p className="text-sm text-text-muted">
                                {search.trim()
                                    ? `No providers match “${search.trim()}”.`
                                    : "No connectors in the catalog."}
                            </p>
                        ) : (
                            groupedAll.map(([category, items]) => (
                                <section key={category} className="space-y-3">
                                    <h2 className="text-sm font-semibold text-text-primary">{category}</h2>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {items.map((def) => (
                                            <ConnectorCatalogCard
                                                key={def.id}
                                                def={def}
                                                connectionCount={undefined}
                                                activeWorkspaceId={null}
                                                workspaceReady
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ConnectorCatalogCard({
    def,
    connectionCount,
    activeWorkspaceId,
    workspaceReady,
}: {
    def: ConnectorTypeDefinition;
    connectionCount: number | undefined;
    activeWorkspaceId: string | null;
    workspaceReady: boolean;
}) {
    const connected = connectionCount !== undefined && connectionCount > 0;
    const workspaceHref = activeWorkspaceId
        ? `/app/${activeWorkspaceId}/connectors?provider=${encodeURIComponent(def.id)}`
        : null;

    return (
        <Panel className="flex flex-col p-4 transition-colors hover:border-border-strong">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">{def.name}</h3>
                        {activeWorkspaceId && (
                            <>
                                {!workspaceReady || connectionCount === undefined ? (
                                    <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                        …
                                    </span>
                                ) : connected ? (
                                    <span className="rounded-md border border-status-success-border bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-text">
                                        Connected ({connectionCount})
                                    </span>
                                ) : (
                                    <span className="rounded-md border border-border-subtle bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                                        Not connected
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                        {def.id} · {def.auth}
                    </p>
                </div>
                {def.docsUrl && (
                    <a
                        href={def.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-text-muted hover:text-text-primary"
                        title="Documentation"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                )}
            </div>
            <p className="mt-2 flex-1 text-xs text-text-secondary">{def.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
                {def.unlocksTools.slice(0, 4).map((t) => (
                    <span
                        key={t}
                        className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted"
                    >
                        {t}
                    </span>
                ))}
                {def.unlocksTools.length > 4 && (
                    <span className="text-[10px] text-text-muted">
                        +{def.unlocksTools.length - 4} more
                    </span>
                )}
            </div>
            <div className="mt-3">
                {workspaceHref ? (
                    <Link
                        href={workspaceHref}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                        {connected ? "Open in workspace" : "Add in workspace"}
                    </Link>
                ) : (
                    <span className="text-[11px] text-text-muted" title="Select a workspace in the shell">
                        Select a workspace to configure
                    </span>
                )}
            </div>
        </Panel>
    );
}
