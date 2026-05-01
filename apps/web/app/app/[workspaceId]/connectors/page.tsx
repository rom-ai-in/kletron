"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useMemo, useState } from "react";
import { Card, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { Input } from "@kletron/ui/components/ui/Input";
import { Switch } from "@kletron/ui/components/ui/Toggle";
import { Modal as Dialog } from "@kletron/ui/components/ui/Modal";
import {
    Tabs,
    TabsList,
    TabTrigger,
    TabContent,
} from "@kletron/ui/components/ui/Tabs";
import { Plus, Trash2, Play, RefreshCw, ExternalLink } from "lucide-react";
import {
    useConnectorCatalog,
    useWorkspaceConnectors,
} from "../../../../hooks/useConnectors";
import { getPlugin, type ConnectorTypeDefinition, type McpServerTransport } from "@kletron/shared";

type IntegrationFormState = {
    open: boolean;
    type: ConnectorTypeDefinition | null;
    displayName: string;
    credentials: Record<string, string>;
};

const blankIntegrationForm: IntegrationFormState = {
    open: false,
    type: null,
    displayName: "",
    credentials: {},
};

type McpFormState = {
    open: boolean;
    name: string;
    transport: McpServerTransport;
    command: string;
    args: string;
    envText: string;
    url: string;
    headersText: string;
    enabled: boolean;
};

const blankMcpForm: McpFormState = {
    open: false,
    name: "",
    transport: "stdio",
    command: "",
    args: "",
    envText: "",
    url: "",
    headersText: "",
    enabled: true,
};

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

function WorkspaceConnectorsPageInner({ workspaceId }: { workspaceId: string }) {
    const searchParams = useSearchParams();
    const pluginId = searchParams.get("plugin");
    const plugin = pluginId ? getPlugin(pluginId) : undefined;

    const { types } = useConnectorCatalog();
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

    const [intForm, setIntForm] = useState<IntegrationFormState>(blankIntegrationForm);
    const [mcpForm, setMcpForm] = useState<McpFormState>(blankMcpForm);
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const openIntegrationForm = (def: ConnectorTypeDefinition) => {
        const initialCreds: Record<string, string> = {};
        for (const f of def.credentialFields ?? []) initialCreds[f.key] = "";
        setIntForm({
            open: true,
            type: def,
            displayName: def.name,
            credentials: initialCreds,
        });
    };

    const submitIntegration = async () => {
        if (!intForm.type) return;
        setActionError(null);
        try {
            if (intForm.type.auth === "oauth") {
                const pluginQs =
                    pluginId !== null && pluginId !== ""
                        ? `?plugin=${encodeURIComponent(pluginId)}`
                        : "";
                window.location.href = `/api/auth/connect/${intForm.type.id}?workspaceId=${workspaceId}&redirect=${encodeURIComponent(`/app/${workspaceId}/connectors${pluginQs}`)}`;
                return;
            }
            await createIntegration({
                providerId: intForm.type.id,
                displayName: intForm.displayName,
                credentials: intForm.credentials,
                scopes: [],
            });
            setIntForm(blankIntegrationForm);
            setActionMsg("Integration added");
        } catch (err) {
            setActionError((err as Error).message);
        }
    };

    const submitMcpServer = async () => {
        setActionError(null);
        try {
            const env = mcpForm.envText ? parseKvText(mcpForm.envText) : undefined;
            const headers = mcpForm.headersText ? parseKvText(mcpForm.headersText) : undefined;
            const args = mcpForm.args
                ? mcpForm.args.split(/\s+/).filter(Boolean)
                : undefined;
            await createMcpServer({
                name: mcpForm.name,
                transport: mcpForm.transport,
                command: mcpForm.transport === "stdio" ? mcpForm.command : undefined,
                args: mcpForm.transport === "stdio" ? args : undefined,
                env,
                url: mcpForm.transport !== "stdio" ? mcpForm.url : undefined,
                headers: mcpForm.transport !== "stdio" ? headers : undefined,
                enabled: mcpForm.enabled,
            });
            setMcpForm(blankMcpForm);
            setActionMsg("MCP server added");
        } catch (err) {
            setActionError((err as Error).message);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Workspace Connectors</h1>
                    <p className="text-text-muted mt-1">
                        {plugin
                            ? `Connect integrations for the ${plugin.name} plugin. MCP servers are unchanged.`
                            : "Hook this workspace into SaaS apps and bring-your-own MCP servers."}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                    <Link href={`/app/${workspaceId}/plugins`} className="text-text-secondary underline">
                        Plugins
                    </Link>
                    <Link href={`/app/${workspaceId}/skills`} className="text-text-secondary underline">
                        Skills
                    </Link>
                </div>
            </div>

            {plugin && (
                <div className="mb-4 rounded-md border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
                    Showing connectors for plugin{" "}
                    <span className="font-medium text-text-primary">{plugin.name}</span>.{" "}
                    <Link href={`/app/${workspaceId}/connectors`} className="underline">
                        Show all connectors
                    </Link>
                </div>
            )}

            {error && <p className="mb-3 text-sm text-status-error-text">Error: {error}</p>}
            {actionMsg && (
                <p className="mb-3 text-sm text-status-success-text">{actionMsg}</p>
            )}
            {actionError && (
                <p className="mb-3 text-sm text-status-error-text">{actionError}</p>
            )}

            <Tabs defaultValue="integrations" variant="underline">
                <TabsList>
                    <TabTrigger value="integrations">Integrations</TabTrigger>
                    <TabTrigger value="mcp-servers">MCP Servers</TabTrigger>
                </TabsList>

                <TabContent value="integrations">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {integrationTypes.map((def) => {
                            const active = integrations.filter((i) => i.providerId === def.id);
                            return (
                                <Card key={def.id} className="border-border-subtle bg-bg-surface">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-semibold text-text-primary">
                                                    {def.name}
                                                </h3>
                                                <p className="text-[11px] text-text-muted">
                                                    {def.id} · {def.auth}
                                                </p>
                                            </div>
                                            {def.docsUrl && (
                                                <a
                                                    href={def.docsUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-text-muted hover:text-text-primary"
                                                    title="Documentation"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-text-secondary">
                                            {def.description}
                                        </p>
                                        {active.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {active.map((integration) => (
                                                    <div
                                                        key={integration.id}
                                                        className="flex items-center justify-between rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px]"
                                                    >
                                                        <div>
                                                            <p className="text-text-primary">
                                                                {integration.displayName}
                                                            </p>
                                                            <p className="text-text-muted">
                                                                {integration.status}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="Test"
                                                                onClick={async () => {
                                                                    const res = await testIntegration(
                                                                        integration.id
                                                                    );
                                                                    setActionMsg(res.message ?? null);
                                                                }}
                                                            >
                                                                <Play className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-destructive"
                                                                title="Disconnect"
                                                                onClick={async () => {
                                                                    if (
                                                                        !confirm(
                                                                            `Remove ${integration.displayName}?`
                                                                        )
                                                                    )
                                                                        return;
                                                                    await deleteIntegration(
                                                                        integration.id
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
                                        <div className="mt-3">
                                            <Button
                                                size="sm"
                                                onClick={() => openIntegrationForm(def)}
                                                className="flex items-center gap-1"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Connect
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabContent>

                <TabContent value="mcp-servers">
                    <div className="mb-4">
                        <Button
                            onClick={() => setMcpForm({ ...blankMcpForm, open: true })}
                            className="flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> Add MCP server
                        </Button>
                    </div>
                    {isLoading ? (
                        <p className="text-text-muted">Loading...</p>
                    ) : mcpServers.length === 0 ? (
                        <p className="text-sm text-text-muted italic">
                            No external MCP servers configured.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {mcpServers.map((server) => (
                                <Card key={server.id} className="border-border-subtle bg-bg-surface">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-text-primary">
                                                        {server.name}
                                                    </h3>
                                                    <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
                                                        {server.slug}
                                                    </span>
                                                    <span className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted">
                                                        {server.transport}
                                                    </span>
                                                    <span className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-text-muted">
                                                        {server.status}
                                                    </span>
                                                </div>
                                                {server.statusMessage && (
                                                    <p className="mt-1 text-[11px] text-text-muted">
                                                        {server.statusMessage}
                                                    </p>
                                                )}
                                                {server.transport === "stdio" ? (
                                                    <p className="mt-1 font-mono text-[11px] text-text-muted">
                                                        {server.command}{" "}
                                                        {(server.args ?? []).join(" ")}
                                                    </p>
                                                ) : (
                                                    <p className="mt-1 font-mono text-[11px] text-text-muted">
                                                        {server.url}
                                                    </p>
                                                )}
                                                {server.discoveredTools.length > 0 && (
                                                    <details className="mt-2 text-[11px]">
                                                        <summary className="cursor-pointer text-text-muted">
                                                            {server.discoveredTools.length} tools
                                                        </summary>
                                                        <ul className="mt-1 space-y-0.5 pl-2 text-text-secondary">
                                                            {server.discoveredTools.map((tool) => (
                                                                <li key={tool.name}>
                                                                    <span className="font-mono">
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
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={server.enabled}
                                                    onChange={(next) =>
                                                        updateMcpServer(server.id, { enabled: next })
                                                    }
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Discover tools"
                                                    onClick={async () => {
                                                        const res = await discoverMcpServer(
                                                            server.id
                                                        );
                                                        if (res.ok) {
                                                            setActionMsg(
                                                                `Discovered ${res.tools?.length ?? 0} tools`
                                                            );
                                                        } else {
                                                            setActionError(res.error ?? "discover failed");
                                                        }
                                                    }}
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-destructive"
                                                    title="Delete"
                                                    onClick={async () => {
                                                        if (!confirm(`Delete ${server.name}?`)) return;
                                                        await deleteMcpServer(server.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabContent>
            </Tabs>

            {/* Integration form modal */}
            <Dialog
                open={intForm.open}
                onClose={() => setIntForm(blankIntegrationForm)}
                title=""
            >
                <div className="space-y-4 p-6">
                    <h3 className="text-lg font-semibold text-text-primary">
                        Connect {intForm.type?.name}
                    </h3>
                    {intForm.type?.auth === "oauth" ? (
                        <p className="text-sm text-text-secondary">
                            Click connect to start the OAuth flow with {intForm.type.name}. You will
                            be redirected back here when done.
                        </p>
                    ) : (
                        <>
                            <Field label="Display name">
                                <Input
                                    value={intForm.displayName}
                                    onChange={(e) =>
                                        setIntForm({ ...intForm, displayName: e.target.value })
                                    }
                                    fullWidth
                                />
                            </Field>
                            {(intForm.type?.credentialFields ?? []).map((field) => (
                                <Field key={field.key} label={field.label}>
                                    <Input
                                        type={field.secret ? "password" : "text"}
                                        placeholder={field.placeholder}
                                        value={intForm.credentials[field.key] ?? ""}
                                        onChange={(e) =>
                                            setIntForm({
                                                ...intForm,
                                                credentials: {
                                                    ...intForm.credentials,
                                                    [field.key]: e.target.value,
                                                },
                                            })
                                        }
                                        fullWidth
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
                </div>
                <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-4">
                    <Button variant="secondary" onClick={() => setIntForm(blankIntegrationForm)}>
                        Cancel
                    </Button>
                    <Button onClick={submitIntegration}>
                        {intForm.type?.auth === "oauth" ? "Continue with OAuth" : "Connect"}
                    </Button>
                </div>
            </Dialog>

            {/* MCP form modal */}
            <Dialog open={mcpForm.open} onClose={() => setMcpForm(blankMcpForm)} title="">
                <div className="space-y-4 p-6">
                    <h3 className="text-lg font-semibold text-text-primary">Add MCP server</h3>
                    <Field label="Name">
                        <Input
                            value={mcpForm.name}
                            onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                            placeholder="My MCP server"
                            fullWidth
                        />
                    </Field>
                    <Field label="Transport">
                        <select
                            value={mcpForm.transport}
                            onChange={(e) =>
                                setMcpForm({
                                    ...mcpForm,
                                    transport: e.target.value as McpServerTransport,
                                })
                            }
                            className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
                        >
                            <option value="stdio">stdio (local command)</option>
                            <option value="sse">SSE (HTTP)</option>
                            <option value="streamable-http">Streamable HTTP</option>
                        </select>
                    </Field>
                    {mcpForm.transport === "stdio" ? (
                        <>
                            <Field label="Command">
                                <Input
                                    value={mcpForm.command}
                                    onChange={(e) =>
                                        setMcpForm({ ...mcpForm, command: e.target.value })
                                    }
                                    placeholder="/usr/bin/python"
                                    fullWidth
                                />
                            </Field>
                            <Field label="Args (space-separated)">
                                <Input
                                    value={mcpForm.args}
                                    onChange={(e) =>
                                        setMcpForm({ ...mcpForm, args: e.target.value })
                                    }
                                    placeholder="-m my_mcp_server"
                                    fullWidth
                                />
                            </Field>
                            <Field label="Env (KEY=VALUE per line)">
                                <textarea
                                    rows={4}
                                    value={mcpForm.envText}
                                    onChange={(e) =>
                                        setMcpForm({ ...mcpForm, envText: e.target.value })
                                    }
                                    className="w-full p-2 border border-border-subtle rounded-md bg-bg-surface text-text-primary font-mono text-xs"
                                />
                            </Field>
                        </>
                    ) : (
                        <>
                            <Field label="URL">
                                <Input
                                    value={mcpForm.url}
                                    onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                                    placeholder="https://example.com/sse"
                                    fullWidth
                                />
                            </Field>
                            <Field label="Headers (KEY=VALUE per line)">
                                <textarea
                                    rows={4}
                                    value={mcpForm.headersText}
                                    onChange={(e) =>
                                        setMcpForm({ ...mcpForm, headersText: e.target.value })
                                    }
                                    className="w-full p-2 border border-border-subtle rounded-md bg-bg-surface text-text-primary font-mono text-xs"
                                />
                            </Field>
                        </>
                    )}
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                            type="checkbox"
                            checked={mcpForm.enabled}
                            onChange={(e) => setMcpForm({ ...mcpForm, enabled: e.target.checked })}
                        />{" "}
                        Enabled
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-4">
                    <Button variant="secondary" onClick={() => setMcpForm(blankMcpForm)}>
                        Cancel
                    </Button>
                    <Button onClick={submitMcpServer}>Add server</Button>
                </div>
            </Dialog>
        </div>
    );
}

export default function WorkspaceConnectorsPage({
    params,
}: {
    params: Promise<{ workspaceId: string }>;
}) {
    const { workspaceId } = use(params);
    return (
        <Suspense
            fallback={
                <div className="container mx-auto px-4 py-8 text-text-muted">Loading connectors…</div>
            }
        >
            <WorkspaceConnectorsPageInner workspaceId={workspaceId} />
        </Suspense>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block text-xs font-medium text-text-secondary">
            <span className="mb-1 block">{label}</span>
            {children}
        </label>
    );
}
