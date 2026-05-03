"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Badge,
    Button,
    Card,
    Checkbox,
    EmptyState,
    Input,
    Modal,
    Panel,
    Selector,
    type SelectorOption,
    Skeleton,
    Switch,
    Tabs,
    TabsList,
    TabTrigger,
    TabContent,
    Textarea,
} from "@kletron/ui/components/design-system";
import {
    ArrowLeft,
    ExternalLink,
    FolderOpen,
    Link2,
    Play,
    Plus,
    RefreshCw,
    Search,
    Trash2,
} from "lucide-react";
import {
    getPlugin,
    type ConnectorIntegrationStatus,
    type ConnectorTypeDefinition,
    type McpServerTransport,
    type WorkspaceIntegrationSummary,
    type WorkspaceMcpServerSummary,
} from "@kletron/shared";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { useConnectorCatalog, useWorkspaceConnectors } from "../../hooks/useConnectors";

function parseKvText(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return out;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {label}
            </span>
            {children}
        </div>
    );
}

const MCP_TRANSPORT_OPTIONS: SelectorOption[] = [
    { id: "stdio", label: "stdio", sub: "Local command (npx, Python, …)" },
    { id: "sse", label: "SSE", sub: "HTTP Server-Sent Events endpoint" },
    { id: "streamable-http", label: "Streamable HTTP", sub: "Remote MCP (streamable HTTP)" },
];

function mcpStatusBadgeVariant(status: string): "success" | "error" | "warning" | "default" {
    if (status === "connected") return "success";
    if (status === "error") return "error";
    if (status === "unknown") return "warning";
    return "default";
}

function integrationStatusBadgeVariant(
    status: ConnectorIntegrationStatus,
): "success" | "warning" | "error" {
    if (status === "active") return "success";
    if (status === "revoked") return "warning";
    return "error";
}

/** Higher = more important to surface first (healthy connections at top). */
function saasCatalogSortScore(
    def: ConnectorTypeDefinition,
    allIntegrations: WorkspaceIntegrationSummary[],
): number {
    const list = allIntegrations.filter((i) => i.providerId === def.id);
    const hasActive = list.some((i) => i.status === "active");
    const hasIssue = list.some((i) => i.status !== "active");
    if (hasActive) return 3;
    if (list.length && hasIssue) return 2;
    if (list.length) return 1;
    return 0;
}

function sortCatalogDefs(
    items: ConnectorTypeDefinition[],
    allIntegrations: WorkspaceIntegrationSummary[],
): ConnectorTypeDefinition[] {
    return [...items].sort((a, b) => {
        const d = saasCatalogSortScore(b, allIntegrations) - saasCatalogSortScore(a, allIntegrations);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name);
    });
}

/** Enabled MCP servers first; then connected before unknown/error; disabled last. */
function mcpListSortKey(server: WorkspaceMcpServerSummary): number {
    if (!server.enabled) return 0;
    if (server.status === "connected") return 4;
    if (server.status === "error") return 2;
    return 3;
}

const blankMcpDraft = {
    name: "",
    transport: "stdio" as McpServerTransport,
    command: "",
    args: "",
    envText: "",
    url: "",
    headersText: "",
    enabled: true,
};

