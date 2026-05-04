import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@kletron/mcp-client/client", () => {
    return {
        McpClient: {
            getInstance: vi.fn(),
        },
    };
});

import { McpClient } from "@kletron/mcp-client/client";
import { buildDynamicExternalTools } from "@kletron/agent-core/tools/dynamicExternalTools";

describe("buildDynamicExternalTools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("wraps every external tool as a LangChain tool with namespaced name", async () => {
        const callTool = vi.fn(async () => "ok");
        (McpClient.getInstance as any).mockResolvedValue({
            listExternalTools: () => [
                {
                    serverSlug: "acme",
                    name: "acme__do_thing",
                    description: "Does the thing",
                    inputSchema: {
                        type: "object",
                        properties: {
                            target: { type: "string" },
                            count: { type: "integer" },
                        },
                        required: ["target"],
                    },
                },
                {
                    serverSlug: "weather",
                    name: "weather__forecast",
                    inputSchema: undefined,
                },
            ],
            callTool,
        });

        const tools = await buildDynamicExternalTools("w1");
        expect(tools).toHaveLength(2);
        expect(tools.map((t: any) => t.name).sort()).toEqual([
            "acme__do_thing",
            "weather__forecast",
        ]);
    });

    it("falls back to a permissive schema when JSON Schema cannot be converted", async () => {
        (McpClient.getInstance as any).mockResolvedValue({
            listExternalTools: () => [
                {
                    serverSlug: "weird",
                    name: "weird__op",
                    inputSchema: { type: "weird-type" }, // not an object
                },
            ],
            callTool: vi.fn(),
        });
        const tools = await buildDynamicExternalTools("w1");
        expect(tools).toHaveLength(1);
        // Fallback schema accepts arbitrary keys but serializes with properties: {} for LM Studio.
        const schema: any = (tools[0] as any).schema;
        expect(() => schema.parse({})).not.toThrow();
        expect(() => schema.parse({ anything: "goes" })).not.toThrow();
    });

    it("invokes McpClient.callTool with the namespaced name", async () => {
        const callTool = vi.fn(async () => "result-payload");
        (McpClient.getInstance as any).mockResolvedValue({
            listExternalTools: () => [
                {
                    serverSlug: "acme",
                    name: "acme__do_thing",
                    inputSchema: { type: "object", properties: {} },
                },
            ],
            callTool,
        });
        const [tool] = await buildDynamicExternalTools("w1");
        const result = await (tool as any).invoke({ key: "value" });
        expect(result).toBe("result-payload");
        expect(callTool).toHaveBeenCalledWith(
            "acme__do_thing",
            expect.objectContaining({ key: "value" }),
            { workspaceId: "w1" }
        );
    });

    it("returns an empty list if McpClient cannot be obtained", async () => {
        (McpClient.getInstance as any).mockRejectedValue(new Error("no mcp"));
        const tools = await buildDynamicExternalTools("w1");
        expect(tools).toEqual([]);
    });
});
