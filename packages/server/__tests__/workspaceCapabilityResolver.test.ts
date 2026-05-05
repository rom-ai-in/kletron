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
        expect(caps.enabledTools).not.toContain("sentry_api");
    });

    it("exposes sentry_api when a sentry integration is enabled", async () => {
        const connectors = await import("../src/services/connectorsService");
        vi.mocked(connectors.listEnabledIntegrationProviderIds).mockResolvedValueOnce(["sentry"]);

        const { resolveWorkspaceCapabilities } = await import(
            "../src/services/workspaceCapabilityResolver"
        );
        const caps = await resolveWorkspaceCapabilities("ws-sentry");

        expect(caps.enabledTools).toContain("sentry_api");
    });

    it("exposes Google tools when Google integrations are enabled", async () => {
        const connectors = await import("../src/services/connectorsService");
        vi.mocked(connectors.listEnabledIntegrationProviderIds).mockResolvedValueOnce([
            "google-drive",
            "google-calendar",
            "gmail",
        ]);

        const { resolveWorkspaceCapabilities } = await import(
            "../src/services/workspaceCapabilityResolver"
        );
        const caps = await resolveWorkspaceCapabilities("ws-google");

        expect(caps.enabledIntegrationProviderIds).toEqual(
            expect.arrayContaining(["google-drive", "google-calendar", "gmail"]),
        );
        expect(caps.enabledTools).toEqual(
            expect.arrayContaining([
                "drive_list_files",
                "drive_read_file",
                "drive_write_text_file",
                "calendar_list_calendars",
                "calendar_freebusy",
                "calendar_list_events",
                "calendar_get_event",
                "calendar_create_event",
                "calendar_update_event",
                "calendar_delete_event",
                "gmail_list_labels",
                "gmail_search_messages",
                "gmail_read_message",
                "gmail_modify_message_labels",
                "gmail_create_draft",
                "gmail_send_message",
            ]),
        );
    });
});
