import { describe, it, expect } from "vitest";
import { STANDARD_WORKSPACE_BUNDLED_TOOLS } from "@kletron/shared";
import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";

/** Hybrid tool: LangChain wrapper calls vectorService, not the MCP server binary. */
const EXECUTOR_ONLY_TOOLS = new Set(["semantic_code_search"]);

describe("STANDARD_WORKSPACE_BUNDLED_TOOLS manifest", () => {
    it("every standard tool exists as an LangChain MCP wrapper (or is executor-only)", () => {
        const registered = new Set(allMcpTools.map((t: { name?: string }) => String(t?.name ?? "")));
        for (const name of STANDARD_WORKSPACE_BUNDLED_TOOLS) {
            expect(
                registered.has(name) || EXECUTOR_ONLY_TOOLS.has(name),
                `Missing tool registration for ${name}`
            ).toBe(true);
        }
    });

    it("does not grant connector-only web tools by default", () => {
        expect(STANDARD_WORKSPACE_BUNDLED_TOOLS).not.toContain("web_search");
        expect(STANDARD_WORKSPACE_BUNDLED_TOOLS).not.toContain("fetch_url");
        expect(STANDARD_WORKSPACE_BUNDLED_TOOLS).not.toContain("github_api");
    });
});
