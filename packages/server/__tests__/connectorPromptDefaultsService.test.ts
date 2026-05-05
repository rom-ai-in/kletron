import { describe, expect, it, vi, beforeEach } from "vitest";

const findActiveIntegration = vi.hoisted(() => vi.fn());
const getIntegrationCredentials = vi.hoisted(() => vi.fn());

vi.mock("../src/services/connectorsService", () => ({
    findActiveIntegration: (...args: unknown[]) => findActiveIntegration(...args),
    getIntegrationCredentials: (...args: unknown[]) => getIntegrationCredentials(...args),
}));

describe("connectorPromptDefaultsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("serializes only safe Sentry defaults and never includes tokens", async () => {
        findActiveIntegration.mockResolvedValue({
            id: "integration-1",
            displayName: "Prod Sentry",
        });
        getIntegrationCredentials.mockResolvedValue({
            authToken: "secret-token",
            host: "https://sentry.io",
            organizationSlug: "acme-prod",
            projectId: "123",
        });

        const { resolveSafeConnectorPromptDefaults } = await import(
            "../src/services/connectorPromptDefaultsService"
        );

        const defaults = await resolveSafeConnectorPromptDefaults("ws-1", ["sentry"]);

        expect(defaults).toEqual([
            {
                providerId: "sentry",
                displayName: "Prod Sentry",
                details: {
                    displayName: "Prod Sentry",
                    host: "https://sentry.io",
                    organizationSlug: "acme-prod",
                },
            },
        ]);
        expect(JSON.stringify(defaults)).not.toContain("secret-token");
        expect(JSON.stringify(defaults)).not.toContain("projectId");
    });
});
