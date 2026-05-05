"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
    Building2,
    ExternalLink,
    Link2,
    Pencil,
    Plug,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import {
    getConnectorType,
    getPlugin,
    type ConnectorWorkspaceBindingRow,
    type ConnectorIntegrationStatus,
    type ConnectorTypeDefinition,
    type McpServerProbeInput,
    type McpServerTransport,
    type McpServerUpdateInput,
    type WorkspaceIntegrationSummary,
    type WorkspaceMcpServerSummary,
} from "@kletron/shared";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import {
    fetchAccountConnectorWorkspaceBindings,
    putAccountConnectorWorkspaceBindings,
    useConnectorCatalog,
    useWorkspaceConnectors,
} from "../../hooks/useConnectors";

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

function recordToKvText(rec?: Record<string, string>): string {
    if (!rec) return "";
    const entries = Object.entries(rec).filter(([, v]) => v !== undefined && String(v).length > 0);
    if (entries.length === 0) return "";
    return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

function buildMcpProbeBodyFromDraft(draft: {
    transport: McpServerTransport;
    command: string;
    args: string;
    envText: string;
    url: string;
    headersText: string;
}): { ok: true; body: McpServerProbeInput } | { ok: false; error: string } {
    if (draft.transport === "stdio") {
        if (!draft.command.trim()) {
            return { ok: false, error: "Command is required for stdio transport." };
        }
        return {
            ok: true,
            body: {
                transport: "stdio",
                command: draft.command.trim(),
                args: draft.args.trim() ? draft.args.split(/\s+/).filter(Boolean) : undefined,
                env: draft.envText.trim() ? parseKvText(draft.envText) : undefined,
            },
        };
    }
    if (!draft.url.trim()) {
        return { ok: false, error: "URL is required for remote transports." };
    }
    return {
        ok: true,
        body: {
            transport: draft.transport,
            url: draft.url.trim(),
            headers: draft.headersText.trim() ? parseKvText(draft.headersText) : undefined,
        },
    };
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

function catalogUnlockedToolCount(providerId: string): number {
    return getConnectorType(providerId)?.unlocksTools?.length ?? 0;
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
    const pathname = usePathname();
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
        probeMcpServerDraft,
        applyConnectorBindings,
        refresh,
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

    const [editOpen, setEditOpen] = useState(false);
    const [editingServerId, setEditingServerId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState(blankMcpDraft);
    const [editModalError, setEditModalError] = useState<string | null>(null);
    const [editSubmitBusy, setEditSubmitBusy] = useState(false);
    const [editProbeBusy, setEditProbeBusy] = useState(false);
    const [editProbeOutcome, setEditProbeOutcome] = useState<
        | null
        | { kind: "success"; tools: Array<{ name: string; description?: string }> }
        | { kind: "error"; message: string }
    >(null);

    const [bindingsModal, setBindingsModal] = useState<{
        kind: "mcp_server" | "integration";
        refId: string;
        title: string;
    } | null>(null);
    const [bindingsRows, setBindingsRows] = useState<ConnectorWorkspaceBindingRow[]>([]);
    const [bindingsLoading, setBindingsLoading] = useState(false);
    const [bindingsSaving, setBindingsSaving] = useState(false);
    const [bindingsError, setBindingsError] = useState<string | null>(null);

    const closeBindingsModal = useCallback(() => {
        setBindingsModal(null);
        setBindingsRows([]);
        setBindingsError(null);
        setBindingsLoading(false);
        setBindingsSaving(false);
    }, []);

    useEffect(() => {
        if (!bindingsModal) {
            setBindingsRows([]);
            setBindingsError(null);
            return;
        }
        const ac = new AbortController();
        setBindingsLoading(true);
        setBindingsError(null);
        void (async () => {
            try {
                const rows = await fetchAccountConnectorWorkspaceBindings(
                    bindingsModal.kind,
                    bindingsModal.refId,
                    ac.signal,
                );
                if (!ac.signal.aborted) setBindingsRows(rows);
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                if (!ac.signal.aborted) setBindingsError((err as Error).message);
            } finally {
                if (!ac.signal.aborted) setBindingsLoading(false);
            }
        })();
        return () => ac.abort();
    }, [bindingsModal]);

    const showToast = useCallback((kind: "success" | "error", text: string) => {
        setToast({ kind, text });
    }, []);

    useEffect(() => {
        const connectedProvider = searchParams?.get("connected");
        const connectError = searchParams?.get("connect_error");
        if (!connectedProvider && !connectError) {
            return;
        }

        if (connectError) {
            showToast("error", connectError);
        } else if (connectedProvider) {
            const label = getConnectorType(connectedProvider)?.name ?? connectedProvider;
            showToast("success", `${label} connected`);
        }

        const next = new URLSearchParams(searchParams?.toString() ?? "");
        next.delete("connected");
        next.delete("connect_error");
        const query = next.toString();
        window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    }, [pathname, searchParams, showToast]);

    const saveWorkspaceBindings = async () => {
        if (!bindingsModal) return;
        setBindingsSaving(true);
        setBindingsError(null);
        try {
            await putAccountConnectorWorkspaceBindings(
                bindingsModal.kind,
                bindingsModal.refId,
                bindingsRows.map((r) => ({ workspaceId: r.workspaceId, enabled: r.enabled })),
            );
            showToast("success", "Workspace availability saved");
            closeBindingsModal();
            await refresh({ force: true });
        } catch (err) {
            setBindingsError((err as Error).message);
        } finally {
            setBindingsSaving(false);
        }
    };

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

    const filteredMcpServersSorted = useMemo(() => {
        return [...filteredMcpServers].sort((a, b) => {
            const d = mcpListSortKey(b) - mcpListSortKey(a);
            if (d !== 0) return d;
            return a.name.localeCompare(b.name);
        });
    }, [filteredMcpServers]);

    const filteredIntegrations = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return integrations;
        return integrations.filter(
            (i) =>
                i.displayName.toLowerCase().includes(q) ||
                i.providerId.toLowerCase().includes(q),
        );
    }, [integrations, search]);

    /** Flat catalog for browse grid (no category bands — fewer scan jumps). */
    const browseCatalogFlat = useMemo(() => {
        return sortCatalogDefs(filteredCatalog, integrations);
    }, [filteredCatalog, integrations]);

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
                window.location.href = `/api/auth/connect/${selectedType.id}?workspaceId=${workspaceId}&redirect=${encodeURIComponent(`/app/config/connectors${pluginQs}`)}`;
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

    const openEditMcpServer = useCallback((server: WorkspaceMcpServerSummary) => {
        setEditingServerId(server.id);
        setEditDraft({
            name: server.name,
            transport: server.transport,
            command: server.command ?? "",
            args: (server.args ?? []).join(" "),
            envText: recordToKvText(server.env),
            url: server.url ?? "",
            headersText: recordToKvText(server.headers),
            enabled: server.enabled,
        });
        setEditModalError(null);
        setEditProbeOutcome(null);
        setEditProbeBusy(false);
        setEditOpen(true);
    }, []);

    const closeEditMcpServer = useCallback(() => {
        setEditOpen(false);
        setEditingServerId(null);
        setEditDraft({ ...blankMcpDraft });
        setEditModalError(null);
        setEditSubmitBusy(false);
        setEditProbeBusy(false);
        setEditProbeOutcome(null);
    }, []);

    const runEditMcpProbe = useCallback(async () => {
        setEditProbeOutcome(null);
        setEditModalError(null);
        const built = buildMcpProbeBodyFromDraft(editDraft);
        if (!built.ok) {
            setEditProbeOutcome({ kind: "error", message: built.error });
            return;
        }
        setEditProbeBusy(true);
        try {
            const res = await probeMcpServerDraft(built.body);
            if (res.ok) {
                const tools = res.tools ?? [];
                setEditProbeOutcome({ kind: "success", tools });
                showToast("success", `Connection OK — ${tools.length} tool(s)`);
            } else {
                setEditProbeOutcome({ kind: "error", message: res.error });
            }
        } catch (err) {
            setEditProbeOutcome({ kind: "error", message: (err as Error).message });
        } finally {
            setEditProbeBusy(false);
        }
    }, [editDraft, probeMcpServerDraft, showToast]);

    const submitEditMcpServer = async () => {
        if (!editingServerId) return;
        setEditModalError(null);
        if (!editDraft.name.trim()) {
            setEditModalError("Name is required.");
            return;
        }
        if (editDraft.transport === "stdio") {
            if (!editDraft.command.trim()) {
                setEditModalError("Command is required for stdio transport.");
                return;
            }
        } else if (!editDraft.url.trim()) {
            setEditModalError("URL is required for remote transports.");
            return;
        }
        setEditSubmitBusy(true);
        try {
            const payload: McpServerUpdateInput = {
                name: editDraft.name.trim(),
                transport: editDraft.transport,
            };
            if (editDraft.transport === "stdio") {
                payload.command = editDraft.command.trim();
                payload.args = editDraft.args.trim()
                    ? editDraft.args.split(/\s+/).filter(Boolean)
                    : [];
                payload.env = editDraft.envText.trim() ? parseKvText(editDraft.envText) : {};
            } else {
                payload.url = editDraft.url.trim();
                payload.headers = editDraft.headersText.trim()
                    ? parseKvText(editDraft.headersText)
                    : {};
            }
            await updateMcpServer(editingServerId, payload);
            showToast("success", "MCP server updated");
            closeEditMcpServer();
        } catch (err) {
            setEditModalError((err as Error).message);
        } finally {
            setEditSubmitBusy(false);
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
        <div className="flex h-full flex-col overflow-hidden bg-bg-app">
            {/* Match apps/web/app/app/config/channels/page.tsx chrome */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-4">
                    <Link href="/app/agent">
                        <button
                            type="button"
                            className="flex items-center justify-center rounded-md p-2 text-text-muted transition-colors hover:bg-bg-component-hover hover:text-text-primary"
                            aria-label="Back to Agent"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </Link>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-main/10 text-primary-main">
                            <Link2 className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-lg font-semibold text-text-primary">Connectors</h1>
                            <p className="text-sm text-text-muted">
                                {pageWorkspace ? (
                                    <>
                                        Credentials live on your account (shared across workspaces).{" "}
                                        <span className="font-medium text-text-secondary">
                                            {pageWorkspace.name}
                                        </span>
                                        {" · "}
                                        Use each switch to enable a connector for this workspace only.
                                    </>
                                ) : (
                                    <span className="text-status-warning-text">No workspace selected</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <Link
                        href="/app/plugins"
                        className="text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                    >
                        Plugins
                    </Link>
                    <span className="text-sm text-text-muted/50" aria-hidden>
                        ·
                    </span>
                    <Link
                        href="/app/skills"
                        className="text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                    >
                        Skills
                    </Link>
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openAddModal()}
                        className="inline-flex items-center gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add connector
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-elegant">
                <div className="w-full px-6 py-6 lg:px-8">
                    <div className="flex w-full min-w-0 flex-col gap-8">
                {plugin && (
                    <p className="text-[11px] text-text-muted">
                        Catalog limited to{" "}
                        <span className="font-medium text-text-secondary">{plugin.name}</span>.{" "}
                        <Link
                            href="/app/config/connectors"
                            className="underline-offset-2 hover:text-text-primary hover:underline"
                        >
                            Show all
                        </Link>
                    </p>
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

                {pageWorkspace ? (
                    <Panel className="border border-border-subtle bg-bg-surface/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            How to use this page
                        </p>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-snug text-text-secondary">
                            <li>
                                <span className="font-medium text-text-primary">Add</span> a SaaS integration or MCP
                                server (credentials are stored on your account).
                            </li>
                            <li>
                                Use each <span className="font-medium text-text-primary">workspace switch</span> so
                                only this workspace ({pageWorkspace.name}) can use that connector.
                            </li>
                            <li>
                                For <span className="font-medium text-text-primary">MCP</span>: open{" "}
                                <span className="font-medium text-text-primary">Discover</span> once the server is on —
                                tools show up as{" "}
                                <code className="rounded bg-bg-elevated px-1 font-mono text-[10px]">slug__tool</code>{" "}
                                for the agent.
                            </li>
                            <li>
                                For <span className="font-medium text-text-primary">SaaS</span>: the green{" "}
                                <span className="font-medium text-text-primary">tools</span> badge counts catalog
                                agent tools for that provider. Click{" "}
                                <span className="font-medium text-text-primary">Verify</span> to check credentials.
                            </li>
                        </ol>
                    </Panel>
                ) : null}

                {(error || typesError) && (
                    <p className="text-xs text-status-error-text">
                        Error: {error ?? typesError}
                    </p>
                )}

                <section className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Connected for this workspace
                            </h2>
                            <p className="mt-0.5 max-w-xl text-[10px] text-text-muted">
                                Switches control whether the agent may use each connector here. SaaS rows show how many
                                bundled agent tools the catalog attaches; MCP uses Discover to load tools from the
                                server.
                            </p>
                        </div>
                        <span className="text-[10px] tabular-nums text-text-muted">
                            {statusSummary.saasActive} SaaS · {statusSummary.mcpEnabled} MCP on ·{" "}
                            {statusSummary.mcpReady} ready
                        </span>
                    </div>

                    {!pageWorkspace ? (
                        <Panel className="border border-status-warning-border bg-status-warning-bg/30 p-3">
                            <p className="text-xs text-text-primary">Select a workspace in the shell.</p>
                        </Panel>
                    ) : isLoading ? (
                        <Panel className="p-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="mt-2 h-14 w-full" />
                        </Panel>
                    ) : integrationCount === 0 && mcpCount === 0 ? (
                        <EmptyState
                            variant="default"
                            size="sm"
                            title="No connectors yet"
                            description="Use Add to connect SaaS or add an MCP server, turn on the workspace switch, then Discover for MCP or Verify for SaaS."
                            action={{ label: "Add connector", onClick: () => openAddModal() }}
                        />
                    ) : (
                        <div className="space-y-4">
                            {integrationCount > 0 && filteredIntegrations.length === 0 ? (
                                <p className="text-[11px] text-text-muted">
                                    No SaaS accounts match the filter below.
                                </p>
                            ) : null}
                            {filteredIntegrations.length > 0 ? (
                                <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface/80">
                                    <ul className="divide-y divide-border-subtle">
                                        {filteredIntegrations.map((integration) => {
                                            const saasToolCount = catalogUnlockedToolCount(integration.providerId);
                                            return (
                                            <li
                                                key={integration.id}
                                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-text-primary">
                                                        {integration.displayName}
                                                    </p>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                        <span className="font-mono text-[10px] text-text-muted">
                                                            {integration.providerId}
                                                        </span>
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
                                                        {saasToolCount > 0 ? (
                                                            <Badge
                                                                variant="success"
                                                                size="xs"
                                                                uppercase={false}
                                                                showIcon
                                                            >
                                                                {saasToolCount}{" "}
                                                                {saasToolCount === 1 ? "tool" : "tools"}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    {integration.accountIntegrationId != null &&
                                                    integration.enabledWorkspaceCount != null &&
                                                    integration.enabledWorkspaceCount > 0 ? (
                                                        <p className="mt-1 text-[10px] text-text-muted">
                                                            Active on {integration.enabledWorkspaceCount}{" "}
                                                            {integration.enabledWorkspaceCount === 1
                                                                ? "workspace"
                                                                : "workspaces"}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    {integration.accountIntegrationId ? (
                                                        <>
                                                            <Switch
                                                                checked={
                                                                    integration.workspaceBindingEnabled === true
                                                                }
                                                                onChange={(next) => {
                                                                    void (async () => {
                                                                        try {
                                                                            await applyConnectorBindings([
                                                                                {
                                                                                    kind: "integration",
                                                                                    refId: integration.id,
                                                                                    enabled: next,
                                                                                },
                                                                            ]);
                                                                        } catch (err) {
                                                                            showToast(
                                                                                "error",
                                                                                (err as Error).message,
                                                                            );
                                                                        }
                                                                    })();
                                                                }}
                                                                aria-label={`Use ${integration.displayName} in this workspace`}
                                                            />
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="h-8 shrink-0 gap-1 px-2 text-[11px]"
                                                                title="Choose which workspaces may use this connector"
                                                                onClick={() =>
                                                                    setBindingsModal({
                                                                        kind: "integration",
                                                                        refId: integration.id,
                                                                        title: integration.displayName,
                                                                    })
                                                                }
                                                            >
                                                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                                Workspaces
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 shrink-0 gap-1 px-2 text-[11px]"
                                                        title="Check that saved credentials can reach the provider"
                                                        onClick={() => {
                                                            void (async () => {
                                                                const res = await testIntegration(integration.id);
                                                                showToast(
                                                                    res.ok ? "success" : "error",
                                                                    res.message ??
                                                                        (res.ok ? "OK" : "Failed"),
                                                                );
                                                            })();
                                                        }}
                                                    >
                                                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                        Verify
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-status-error-text"
                                                        title={
                                                            integration.accountIntegrationId
                                                                ? "Remove from this workspace (library entry stays)"
                                                                : "Remove"
                                                        }
                                                        onClick={() => {
                                                            void (async () => {
                                                                const msg = integration.accountIntegrationId
                                                                    ? `Remove ${integration.displayName} from this workspace? It stays in your account library.`
                                                                    : `Remove ${integration.displayName}?`;
                                                                if (!confirm(msg)) return;
                                                                await deleteIntegration(integration.id);
                                                                showToast("success", "Integration removed");
                                                            })();
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : null}

                            {mcpCount > 0 && filteredMcpServers.length === 0 ? (
                                <p className="text-[11px] text-text-muted">
                                    No MCP servers match the filter below.
                                </p>
                            ) : null}

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
                                        padding="sm"
                                        className={`border-l-4 bg-bg-surface/90 ${leftBorder} ${!server.enabled ? "opacity-[0.92]" : ""}`}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-text-primary">
                                                        {server.name}
                                                    </h3>
                                                    <span className="rounded border border-border-subtle bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                                                        {server.slug}
                                                    </span>
                                                    <span className="text-[10px] text-text-muted">
                                                        {server.transport}
                                                    </span>
                                                    {!server.enabled ? (
                                                        <Badge variant="default" size="xs" uppercase={false}>
                                                            Off
                                                        </Badge>
                                                    ) : mcpReady ? (
                                                        <Badge
                                                            variant="success"
                                                            size="xs"
                                                            showIcon
                                                            uppercase={false}
                                                        >
                                                            {server.discoveredTools.length} tools
                                                        </Badge>
                                                    ) : mcpBroken ? (
                                                        <Badge variant="error" size="xs" uppercase={false}>
                                                            Error
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="warning" size="xs" uppercase={false}>
                                                            Discover
                                                        </Badge>
                                                    )}
                                                </div>
                                                {server.statusMessage ? (
                                                    <p className="text-[10px] text-text-muted">
                                                        {server.statusMessage}
                                                    </p>
                                                ) : null}
                                                {server.accountServerId != null &&
                                                server.enabledWorkspaceCount != null &&
                                                server.enabledWorkspaceCount > 0 ? (
                                                    <p className="text-[10px] text-text-muted">
                                                        Active on {server.enabledWorkspaceCount}{" "}
                                                        {server.enabledWorkspaceCount === 1
                                                            ? "workspace"
                                                            : "workspaces"}
                                                    </p>
                                                ) : null}
                                                <details className="text-[10px] text-text-muted">
                                                    <summary className="cursor-pointer select-none hover:text-text-secondary">
                                                        Command / URL
                                                    </summary>
                                                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-bg-elevated/80 p-2 font-mono text-[10px] text-text-secondary">
                                                        {server.transport === "stdio"
                                                            ? `${server.command ?? ""} ${(server.args ?? []).join(" ")}`.trim()
                                                            : (server.url ?? "")}
                                                    </pre>
                                                </details>
                                                {server.discoveredTools.length > 0 ? (
                                                    <details className="text-[10px]">
                                                        <summary className="cursor-pointer select-none text-text-muted hover:text-text-secondary">
                                                            {server.discoveredTools.length} tools
                                                        </summary>
                                                        <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto pl-3 font-mono text-[10px] text-text-secondary scrollbar-elegant">
                                                            {server.discoveredTools.map((tool) => (
                                                                <li key={tool.name}>
                                                                    {server.slug}__{tool.name}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                ) : null}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Switch
                                                    checked={server.enabled}
                                                    onChange={(next) => {
                                                        void updateMcpServer(server.id, { enabled: next });
                                                    }}
                                                    aria-label={`Enable ${server.name}`}
                                                />
                                                {server.accountServerId ? (
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 shrink-0 gap-1 px-2 text-[11px]"
                                                        title="Choose which workspaces may use this MCP server"
                                                        onClick={() =>
                                                            setBindingsModal({
                                                                kind: "mcp_server",
                                                                refId: server.id,
                                                                title: server.name,
                                                            })
                                                        }
                                                    >
                                                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                        Workspaces
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Edit MCP connection"
                                                    onClick={() => openEditMcpServer(server)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 shrink-0 gap-1 px-2 text-[11px]"
                                                    title="Connect to the MCP server and list tools (required before slug__tool appears in the agent)"
                                                    disabled={discoveringId === server.id}
                                                    onClick={() => {
                                                        void (async () => {
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
                                                        })();
                                                    }}
                                                >
                                                    <RefreshCw
                                                        className={`h-3.5 w-3.5 shrink-0 ${discoveringId === server.id ? "animate-spin" : ""}`}
                                                    />
                                                    Discover
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-status-error-text"
                                                    title="Delete server"
                                                    onClick={() => {
                                                        void (async () => {
                                                            if (!confirm(`Delete ${server.name}?`)) return;
                                                            await deleteMcpServer(server.id);
                                                            showToast("success", "MCP server removed");
                                                        })();
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="space-y-4 border-t border-border-subtle pt-8">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Browse catalog
                            </h2>
                            <p className="mt-0.5 max-w-lg text-[10px] leading-snug text-text-muted">
                                Pick a provider and <span className="font-medium text-text-secondary">Connect</span>.
                                For MCP added below, names become agent tools as{" "}
                                <code className="rounded bg-bg-elevated px-1 font-mono text-[10px]">
                                    slug__tool
                                </code>{" "}
                                after you run <span className="font-medium text-text-secondary">Discover</span>.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                            <Input
                                leftIcon={Search}
                                placeholder="Filter catalog & connected…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                fullWidth
                                size="sm"
                                containerClassName="sm:min-w-[220px] lg:max-w-xs"
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openAddModal({ tab: "mcp" })}
                                className="inline-flex shrink-0 items-center gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                MCP only
                            </Button>
                        </div>
                    </div>

                    {typesLoading || isLoading ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                                <Panel key={i} className="p-3">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="mt-2 h-6 w-full" />
                                </Panel>
                            ))}
                        </div>
                    ) : browseCatalogFlat.length === 0 ? (
                        <EmptyState
                            variant={search.trim() ? "search" : "no-data"}
                            size="sm"
                            title={search.trim() ? "No matches" : "No catalog"}
                            description={
                                search.trim() ? "Try another filter." : "No catalog entries for this filter."
                            }
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {browseCatalogFlat.map((def) => {
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
                                        padding="sm"
                                        className={`scroll-mt-4 border-l-4 bg-bg-surface/90 ${borderAccent}`}
                                        title={def.description}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-text-primary">
                                                {def.name}
                                            </h3>
                                            {def.docsUrl ? (
                                                <a
                                                    href={def.docsUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="shrink-0 rounded p-0.5 text-text-muted hover:bg-state-hover hover:text-text-primary"
                                                    title="Docs"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 font-mono text-[9px] text-text-muted">{def.id}</p>
                                        {def.unlocksTools.length > 0 ? (
                                            <p className="mt-1 text-[10px] text-text-secondary">
                                                {def.unlocksTools.length} agent{" "}
                                                {def.unlocksTools.length === 1 ? "tool" : "tools"}
                                            </p>
                                        ) : null}
                                        {active.length > 0 ? (
                                            <details className="mt-2 border-t border-border-subtle pt-2 text-[10px]">
                                                <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
                                                    {active.length} account{active.length > 1 ? "s" : ""}
                                                </summary>
                                                <ul className="mt-1 space-y-1">
                                                    {active.map((integration) => (
                                                        <li
                                                            key={integration.id}
                                                            className="flex items-center justify-between gap-1"
                                                        >
                                                            <span className="truncate text-text-secondary">
                                                                {integration.displayName}
                                                            </span>
                                                            <span className="flex shrink-0 gap-0.5">
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    className="h-7 gap-0.5 px-1.5 text-[10px]"
                                                                    title="Check that credentials still reach the provider"
                                                                    onClick={() => {
                                                                        void (async () => {
                                                                            const res = await testIntegration(
                                                                                integration.id,
                                                                            );
                                                                            showToast(
                                                                                res.ok ? "success" : "error",
                                                                                res.message ??
                                                                                    (res.ok ? "OK" : "Failed"),
                                                                            );
                                                                        })();
                                                                    }}
                                                                >
                                                                    <ShieldCheck className="h-3 w-3 shrink-0" />
                                                                    Verify
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 text-status-error-text"
                                                                    title="Remove"
                                                                    onClick={() => {
                                                                        void (async () => {
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
                                                                                "Removed",
                                                                            );
                                                                        })();
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        ) : null}
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => openAddModal({ integration: def })}
                                            className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 text-[11px]"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Connect
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </section>
                    </div>
                </div>
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
                                <span>
                                    Choose SaaS below, or open the <strong className="font-medium">MCP server</strong>{" "}
                                    tab for CLI or remote HTTP/SSE endpoints.
                                </span>
                            )}
                            {addTab === "integration" && intPhase === "configure" && selectedType && (
                                <span>
                                    {selectedType.auth === "oauth"
                                        ? "After OAuth you land back here — turn the workspace switch on if needed."
                                        : "Secrets are encrypted on your account. Then use Verify on the card to test reachability."}
                                </span>
                            )}
                            {addTab === "mcp" && (
                                <span>
                                    Remote MCP: correct URL + headers (e.g. API key). Then enable for this workspace and
                                    run Discover on the card.
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="secondary" onClick={closeAddModal} disabled={submitBusy}>
                                Cancel
                            </Button>
                            {addTab === "integration" && intPhase === "configure" && selectedType && (
                                <Button
                                    variant="primary"
                                    onClick={() => void submitIntegration()}
                                    disabled={submitBusy}
                                >
                                    {submitBusy
                                        ? "Working…"
                                        : selectedType.auth === "oauth"
                                          ? "Continue with OAuth"
                                          : "Connect"}
                                </Button>
                            )}
                            {addTab === "mcp" && (
                                <Button
                                    variant="primary"
                                    onClick={() => void submitMcpServer()}
                                    disabled={submitBusy}
                                >
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

            <Modal
                open={editOpen}
                onClose={closeEditMcpServer}
                title="Edit MCP server"
                subtitle={editDraft.name || "Connection"}
                footer={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="min-h-[36px] text-[11px] text-text-muted">
                            Remote MCP (e.g. Hunter): use{" "}
                            <span className="font-mono">Streamable HTTP</span> + correct URL and{" "}
                            <span className="font-mono">X-API-KEY</span> — wrong auth → 401.
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={closeEditMcpServer}
                                disabled={editSubmitBusy || editProbeBusy}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => void runEditMcpProbe()}
                                disabled={editSubmitBusy || editProbeBusy}
                                className="inline-flex items-center gap-1.5"
                            >
                                <Plug className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {editProbeBusy ? "Testing…" : "Test connection"}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void submitEditMcpServer()}
                                disabled={editSubmitBusy || editProbeBusy}
                            >
                                {editSubmitBusy ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4">
                    {editModalError && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{editModalError}</p>
                        </Panel>
                    )}
                    {editProbeOutcome?.kind === "success" && (
                        <Panel className="border border-status-success-border bg-status-success-bg/25 p-3">
                            <p className="text-xs font-medium text-status-success-text">
                                Reachable — {editProbeOutcome.tools.length} tool(s). Values are not saved until
                                you click Save; use Discover on the card to persist the tool list after saving.
                            </p>
                            <ul className="mt-2 max-h-36 overflow-y-auto font-mono text-[11px] leading-snug text-text-secondary">
                                {editProbeOutcome.tools.slice(0, 24).map((t) => (
                                    <li key={t.name}>{t.name}</li>
                                ))}
                                {editProbeOutcome.tools.length > 24 && (
                                    <li className="text-text-muted">
                                        …and {editProbeOutcome.tools.length - 24} more
                                    </li>
                                )}
                            </ul>
                        </Panel>
                    )}
                    {editProbeOutcome?.kind === "error" && (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{editProbeOutcome.message}</p>
                        </Panel>
                    )}
                    <Field label="Display name">
                        <Input
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            fullWidth
                            size="sm"
                        />
                    </Field>
                    <Selector
                        label="Transport"
                        value={editDraft.transport}
                        options={MCP_TRANSPORT_OPTIONS}
                        onSelect={(id) =>
                            setEditDraft({
                                ...editDraft,
                                transport: id as McpServerTransport,
                            })
                        }
                        fullWidth
                        size="sm"
                        direction="down"
                    />
                    {editDraft.transport === "stdio" ? (
                        <>
                            <Field label="Command">
                                <Input
                                    value={editDraft.command}
                                    onChange={(e) =>
                                        setEditDraft({ ...editDraft, command: e.target.value })
                                    }
                                    placeholder="npx"
                                    fullWidth
                                    size="sm"
                                    className="font-mono"
                                />
                            </Field>
                            <Field label="Arguments (space-separated)">
                                <Input
                                    value={editDraft.args}
                                    onChange={(e) => setEditDraft({ ...editDraft, args: e.target.value })}
                                    fullWidth
                                    size="sm"
                                    className="font-mono text-xs"
                                />
                            </Field>
                            <Field label="Environment (optional)">
                                <Textarea
                                    value={editDraft.envText}
                                    onChange={(e) =>
                                        setEditDraft({ ...editDraft, envText: e.target.value })
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
                                    value={editDraft.url}
                                    onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                                    fullWidth
                                    size="sm"
                                    className="font-mono text-xs"
                                />
                            </Field>
                            <Field label="Headers (optional)">
                                <Textarea
                                    value={editDraft.headersText}
                                    onChange={(e) =>
                                        setEditDraft({ ...editDraft, headersText: e.target.value })
                                    }
                                    placeholder={"X-API-KEY=…"}
                                    rows={4}
                                    className="font-mono text-xs"
                                />
                            </Field>
                        </>
                    )}
                </div>
            </Modal>

            <Modal
                open={bindingsModal !== null}
                onClose={closeBindingsModal}
                title="Workspaces"
                subtitle={
                    bindingsModal
                        ? `${bindingsModal.title} · Choose where this connector is allowed`
                        : undefined
                }
                footer={
                    <div className="flex w-full justify-end gap-2">
                        <Button
                            variant="secondary"
                            onClick={closeBindingsModal}
                            disabled={bindingsSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void saveWorkspaceBindings()}
                            disabled={bindingsSaving || bindingsLoading}
                        >
                            {bindingsSaving ? "Saving…" : "Save"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    {bindingsError ? (
                        <Panel className="border-status-error-border bg-status-error-bg/30 p-3">
                            <p className="text-xs text-status-error-text">{bindingsError}</p>
                        </Panel>
                    ) : null}
                    {bindingsLoading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : bindingsRows.length === 0 ? (
                        <p className="text-xs text-text-muted">No workspaces on your account.</p>
                    ) : (
                        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-bg-surface/80">
                            {bindingsRows.map((row) => (
                                <li
                                    key={row.workspaceId}
                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-text-primary">
                                            {row.workspaceName}
                                        </p>
                                        {row.workspaceId === workspaceId ? (
                                            <p className="text-[10px] text-text-muted">Current page workspace</p>
                                        ) : null}
                                    </div>
                                    <Switch
                                        checked={row.enabled}
                                        onChange={(next) =>
                                            setBindingsRows((prev) =>
                                                prev.map((r) =>
                                                    r.workspaceId === row.workspaceId
                                                        ? { ...r, enabled: next }
                                                        : r,
                                                ),
                                            )
                                        }
                                        aria-label={`Allow in ${row.workspaceName}`}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Modal>
        </div>
    );
}
