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

/** LangChain tools expose either a Zod schema or an already-plain JSON Schema. */
function isZodSchema(value: unknown): value is z.ZodType {
    return (
        typeof value === "object" &&
        value !== null &&
        "_def" in value &&
        typeof (value as { parse?: unknown }).parse === "function"
    );
}

function toInputSchema(rawSchema: unknown): Record<string, unknown> {
    if (rawSchema == null) return {};
    if (isZodSchema(rawSchema)) {
        return zodToJsonSchema(rawSchema, { target: "openApi3", $refStrategy: "none" }) as Record<
            string,
            unknown
        >;
    }
    // Already a JSON Schema — forward it untouched rather than running it
    // through zodToJsonSchema, which would yield an empty/garbage descriptor.
    if (typeof rawSchema === "object") return rawSchema as Record<string, unknown>;
    return {};
}

export function mcpDescriptorsFromLangChainTools(tools: StructuredToolInterface[]): CodexLocalMcpToolDescriptor[] {
    return tools.map((t) => {
        return {
            name: t.name,
            description: typeof t.description === "string" ? t.description : "",
            inputSchema: toInputSchema((t as { schema?: unknown }).schema),
        };
    });
}
