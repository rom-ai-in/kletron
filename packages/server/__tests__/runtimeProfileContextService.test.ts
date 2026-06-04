import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfileByUserId = vi.hoisted(() => vi.fn());
const getOrganizationPayloadForUser = vi.hoisted(() => vi.fn());
const agentMemoryRead = vi.hoisted(() => vi.fn());
const resolveSafeConnectorPromptDefaults = vi.hoisted(() => vi.fn());

vi.mock("../src/services/userProfileService", () => ({
    getProfileByUserId: (...args: unknown[]) => getProfileByUserId(...args),
}));

vi.mock("../src/services/organizationService", () => ({
    getOrganizationPayloadForUser: (...args: unknown[]) => getOrganizationPayloadForUser(...args),
}));

vi.mock("../src/services/agentMemoryService", () => ({
    agentMemoryService: {
        read: (...args: unknown[]) => agentMemoryRead(...args),
    },
}));

vi.mock("../src/services/connectorPromptDefaultsService", () => ({
    resolveSafeConnectorPromptDefaults: (...args: unknown[]) =>
        resolveSafeConnectorPromptDefaults(...args),
}));

describe("runtimeProfileContextService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("falls back to derived memories when profile and organization lookups fail", async () => {
        getProfileByUserId.mockRejectedValue(new Error("mongo down"));
        getOrganizationPayloadForUser.mockRejectedValue(new Error("mongo down"));
        resolveSafeConnectorPromptDefaults.mockResolvedValue([]);
        agentMemoryRead.mockImplementation(async (path: string) => {
            if (path === "/memories/profile.md") {
                return "# User Profile\n- Display name: Ada Lovelace\n- Preferred language: fr\n";
            }
            if (path === "/memories/company.md") {
                return "# Company\n- Workspace name: business\n- Organization: Kletron\n";
            }
            throw new Error(`Unexpected path ${path}`);
        });

        const { resolveRuntimeProfileContext, formatRunContextPrompt } = await import(
            "../src/services/runtimeProfileContextService"
        );

        const context = await resolveRuntimeProfileContext({
            workspaceId: "507f1f77bcf86cd799439011",
            workspaceName: "business",
            userId: "user-1",
            graph: { name: "Coder Agent (agent graph)", category: "graph" as const },
            workMode: "code",
            documentContext: null,
            enabledIntegrationProviderIds: [],
        });

        expect(context.userDisplayName).toBe("Ada Lovelace");
        expect(context.companyOrOrg).toBe("Kletron");
        expect(context.preferredLanguage).toBe("fr");
        expect(context.connectorDefaults).toEqual([]);
        expect(formatRunContextPrompt(context)).toContain("User name: Ada Lovelace");
        expect(formatRunContextPrompt(context)).toContain("Company / org: Kletron");
    });
});
