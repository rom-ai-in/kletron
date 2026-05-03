import { describe, expect, it, vi, beforeEach } from "vitest";
import { KLETRON_ADMIN_TOOL_NAMES } from "@kletron/agent-core/tools/kletronAdminToolNames";

vi.mock("../src/services/skillsService", () => ({
    resolveWorkspaceSkills: vi.fn(async () => [
        {
            slug: "research",
            name: "Research",
            version: "1.0.0",
            description: "",
            tags: [],
            requiredTools: ["web_search"],
            suggestedTools: [],
            extends: [],
            body: "",
            source: "builtin" as const,
            resolvedSystemPrompt: "",
            resolvedTools: ["web_search", "fetch_url"],
            extendsChain: ["research"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ]),
}));

vi.mock("../src/services/connectorsService", () => ({
    listEnabledIntegrationProviderIds: vi.fn(async () => ["github"]),
    getExternalMcpRuntimeConfig: vi.fn(async () => [
        {
            id: "srv1",
            slug: "demo",
            name: "Demo",
            transport: "sse" as const,
            url: "http://localhost:9999/sse",
        },
    ]),
}));

describe("workspaceCapabilityResolver", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("merges baseline, skill, integration-unlocked, and external MCP config", async () => {
        const { resolveWorkspaceCapabilities } = await import(
            "../src/services/workspaceCapabilityResolver"
        );
        const caps = await resolveWorkspaceCapabilities("ws-deadbeef");

        expect(caps.enabledIntegrationProviderIds).toContain("github");
        expect(caps.enabledTools).toContain("list_files");
        expect(caps.enabledTools).toContain("web_search");
        expect(caps.enabledTools).toContain("github_api");
        expect(caps.enabledTools).toContain("write_file");
        expect(caps.enabledTools).toContain("str_replace_editor");
        expect(caps.enabledTools).toContain("execute_bash");
        expect(caps.enabledTools).toContain("semantic_code_search");
        expect(caps.externalMcpServers).toHaveLength(1);
        expect(caps.externalMcpServers[0]?.slug).toBe("demo");
        for (const name of KLETRON_ADMIN_TOOL_NAMES) {
            expect(caps.enabledTools).toContain(name);
        }
    });

    it("does not expose github_api without a github integration", async () => {
        const connectors = await import("../src/services/connectorsService");
        vi.mocked(connectors.listEnabledIntegrationProviderIds).mockResolvedValueOnce([]);

        const { resolveWorkspaceCapabilities } = await import(
            "../src/services/workspaceCapabilityResolver"
        );
        const caps = await resolveWorkspaceCapabilities("ws-empty");

        expect(caps.enabledTools).not.toContain("github_api");
    });
});
