import type { StructuredToolInterface } from "@langchain/core/tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

/**
 * MCP `tools/list`-style descriptors derived from LangChain {@link StructuredToolInterface} instances
 * (same objects as {@link buildGoogleWorkspaceTools} in `@kletron/server`).
 */
export type CodexLocalMcpToolDescriptor = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
};

export function mcpDescriptorsFromLangChainTools(tools: StructuredToolInterface[]): CodexLocalMcpToolDescriptor[] {
    return tools.map((t) => {
        const rawSchema = (t as { schema?: z.ZodType }).schema;
        const inputSchema =
            rawSchema != null
                ? (zodToJsonSchema(rawSchema, { target: "openApi3", $refStrategy: "none" }) as Record<string, unknown>)
                : {};
        return {
            name: t.name,
            description: typeof t.description === "string" ? t.description : "",
            inputSchema,
        };
    });
}