export function WorkspaceConnectorsManager({ workspaceId }: { workspaceId: string }) {
    const searchParams = useSearchParams();
    const pluginId = searchParams?.get("plugin") ?? undefined;
    const providerFocus = searchParams?.get("provider")?.trim() || undefined;
    const plugin = pluginId ? getPlugin(pluginId) : undefined;

    const { workspaces } = useWorkspace();
    const pageWorkspace = useMemo(
        () => workspaces.find((w) => w.id === workspaceId) ?? null,
        [workspaces, workspaceId],
    );

    const { types, isLoading: typesLoading, error: typesError } = useConnectorCatalog();
    const integrationTypes = useMemo(() => {
        if (!plugin) return types;
        const allow = new Set(plugin.connectorIds);
        return types.filter((t) => allow.has(t.id));
    }, [types, plugin]);

    const {
        integrations,
        mcpServers,
        isLoading,
        error,
        createIntegration,
        deleteIntegration,
        testIntegration,
        createMcpServer,
        updateMcpServer,
        deleteMcpServer,
        discoverMcpServer,
    } = useWorkspaceConnectors(workspaceId);

    const [search, setSearch] = useState("");
    const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const [addOpen, setAddOpen] = useState(false);
    const [addTab, setAddTab] = useState<"integration" | "mcp">("integration");
    const [intPhase, setIntPhase] = useState<"browse" | "configure">("browse");
    const [intBrowseQuery, setIntBrowseQuery] = useState("");
    const [selectedType, setSelectedType] = useState<ConnectorTypeDefinition | null>(null);
    const [intDisplayName, setIntDisplayName] = useState("");
    const [intCredentials, setIntCredentials] = useState<Record<string, string>>({});
    const [mcpDraft, setMcpDraft] = useState(blankMcpDraft);

    const [modalError, setModalError] = useState<string | null>(null);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [discoveringId, setDiscoveringId] = useState<string | null>(null);

    const showToast = useCallback((kind: "success" | "error", text: string) => {
        setToast({ kind, text });
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = window.setTimeout(() => setToast(null), 5000);
        return () => window.clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (!providerFocus || isLoading || typesLoading) return;
        const id = `connector-card-${providerFocus}`;
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        el.classList.add("ring-2", "ring-focus-ring", "rounded-xl");
        const timer = window.setTimeout(() => {
            el.classList.remove("ring-2", "ring-focus-ring", "rounded-xl");
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [providerFocus, isLoading, typesLoading]);

    const resetAddModal = useCallback(() => {
        setAddTab("integration");
        setIntPhase("browse");
        setIntBrowseQuery("");
        setSelectedType(null);
        setIntDisplayName("");
        setIntCredentials({});
        setMcpDraft({ ...blankMcpDraft });
        setModalError(null);
        setSubmitBusy(false);
    }, []);

    const openAddModal = useCallback(
        (opts?: { tab?: "integration" | "mcp"; integration?: ConnectorTypeDefinition }) => {
            resetAddModal();
            setModalError(null);
            setAddOpen(true);
            if (opts?.tab) setAddTab(opts.tab);
            if (opts?.integration) {
                setAddTab("integration");
                setIntPhase("configure");
                setSelectedType(opts.integration);
                const creds: Record<string, string> = {};
                for (const f of opts.integration.credentialFields ?? []) creds[f.key] = "";
                setIntCredentials(creds);
                setIntDisplayName(opts.integration.name);
            }
        },
        [resetAddModal],
    );

    const closeAddModal = useCallback(() => {
        setAddOpen(false);
        resetAddModal();
    }, [resetAddModal]);

    const filteredCatalog = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return integrationTypes;
        return integrationTypes.filter(
            (t) =>
                t.id.includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q),
        );
    }, [integrationTypes, search]);

    const filteredMcpServers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return mcpServers;
        return mcpServers.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.slug.includes(q) ||
                s.transport.includes(q) ||
                (s.statusMessage?.toLowerCase().includes(q) ?? false),
        );
    }, [mcpServers, search]);

    const catalogGrouped = useMemo(() => {
        const map = new Map<string, ConnectorTypeDefinition[]>();
        for (const t of filteredCatalog) {
            const arr = map.get(t.category) ?? [];
            arr.push(t);
            map.set(t.category, arr);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, items]) => ({
                category,
                items: sortCatalogDefs(items, integrations),
            }));
    }, [filteredCatalog, integrations]);

    const filteredMcpServersSorted = useMemo(() => {
        return [...filteredMcpServers].sort((a, b) => {
            const d = mcpListSortKey(b) - mcpListSortKey(a);
            if (d !== 0) return d;
            return a.name.localeCompare(b.name);
        });
    }, [filteredMcpServers]);

    const statusSummary = useMemo(() => {
        const saasActive = integrations.filter((i) => i.status === "active").length;
        const saasAttention = integrations.filter((i) => i.status !== "active").length;
        const mcpEnabled = mcpServers.filter((s) => s.enabled).length;
        const mcpDisabled = mcpServers.filter((s) => !s.enabled).length;
        const mcpReady = mcpServers.filter((s) => s.enabled && s.status === "connected").length;
        return { saasActive, saasAttention, mcpEnabled, mcpDisabled, mcpReady };
    }, [integrations, mcpServers]);

    const modalBrowseFiltered = useMemo(() => {
        const q = intBrowseQuery.trim().toLowerCase();
        if (!q) return integrationTypes;
        return integrationTypes.filter(
            (t) =>
                t.id.includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q),
        );
    }, [integrationTypes, intBrowseQuery]);

    const submitIntegration = async () => {
        if (!selectedType) return;
        setModalError(null);
        setSubmitBusy(true);
        try {
            if (selectedType.auth === "oauth") {
                const pluginQs =
                    pluginId !== undefined && pluginId !== ""
                        ? `?plugin=${encodeURIComponent(pluginId)}`
                        : "";
                window.location.href = `/api/auth/connect/${selectedType.id}?workspaceId=${workspaceId}&redirect=${encodeURIComponent(`/app/${workspaceId}/connectors${pluginQs}`)}`;
                return;
            }
            await createIntegration({
                providerId: selectedType.id,
                displayName: intDisplayName,
                credentials: intCredentials,
                scopes: [],
            });
            showToast("success", `${selectedType.name} connected`);
            closeAddModal();
        } catch (err) {
            setModalError((err as Error).message);
        } finally {
            setSubmitBusy(false);
        }
    };

    const submitMcpServer = async () => {
        setModalError(null);
        if (!mcpDraft.name.trim()) {
            setModalError("Name is required.");
            return;
        }
        if (mcpDraft.transport === "stdio") {
            if (!mcpDraft.command.trim()) {
                setModalError("Command is required for stdio transport.");
                return;
            }
        } else if (!mcpDraft.url.trim()) {
            setModalError("URL is required for remote transports.");
            return;
        }
        setSubmitBusy(true);
        try {
            const env = mcpDraft.envText ? parseKvText(mcpDraft.envText) : undefined;
            const headers = mcpDraft.headersText ? parseKvText(mcpDraft.headersText) : undefined;
            const args = mcpDraft.args ? mcpDraft.args.split(/\s+/).filter(Boolean) : undefined;
            await createMcpServer({
                name: mcpDraft.name.trim(),
                transport: mcpDraft.transport,
                command: mcpDraft.transport === "stdio" ? mcpDraft.command.trim() : undefined,
                args: mcpDraft.transport === "stdio" ? args : undefined,
                env,
                url: mcpDraft.transport !== "stdio" ? mcpDraft.url.trim() : undefined,
                headers: mcpDraft.transport !== "stdio" ? headers : undefined,
                enabled: mcpDraft.enabled,
            });
            showToast("success", "MCP server added");
            closeAddModal();
        } catch (err) {
            setModalError((err as Error).message);
        } finally {
            setSubmitBusy(false);
        }
    };

    /** Modal `title` is the small mono line; `subtitle` is the prominent headline (matches Skills editor). */
    const modalTitle = "Add connection";
    const modalSubtitle =
        addTab === "mcp"
            ? "MCP server"
            : intPhase === "configure" && selectedType
              ? `Connect ${selectedType.name}`
              : "SaaS integration";

    const integrationCount = integrations.length;
    const mcpCount = mcpServers.length;

    return (
        <div className="flex h-full min-h-0 flex-col bg-bg-app">
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                        <Link2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-text-primary">Connectors</h1>
                        <p className="text-sm text-text-muted">
                            {plugin
                                ? `Services for the ${plugin.name} plugin, plus MCP servers for this workspace.`
                                : "SaaS credentials and custom MCP servers available to the agent here."}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-text-muted">
                    <Link
                        href={`/app/${workspaceId}/plugins`}
                        className="text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                    >
                        Plugins
                    </Link>
                    <Link
                        href={`/app/${workspaceId}/skills`}
                        className="text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                    >
                        Skills
                    </Link>
                    <span className="text-right">
                        <span className="font-medium text-status-success-text">
                            {statusSummary.saasActive} active
                        </span>{" "}
                        SaaS
                        {statusSummary.saasAttention > 0 ? (
                            <>
                                {" "}
                                ·{" "}
                                <span className="font-medium text-status-warning-text">
                                    {statusSummary.saasAttention} need attention
                                </span>
                            </>
                        ) : null}
                        <br />
                        <span className="font-medium text-status-success-text">
                            {statusSummary.mcpReady} ready
                        </span>{" "}
                        MCP · {statusSummary.mcpEnabled} on · {statusSummary.mcpDisabled} off
                    </span>
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 scrollbar-elegant">
                {pageWorkspace ? (
                    <Panel className="border border-border-subtle bg-bg-elevated/80 p-4">
                        <div className="flex gap-3">
                            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
                            <div className="space-y-1 text-sm">
                                <p className="font-medium text-text-primary">
                                    Workspace:{" "}
                                    <span className="text-text-primary">{pageWorkspace.name}</span>
                                </p>
                                <p className="text-xs text-text-muted">
                                    Use <span className="font-medium text-text-secondary">Add connection</span>{" "}
                                    for both catalog integrations and MCP servers. Remote MCP tools appear as{" "}
                                    <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-[10px]">
                                        slug__tool_name
                                    </code>{" "}
                                    after you run discover on the server card.
                                </p>
                            </div>
                        </div>
                    </Panel>
                ) : (
                    <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-4">
                        <p className="text-sm text-text-primary">
                            <span className="font-medium">Workspace unavailable.</span> Select a workspace in
                            the shell to manage connectors.
                        </p>
                    </Panel>
                )}

                {plugin && (
                    <Panel className="border border-border-subtle bg-bg-surface/80 p-4">
                        <p className="text-sm text-text-secondary">
                            Showing catalog entries for{" "}
                            <span className="font-medium text-text-primary">{plugin.name}</span>.{" "}
                            <Link
                                href={`/app/${workspaceId}/connectors`}
                                className="text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                            >
                                Show all connectors
                            </Link>
                        </p>
                    </Panel>
                )}

                {toast && (
                    <Panel
                        className={
                            toast.kind === "success"
                                ? "border border-status-success-border bg-status-success-bg/25 p-3"
                                : "border border-status-error-border bg-status-error-bg/30 p-3"
                        }
                    >
                        <p
                            className={
                                toast.kind === "success"
                                    ? "text-xs text-status-success-text"
                                    : "text-xs text-status-error-text"
                            }
                        >
                            {toast.text}
                        </p>
                    </Panel>
                )}

                {(error || typesError) && (
                    <p className="text-xs text-status-error-text">
                        Error: {error ?? typesError}
                    </p>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        leftIcon={Search}
                        placeholder="Search integrations and MCP servers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        fullWidth
                        size="sm"
                        containerClassName="lg:max-w-md"
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openAddModal()}
                        className="inline-flex shrink-0 items-center gap-2 self-start lg:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Add connection
                    </Button>
                </div>

                {!isLoading && !typesLoading && (integrationCount > 0 || mcpCount > 0) && (
                    <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 border-dashed border-border-subtle bg-bg-elevated/50 px-4 py-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                            Status
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="success" size="sm" showIcon uppercase={false}>
                                SaaS active: {statusSummary.saasActive}
                            </Badge>
                            {statusSummary.saasAttention > 0 ? (
                                <Badge variant="warning" size="sm" uppercase={false}>
                                    SaaS check: {statusSummary.saasAttention}
                                </Badge>
                            ) : (
                                <Badge variant="outline" size="sm" uppercase={false}>
                                    SaaS issues: none
                                </Badge>
                            )}
                            <Badge variant={statusSummary.mcpReady > 0 ? "success" : "default"} size="sm" uppercase={false}>
                                MCP tools ready: {statusSummary.mcpReady}
                            </Badge>
                            <Badge variant="default" size="sm" uppercase={false}>
                                MCP on / off: {statusSummary.mcpEnabled} / {statusSummary.mcpDisabled}
                            </Badge>
                        </div>
                    </Panel>
                )}

                <section className="space-y-3">
                    <div>
                        <h2 className="text-sm font-semibold text-text-primary">
                            SaaS integrations ({filteredCatalog.length}{" "}
                            {search.trim() ? "matching" : "in catalog"})
                        </h2>
                        <p className="mt-1 text-xs text-text-muted">
                            Connect apps so the agent can call their APIs or unlock bundled tools. Cards with
                            an <span className="font-medium text-text-secondary">active</span> connection are
                            sorted to the top; the left border is green (healthy) or amber (check accounts).
                        </p>
                    </div>

                    {typesLoading || isLoading ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Panel key={i} className="p-4">
                                    <Skeleton className="mb-2 h-5 w-40" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="mt-3 h-8 w-24" />
                                </Panel>
                            ))}
                        </div>
                    ) : filteredCatalog.length === 0 ? (
                        <EmptyState
                            variant={search.trim() ? "search" : "no-data"}
                            size="sm"
                            title={search.trim() ? "No integrations match" : "No integrations"}
                            description={
                                search.trim()
                                    ? "Try another search term."
                                    : "No catalog entries for this filter."
                            }
                        />
                    ) : (
                        <div className="space-y-8">
                            {catalogGrouped.map(({ category, items }) => (
                                <div key={category}>
                                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        {category}
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {items.map((def) => {
                                            const active = integrations.filter((i) => i.providerId === def.id);
                                            const hasActive = active.some((i) => i.status === "active");
                                            const hasIssue = active.some((i) => i.status !== "active");
                                            const borderAccent =
                                                hasActive
                                                    ? "border-l-status-success-border"
                                                    : hasIssue
                                                      ? "border-l-status-warning-border"
                                                      : "border-l-border-subtle";
                                            return (
                                                <Card
                                                    key={def.id}
                                                    id={`connector-card-${def.id}`}
                                                    variant="default"
                                                    padding="md"
                                                    className={`scroll-mt-4 border-l-4 bg-bg-surface/90 ${borderAccent}`}
                                                >
                                                    <div className="mb-3 flex min-h-[28px] flex-wrap items-center gap-2">
                                                        {active.length === 0 ? (
                                                            <Badge variant="default" size="sm" uppercase={false}>
                                                                Not connected
                                                            </Badge>
                                                        ) : (
                                                            <>
                                                                {hasActive ? (
                                                                    <Badge variant="success" size="sm" showIcon uppercase={false}>
                                                                        Active ({active.filter((i) => i.status === "active").length})
                                                                    </Badge>
                                                                ) : null}
                                                                {hasIssue ? (
                                                                    <Badge variant="warning" size="sm" uppercase={false}>
                                                                        Needs attention ({active.filter((i) => i.status !== "active").length})
                                                                    </Badge>
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-semibold text-text-primary">
                                                                {def.name}
                                                            </h3>
                                                            <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                                                                {def.id} · {def.auth}
                                                            </p>
                                                        </div>
                                                        {def.docsUrl && (
                                                            <a
                                                                href={def.docsUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="shrink-0 rounded-md p-1 text-text-muted transition hover:bg-state-hover hover:text-text-primary"
                                                                title="Documentation"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                                                        {def.description}
                                                    </p>
                                                    {active.length > 0 && (
                                                        <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
                                                            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                                                                Accounts ({active.length})
                                                            </p>
                                                            {active.map((integration) => (
                                                                <div
                                                                    key={integration.id}
                                                                    className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-elevated/80 px-2.5 py-2"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-medium text-text-primary">
                                                                            {integration.displayName}
                                                                        </p>
                                                                        <Badge
                                                                            variant={integrationStatusBadgeVariant(
                                                                                integration.status,
                                                                            )}
                                                                            size="xs"
                                                                            uppercase={false}
                                                                            showIcon={integration.status === "active"}
                                                                        >
                                                                            {integration.status === "active"
                                                                                ? "Active"
                                                                                : integration.status === "revoked"
                                                                                  ? "Revoked"
                                                                                  : "Error"}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex shrink-0 items-center gap-0.5">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0"
                                                                            title="Test credentials"
                                                                            onClick={async () => {
                                                                                const res =
                                                                                    await testIntegration(
                                                                                        integration.id,
                                                                                    );
                                                                                showToast(
                                                                                    res.ok
                                                                                        ? "success"
                                                                                        : "error",
                                                                                    res.message ??
                                                                                        (res.ok
                                                                                            ? "OK"
                                                                                            : "Failed"),
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Play className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-status-error-text"
                                                                            title="Remove"
                                                                            onClick={async () => {
                                                                                if (
                                                                                    !confirm(
                                                                                        `Remove ${integration.displayName}?`,
                                                                                    )
                                                                                )
                                                                                    return;
                                                                                await deleteIntegration(
                                                                                    integration.id,
                                                                                );
                                                                                showToast(
                                                                                    "success",
                                                                                    "Integration removed",
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="mt-4">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                openAddModal({ integration: def })
                                                            }
                                                            className="inline-flex w-full items-center justify-center gap-1.5 sm:w-auto"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Connect
                                                        </Button>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-3">
                    <div>
                        <h2 className="text-sm font-semibold text-text-primary">
                            MCP servers ({filteredMcpServers.length}
                            {search.trim() ? " matching" : ""})
                        </h2>
                        <p className="mt-1 text-xs text-text-muted">
                            External MCP servers (e.g. Hunter via{" "}
                            <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px]">
                                npx mcp-remote
                            </code>
                            ). <span className="font-medium text-text-secondary">On + green border</span> means
                            enabled and discover succeeded. Disabled servers are greyed and listed last.
                        </p>
                    </div>

                    {isLoading ? (
                        <Panel className="p-6">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="mt-3 h-16 w-full" />
                        </Panel>
                    ) : filteredMcpServers.length === 0 ? (
                        <EmptyState
                            variant={search.trim() ? "search" : "default"}
                            size="sm"
                            title={search.trim() ? "No MCP servers match" : "No MCP servers yet"}
                            description={
                                search.trim()
                                    ? "Try another search."
                                    : "Add a stdio command or remote endpoint with Add connection."
                            }
                            action={{
                                label: "Add MCP server",
                                onClick: () => openAddModal({ tab: "mcp" }),
                            }}
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredMcpServersSorted.map((server) => {
                                const mcpReady = server.enabled && server.status === "connected";
                                const mcpBroken = server.enabled && server.status === "error";
                                const mcpPending = server.enabled && server.status === "unknown";
                                const leftBorder =
                                    !server.enabled
                                        ? "border-l-text-muted/30"
                                        : mcpReady
                                          ? "border-l-status-success-border"
                                          : mcpBroken
                                            ? "border-l-status-error-border"
                                            : mcpPending
                                              ? "border-l-status-warning-border"
                                              : "border-l-border-subtle";
                                return (
                                <Card
                                    key={server.id}
                                    variant="default"
                                    padding="md"
                                    className={`border-l-4 bg-bg-surface/90 ${leftBorder} ${!server.enabled ? "opacity-[0.92]" : ""}`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-semibold text-text-primary">
                                                    {server.name}
                                                </h3>
                                                <span className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                                                    {server.slug}
                                                </span>
                                                <span className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted">
                                                    {server.transport}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {!server.enabled ? (
                                                    <>
                                                        <Badge variant="default" size="sm" uppercase={false}>
                                                            Off for agent
                                                        </Badge>
                                                        <span className="text-xs text-text-muted">
                                                            Toggle on so runs can load this server.
                                                        </span>
                                                    </>
                                                ) : mcpReady ? (
                                                    <Badge variant="success" size="sm" showIcon uppercase={false}>
                                                        On · tools discovered ({server.discoveredTools.length})
                                                    </Badge>
                                                ) : mcpBroken ? (
                                                    <Badge variant="error" size="sm" uppercase={false}>
                                                        On · connection failed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="warning" size="sm" uppercase={false}>
                                                        On · run Discover to verify
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={mcpStatusBadgeVariant(server.status)}
                                                    size="xs"
                                                    uppercase={false}
                                                >
                                                    {server.status}
                                                </Badge>
                                            </div>
                                            {server.statusMessage && (
                                                <p className="text-[11px] text-text-muted">
                                                    {server.statusMessage}
                                                </p>
                                            )}
                                            {server.transport === "stdio" ? (
                                                <div className="rounded-lg border border-border-subtle bg-bg-elevated/50 px-3 py-2 font-mono text-[11px] leading-snug text-text-secondary break-all">
                                                    {server.command}{" "}
                                                    {(server.args ?? []).join(" ")}
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-border-subtle bg-bg-elevated/50 px-3 py-2 font-mono text-[11px] text-text-secondary break-all">
                                                    {server.url}
                                                </div>
                                            )}
                                            {server.discoveredTools.length > 0 && (
                                                <details className="text-[11px]">
                                                    <summary className="cursor-pointer font-medium text-text-secondary hover:text-text-primary">
                                                        {server.discoveredTools.length} tools discovered
                                                    </summary>
                                                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pl-3 text-text-muted scrollbar-elegant">
                                                        {server.discoveredTools.map((tool) => (
                                                            <li key={tool.name}>
                                                                <span className="font-mono text-text-secondary">
                                                                    {server.slug}__{tool.name}
                                                                </span>
                                                                {tool.description && (
                                                                    <span className="text-text-muted">
                                                                        {" — "}
                                                                        {tool.description}
                                                                    </span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </details>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-3 self-end sm:self-start">
                                            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/50 px-2.5 py-1.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                                    Agent
                                                </span>
                                                <Switch
                                                    checked={server.enabled}
                                                    onChange={(next) =>
                                                        updateMcpServer(server.id, { enabled: next })
                                                    }
                                                    aria-label={`Enable ${server.name} for the agent`}
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 p-0"
                                                title="Discover tools"
                                                disabled={discoveringId === server.id}
                                                onClick={async () => {
                                                    setDiscoveringId(server.id);
                                                    try {
                                                        const res = await discoverMcpServer(server.id);
                                                        if (res.ok) {
                                                            showToast(
                                                                "success",
                                                                `Discovered ${res.tools?.length ?? 0} tools`,
                                                            );
                                                        } else {
                                                            showToast(
                                                                "error",
                                                                res.error ?? "Discover failed",
                                                            );
                                                        }
                                                    } finally {
                                                        setDiscoveringId(null);
                                                    }
                                                }}
                                            >
                                                <RefreshCw
                                                    className={`h-4 w-4 ${discoveringId === server.id ? "animate-spin" : ""}`}
                                                />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 p-0 text-status-error-text"
                                                title="Delete server"
                                                onClick={async () => {
                                                    if (!confirm(`Delete ${server.name}?`)) return;
                                                    await deleteMcpServer(server.id);
                                                    showToast("success", "MCP server removed");
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <Modal
                open={addOpen}
                onClose={closeAddModal}
                title={modalTitle}
                subtitle={modalSubtitle}
                footer={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-h-[36px] text-[11px] text-text-muted">
                            {addTab === "integration" && intPhase === "browse" && (
                                <span>Select a provider below, or switch tab for MCP.</span>
                            )}
                            {addTab === "integration" && intPhase === "configure" && selectedType && (
                                <span>
                                    {selectedType.auth === "oauth"
                                        ? "You will return here after authorizing."
                                        : "Secrets are encrypted for this workspace only."}
                                </span>
                            )}
                            {addTab === "mcp" && (
                                <span>stdio runs where the app server runs (e.g. your laptop or VM).</span>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="secondary" onClick={closeAddModal} disabled={submitBusy}>
                                Cancel
                            </Button>
                            {addTab === "integration" && intPhase === "configure" && selectedType && (
                                <Button variant="primary" onClick={submitIntegration} disabled={submitBusy}>
                                    {submitBusy
                                        ? "Working…"
                                        : selectedType.auth === "oauth"
                                          ? "Continue with OAuth"
                                          : "Connect"}
                                </Button>
                            )}
                            {addTab === "mcp" && (
                                <Button variant="primary" onClick={submitMcpServer} disabled={submitBusy}>
                                    {submitBusy ? "Adding…" : "Add MCP server"}
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                <div className="space-y-4">
                    {modalError && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{modalError}</p>
                        </Panel>
                    )}

                    <Tabs
                        defaultValue="integration"
                        value={addTab}
                        onValueChange={(v) => {
                            setAddTab(v as "integration" | "mcp");
                            setModalError(null);
                        }}
                        variant="underline"
                    >
                        <TabsList className="mb-1 w-full sm:w-auto">
                            <TabTrigger value="integration">SaaS integration</TabTrigger>
                            <TabTrigger value="mcp">MCP server</TabTrigger>
                        </TabsList>

                        <TabContent value="integration">
                            {intPhase === "browse" ? (
                                <div className="space-y-3">
                                    <Input
                                        leftIcon={Search}
                                        placeholder="Search providers…"
                                        value={intBrowseQuery}
                                        onChange={(e) => setIntBrowseQuery(e.target.value)}
                                        fullWidth
                                        size="sm"
                                    />
                                    <div className="max-h-[min(50vh,22rem)] space-y-1 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated/40 p-1 scrollbar-elegant">
                                        {modalBrowseFiltered.map((def) => (
                                            <button
                                                key={def.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedType(def);
                                                    setIntPhase("configure");
                                                    const creds: Record<string, string> = {};
                                                    for (const f of def.credentialFields ?? [])
                                                        creds[f.key] = "";
                                                    setIntCredentials(creds);
                                                    setIntDisplayName(def.name);
                                                    setModalError(null);
                                                }}
                                                className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-left transition hover:bg-state-hover"
                                            >
                                                <span className="text-sm font-medium text-text-primary">
                                                    {def.name}
                                                </span>
                                                <span className="font-mono text-[10px] text-text-muted">
                                                    {def.id} · {def.auth}
                                                </span>
                                                <span className="line-clamp-2 text-[11px] text-text-secondary">
                                                    {def.description}
                                                </span>
                                            </button>
                                        ))}
                                        {modalBrowseFiltered.length === 0 && (
                                            <p className="px-3 py-8 text-center text-xs text-text-muted">
                                                No providers match this search.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                selectedType && (
                                    <div className="space-y-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="-mt-1 inline-flex items-center gap-1.5 px-0 text-text-secondary hover:text-text-primary"
                                            onClick={() => {
                                                setIntPhase("browse");
                                                setSelectedType(null);
                                                setModalError(null);
                                            }}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            All providers
                                        </Button>

                                        {selectedType.auth === "oauth" ? (
                                            <Panel className="border border-border-subtle bg-bg-elevated/60 p-4">
                                                <p className="text-sm text-text-secondary">
                                                    You will be redirected to {selectedType.name} to authorize
                                                    Kletron. When finished, you will return to this workspace.
                                                </p>
                                            </Panel>
                                        ) : (
                                            <>
                                                <Field label="Display name">
                                                    <Input
                                                        value={intDisplayName}
                                                        onChange={(e) =>
                                                            setIntDisplayName(e.target.value)
                                                        }
                                                        fullWidth
                                                        size="sm"
                                                    />
                                                </Field>
                                                {(selectedType.credentialFields ?? []).map((field) => (
                                                    <Field key={field.key} label={field.label}>
                                                        <Input
                                                            type={field.secret ? "password" : "text"}
                                                            placeholder={field.placeholder}
                                                            value={intCredentials[field.key] ?? ""}
                                                            onChange={(e) =>
                                                                setIntCredentials({
                                                                    ...intCredentials,
                                                                    [field.key]: e.target.value,
                                                                })
                                                            }
                                                            fullWidth
                                                            size="sm"
                                                            className={field.secret ? "font-mono" : ""}
                                                        />
                                                        {field.help && (
                                                            <p className="mt-1 text-[11px] text-text-muted">
                                                                {field.help}
                                                            </p>
                                                        )}
                                                    </Field>
                                                ))}
                                            </>
                                        )}

                                        {selectedType.docsUrl && (
                                            <a
                                                href={selectedType.docsUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                {selectedType.name} documentation
                                            </a>
                                        )}
                                    </div>
                                )
                            )}
                        </TabContent>

                        <TabContent value="mcp">
                            <div className="space-y-4">
                                <Field label="Display name">
                                    <Input
                                        value={mcpDraft.name}
                                        onChange={(e) =>
                                            setMcpDraft({ ...mcpDraft, name: e.target.value })
                                        }
                                        placeholder="e.g. Hunter"
                                        fullWidth
                                        size="sm"
                                    />
                                </Field>

                                <Selector
                                    label="Transport"
                                    value={mcpDraft.transport}
                                    options={MCP_TRANSPORT_OPTIONS}
                                    onSelect={(id) =>
                                        setMcpDraft({
                                            ...mcpDraft,
                                            transport: id as McpServerTransport,
                                        })
                                    }
                                    fullWidth
                                    size="sm"
                                    direction="down"
                                />

                                {mcpDraft.transport === "stdio" ? (
                                    <>
                                        <Field label="Command">
                                            <Input
                                                value={mcpDraft.command}
                                                onChange={(e) =>
                                                    setMcpDraft({ ...mcpDraft, command: e.target.value })
                                                }
                                                placeholder="npx"
                                                fullWidth
                                                size="sm"
                                                className="font-mono"
                                            />
                                        </Field>
                                        <Field label="Arguments (space-separated)">
                                            <Input
                                                value={mcpDraft.args}
                                                onChange={(e) =>
                                                    setMcpDraft({ ...mcpDraft, args: e.target.value })
                                                }
                                                placeholder="mcp-remote https://… --header X-API-KEY:…"
                                                fullWidth
                                                size="sm"
                                                className="font-mono text-xs"
                                            />
                                        </Field>
                                        <Field label="Environment (optional)">
                                            <Textarea
                                                value={mcpDraft.envText}
                                                onChange={(e) =>
                                                    setMcpDraft({ ...mcpDraft, envText: e.target.value })
                                                }
                                                placeholder={"KEY=value\n# comments allowed"}
                                                rows={4}
                                                className="font-mono text-xs"
                                            />
                                        </Field>
                                    </>
                                ) : (
                                    <>
                                        <Field label="URL">
                                            <Input
                                                value={mcpDraft.url}
                                                onChange={(e) =>
                                                    setMcpDraft({ ...mcpDraft, url: e.target.value })
                                                }
                                                placeholder="https://example.com/sse"
                                                fullWidth
                                                size="sm"
                                                className="font-mono text-xs"
                                            />
                                        </Field>
                                        <Field label="Headers (optional)">
                                            <Textarea
                                                value={mcpDraft.headersText}
                                                onChange={(e) =>
                                                    setMcpDraft({
                                                        ...mcpDraft,
                                                        headersText: e.target.value,
                                                    })
                                                }
                                                placeholder={"Authorization=Bearer …\nX-API-KEY=…"}
                                                rows={4}
                                                className="font-mono text-xs"
                                            />
                                        </Field>
                                    </>
                                )}

                                <Checkbox
                                    checked={mcpDraft.enabled}
                                    onChange={(checked) =>
                                        setMcpDraft({ ...mcpDraft, enabled: checked })
                                    }
                                    label="Enabled"
                                    description="When off, the agent will not load this server."
                                    size="sm"
                                />

                                <Panel className="border border-border-subtle bg-bg-elevated/50 p-3">
                                    <p className="text-[11px] leading-relaxed text-text-muted">
                                        stdio runs on the machine hosting the web app (local dev or your
                                        server). For providers that require headers on a remote URL, prefer{" "}
                                        <span className="font-mono text-text-secondary">npx mcp-remote</span>{" "}
                                        with stdio.
                                    </p>
                                </Panel>
                            </div>
                        </TabContent>
                    </Tabs>
                </div>
            </Modal>
        </div>
    );
}
