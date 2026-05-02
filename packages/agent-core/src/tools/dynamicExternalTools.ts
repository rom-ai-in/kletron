// Dynamic LangChain tools for external MCP servers.
//
// At run start the executor resolves the workspace's external MCP servers
// (`workspaceCapabilityResolver`) and asks the McpClient to connect to them
// (`syncExternalServers`). Once connected, each external tool is exposed via
// `McpClient.listExternalTools()` as a namespaced `slug__toolName`. To make
// these tools bindable to the LLM, we wrap each one in a LangChain `tool({})`
// here so they can flow through the same `selectToolsByName` path as the
// bundled tools.
//
// Schema strategy: prefer the server's JSON Schema, but if conversion fails or
// the schema is empty, fall back to `z.record(z.any())` so the agent can still
// invoke the tool with arbitrary arguments. The MCP server itself enforces
// validation on call.

import { tool } from "@langchain/core/tools";
import { z, type ZodTypeAny } from "zod";
import { McpClient } from "@kletron/mcp-client/client";

interface ExternalToolDescriptor {
    serverSlug: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
}

const looseObjectSchema = (): ZodTypeAny => z.record(z.any());

function jsonSchemaToZod(schema: unknown): ZodTypeAny {
    if (!schema || typeof schema !== "object") return looseObjectSchema();
    const obj = schema as Record<string, unknown>;
    if (obj.type !== "object") return looseObjectSchema();
    const props = (obj.properties ?? {}) as Record<string, any>;
    const required = new Set<string>(Array.isArray(obj.required) ? (obj.required as string[]) : []);
    const shape: Record<string, ZodTypeAny> = {};
    for (const [key, def] of Object.entries(props)) {
        const fieldSchema = jsonSchemaFieldToZod(def);
        shape[key] = required.has(key) ? fieldSchema : fieldSchema.optional();
    }
    if (Object.keys(shape).length === 0) return looseObjectSchema();
    return z.object(shape).passthrough();
}

function jsonSchemaFieldToZod(def: any): ZodTypeAny {
    if (!def || typeof def !== "object") return z.any();
    const t = def.type;
    if (t === "string") {
        let s: ZodTypeAny = z.string();
        if (typeof def.minLength === "number") s = (s as any).min(def.minLength);
        if (typeof def.maxLength === "number") s = (s as any).max(def.maxLength);
        if (Array.isArray(def.enum) && def.enum.every((v: unknown) => typeof v === "string")) {
            return z.enum(def.enum as [string, ...string[]]);
        }
        return s;
    }
    if (t === "number" || t === "integer") {
        let n: ZodTypeAny = t === "integer" ? z.number().int() : z.number();
        if (typeof def.minimum === "number") n = (n as any).min(def.minimum);
        if (typeof def.maximum === "number") n = (n as any).max(def.maximum);
        return n;
    }
    if (t === "boolean") return z.boolean();
    if (t === "array") {
        const item = def.items ? jsonSchemaFieldToZod(def.items) : z.any();
        return z.array(item);
    }
    if (t === "object") {
        return jsonSchemaToZod(def);
    }
    return z.any();
}

/**
 * Build LangChain `tool` wrappers for the external MCP tools currently
 * exposed by the singleton `McpClient`. Each wrapper proxies the call back
 * through `client.callTool(slug__name, args)` so namespacing is preserved.
 *
 * If a tool name conflicts with a bundled tool name, we still register it
 * (LangChain will prefer the first occurrence). Callers should pass bundled
 * tools first.
 */
export async function buildDynamicExternalTools(): Promise<any[]> {
    let descriptors: ExternalToolDescriptor[] = [];
    try {
        const client = await McpClient.getInstance();
        descriptors = client.listExternalTools();
    } catch (error) {
        console.warn(
            "[dynamicExternalTools] Could not fetch external tools:",
            (error as Error)?.message ?? error
        );
        return [];
    }
    const out: any[] = [];
    for (const d of descriptors) {
        let schema: ZodTypeAny;
        try {
            schema = jsonSchemaToZod(d.inputSchema);
        } catch (err) {
            console.warn(
                `[dynamicExternalTools] Schema conversion failed for ${d.name}, using passthrough:`,
                (err as Error)?.message ?? err
            );
            schema = looseObjectSchema();
        }
        const description = d.description ?? `External MCP tool from server '${d.serverSlug}'`;
        const wrapped = tool(
            async (input: Record<string, unknown>) => {
                const client = await McpClient.getInstance();
                const result = await client.callTool(d.name, input ?? {});
                return result;
            },
            {
                name: d.name,
                description,
                schema,
            }
        );
        out.push(wrapped);
    }
    return out;
}

export type { ExternalToolDescriptor };
