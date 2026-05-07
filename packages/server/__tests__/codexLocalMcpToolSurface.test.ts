import { describe, expect, it } from "vitest";

import { mcpDescriptorsFromLangChainTools } from "@kletron/agent-core/tools/codexLocalMcpDescriptors";
import { buildGoogleWorkspaceTools } from "../src/services/googleWorkspaceTools";

describe("Codex local MCP ↔ LangChain Google workspace tools", () => {
    it("keeps descriptor names aligned with buildGoogleWorkspaceTools (shared Zod schemas)", () => {
        const tools = buildGoogleWorkspaceTools();
        const descriptors = mcpDescriptorsFromLangChainTools(tools as never);

        expect(descriptors).toHaveLength(tools.length);

        const names = tools.map((t: { name: string }) => t.name);
        expect(new Set(names).size).toBe(names.length);

        expect(descriptors.map((d) => d.name).sort()).toEqual([...names].sort());

        for (const d of descriptors) {
            expect(d.inputSchema && typeof d.inputSchema === "object").toBe(true);
            expect(Object.keys(d.inputSchema).length).toBeGreaterThan(0);
        }
    });
});
