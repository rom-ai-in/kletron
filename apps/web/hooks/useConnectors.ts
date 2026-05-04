"use client";

import { useCallback, useEffect, useState } from "react";
import type {
    ConnectorTypeDefinition,
    IntegrationCreateInput,
    IntegrationUpdateInput,
    McpServerCreateInput,
    McpServerUpdateInput,
    WorkspaceIntegrationSummary,
    WorkspaceMcpServerSummary,
} from "@kletron/shared";

export function useConnectorCatalog() {
    const [types, setTypes] = useState<ConnectorTypeDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                const res = await fetch("/api/connectors/types", { signal: ac.signal });
                if (!res.ok) throw new Error(`Failed (${res.status})`);
                const json = await res.json();
                setTypes(json.types ?? []);
            } catch (err) {
                if ((err as Error).name !== "AbortError") setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        })();
        return () => ac.abort();
    }, []);

    return { types, isLoading, error };
}

export function useWorkspaceConnectors(workspaceId: string) {
    const [integrations, setIntegrations] = useState<WorkspaceIntegrationSummary[]>([]);
    const [mcpServers, setMcpServers] = useState<WorkspaceMcpServerSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!workspaceId) {
            setIntegrations([]);
            setMcpServers([]);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [intRes, mcpRes] = await Promise.all([
                fetch(`/api/workspaces/${workspaceId}/connectors/integrations`),
                fetch(`/api/workspaces/${workspaceId}/connectors/mcp-servers`),
            ]);
            if (!intRes.ok) throw new Error(`integrations: ${intRes.status}`);
            if (!mcpRes.ok) throw new Error(`mcp-servers: ${mcpRes.status}`);
            const intJson = await intRes.json();
            const mcpJson = await mcpRes.json();
            setIntegrations(intJson.integrations ?? []);
            setMcpServers(mcpJson.servers ?? []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createIntegration = useCallback(
        async (input: IntegrationCreateInput) => {
            const res = await fetch(`/api/workspaces/${workspaceId}/connectors/integrations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
            return (await res.json()).integration as WorkspaceIntegrationSummary;
        },
        [workspaceId, refresh]
    );

    const updateIntegration = useCallback(
        async (id: string, input: IntegrationUpdateInput) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/integrations/${id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(input),
                }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    const deleteIntegration = useCallback(
        async (id: string) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/integrations/${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    const testIntegration = useCallback(
        async (id: string) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/integrations/${id}/test`,
                { method: "POST" }
            );
            const json = await res.json().catch(() => ({}));
            return { ok: res.ok, ...json } as { ok: boolean; message?: string };
        },
        [workspaceId]
    );

    const createMcpServer = useCallback(
        async (input: McpServerCreateInput) => {
            const res = await fetch(`/api/workspaces/${workspaceId}/connectors/mcp-servers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
            return (await res.json()).server as WorkspaceMcpServerSummary;
        },
        [workspaceId, refresh]
    );

    const updateMcpServer = useCallback(
        async (id: string, input: McpServerUpdateInput) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/mcp-servers/${id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(input),
                }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    const deleteMcpServer = useCallback(
        async (id: string) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/mcp-servers/${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Failed (${res.status})`);
            }
            await refresh();
        },
        [workspaceId, refresh]
    );

    const discoverMcpServer = useCallback(
        async (id: string) => {
            const res = await fetch(
                `/api/workspaces/${workspaceId}/connectors/mcp-servers/${id}/discover`,
                { method: "POST" }
            );
            const json = await res.json().catch(() => ({}));
            await refresh();
            return { ok: res.ok, ...json } as {
                ok: boolean;
                tools?: Array<{ name: string; description?: string }>;
                error?: string;
            };
        },
        [workspaceId, refresh]
    );

    return {
        integrations,
        mcpServers,
        isLoading,
        error,
        refresh,
        createIntegration,
        updateIntegration,
        deleteIntegration,
        testIntegration,
        createMcpServer,
        updateMcpServer,
        deleteMcpServer,
        discoverMcpServer,
    };
}
