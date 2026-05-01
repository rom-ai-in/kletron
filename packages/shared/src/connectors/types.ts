// Public connector types shared across services and UI.

import { z } from "zod";

export type ConnectorIntegrationStatus = "active" | "revoked" | "error";
export type McpServerTransport = "stdio" | "sse" | "streamable-http";
export type McpServerStatus = "unknown" | "connected" | "error" | "disabled";

export interface WorkspaceIntegrationSummary {
    id: string;
    workspaceId: string;
    providerId: string;
    displayName: string;
    status: ConnectorIntegrationStatus;
    scopes: string[];
    lastUsedAt: string | null;
    createdAt: string;
    /** Never sent: the actual credentials. Only redacted hints. */
    credentialPreview: Record<string, string>;
}

export interface WorkspaceMcpServerSummary {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    transport: McpServerTransport;
    enabled: boolean;
    status: McpServerStatus;
    statusMessage?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    discoveredTools: Array<{
        name: string;
        description?: string;
    }>;
    lastConnectedAt: string | null;
    createdAt: string;
}

// ─── Validators ──────────────────────────────────────────────────────────────

export const integrationCreateSchema = z.object({
    providerId: z.string().min(1),
    displayName: z.string().min(1).max(120).optional(),
    credentials: z.record(z.string(), z.string()),
    scopes: z.array(z.string()).optional(),
});

export const integrationUpdateSchema = z.object({
    displayName: z.string().min(1).max(120).optional(),
    credentials: z.record(z.string(), z.string()).optional(),
    status: z.enum(["active", "revoked", "error"]).optional(),
});

export const mcpServerCreateSchema = z
    .object({
        name: z.string().min(1).max(64),
        transport: z.enum(["stdio", "sse", "streamable-http"]),
        enabled: z.boolean().optional(),
        command: z.string().optional(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string(), z.string()).optional(),
        url: z.string().url().optional(),
        headers: z.record(z.string(), z.string()).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.transport === "stdio") {
            if (!value.command || !value.command.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["command"],
                    message: "command is required for stdio transport",
                });
            }
        } else {
            if (!value.url || !value.url.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["url"],
                    message: "url is required for SSE / Streamable HTTP transport",
                });
            }
        }
    });

export const mcpServerUpdateSchema = z.object({
    name: z.string().min(1).max(64).optional(),
    enabled: z.boolean().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    url: z.string().url().optional(),
    headers: z.record(z.string(), z.string()).optional(),
});

export type IntegrationCreateInput = z.infer<typeof integrationCreateSchema>;
export type IntegrationUpdateInput = z.infer<typeof integrationUpdateSchema>;
export type McpServerCreateInput = z.infer<typeof mcpServerCreateSchema>;
export type McpServerUpdateInput = z.infer<typeof mcpServerUpdateSchema>;
