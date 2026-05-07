import { tool } from "@langchain/core/tools";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mcpDescriptorsFromLangChainTools } from "../src/tools/codexLocalMcpDescriptors";

describe("codexLocalMcpDescriptors", () => {
    it("maps LangChain tools to JSON Schema descriptors", () => {
        const demo = tool(
            async (input: { msg: string }) => input.msg,
            {
                name: "demo_echo",
                description: "Echo input",
                schema: z.object({ msg: z.string() }),
            },
        );
        const descriptors = mcpDescriptorsFromLangChainTools([demo]);
        expect(descriptors).toHaveLength(1);
        expect(descriptors[0]?.name).toBe("demo_echo");
        expect(descriptors[0]?.inputSchema).toBeTruthy();
        expect(descriptors[0]?.description).toContain("Echo");
    });
});
