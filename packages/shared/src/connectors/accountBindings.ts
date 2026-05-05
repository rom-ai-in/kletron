// Account-level connector library + per-workspace bindings (ownerId-scoped).

import { z } from "zod";
import type { ConnectorIntegrationStatus, McpServerStatus, McpServerTransport } from "./types";

export type ConnectorBindingKind = "integration" | "mcp_server";

/** One row in workspace_connector_bindings */
export interface WorkspaceConnectorBinding {
    id: string;
    workspaceId: string;
    kind: ConnectorBindingKind;
    /** account_mcp_servers._id or account_integrations._id */
    refId: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

/** MCP server definition on the user account (no per-workspace enabled flag). */
export interface AccountMcpServerSummary {
    id: string;
    ownerId: string;
    name: string;
    slug: string;
    transport: McpServerTransport;
    status: McpServerStatus;
    statusMessage?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    discoveredTools: Array<{ name: string; description?: string }>;
    lastConnectedAt: string | null;
    createdAt: string;
}

/** SaaS integration on the user account. */
export interface AccountIntegrationSummary {
    id: string;
    ownerId: string;
    providerId: string;
    displayName: string;
    status: ConnectorIntegrationStatus;
    scopes: string[];
    lastUsedAt: string | null;
    createdAt: string;
    credentialPreview: Record<string, string>;
}

export const connectorBindingUpsertSchema = z.object({
    kind: z.enum(["integration", "mcp_server"]),
    refId: z.string().min(1),
    enabled: z.boolean(),
});

export const connectorBindingsBulkSchema = z.object({
    bindings: z.array(connectorBindingUpsertSchema),
});

/** Per-workspace rows when editing enablement for one account connector across workspaces. */
export interface ConnectorWorkspaceBindingRow {
    workspaceId: string;
    workspaceName: string;
    enabled: boolean;
}

export const connectorWorkspaceBindingsBulkSchema = z.object({
    workspaces: z.array(
        z.object({
            workspaceId: z.string().min(1),
            enabled: z.boolean(),
        })
    ),
});

export type ConnectorBindingUpsertInput = z.infer<typeof connectorBindingUpsertSchema>;
export type ConnectorBindingsBulkInput = z.infer<typeof connectorBindingsBulkSchema>;
export type ConnectorWorkspaceBindingsBulkInput = z.infer<typeof connectorWorkspaceBindingsBulkSchema>;
