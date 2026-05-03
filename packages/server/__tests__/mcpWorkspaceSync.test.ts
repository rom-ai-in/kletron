import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSyncExternalServers = vi.fn(async () => {});

vi.mock("@kletron/mcp-client/client", () => ({
    McpClient: {
        getInstance: vi.fn(async () => ({
            syncExternalServers: mockSyncExternalServers,
        })),
    },
}));

vi.mock("../src/services/connectorsService", () => ({
    getExternalMcpRuntimeConfig: vi.fn(),
}));

import { McpClient } from "@kletron/mcp-client/client";
import { syncWorkspaceExternalMcpServers } from "../src/services/mcpWorkspaceSync";
import { getExternalMcpRuntimeConfig } from "../src/services/connectorsService";

describe("syncWorkspaceExternalMcpServers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps DB configs into McpClient.syncExternalServers(workspaceId, …)", async () => {
        vi.mocked(getExternalMcpRuntimeConfig).mockResolvedValue([
            {
                id: "id1",
                slug: "hunter",
                name: "Hunter",
                transport: "stdio",
                command: "npx",
                args: ["-y", "@scope/hunter-mcp"],
                env: { FOO: "bar" },
            },
            {
                id: "id2",
                slug: "slack",
                name: "Slack",
                transport: "sse",
                url: "http://localhost:9/mcp",
                headers: { Authorization: "Bearer x" },
            },
        ]);

        await syncWorkspaceExternalMcpServers("ws-abc");

        expect(McpClient.getInstance).toHaveBeenCalledOnce();
        expect(mockSyncExternalServers).toHaveBeenCalledOnce();
        const [workspaceId, configs] = mockSyncExternalServers.mock.calls[0]!;
        expect(workspaceId).toBe("ws-abc");
        expect(configs).toHaveLength(2);
        expect(configs[0]).toMatchObject({
            id: "id1",
            slug: "hunter",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@scope/hunter-mcp"],
            env: { FOO: "bar" },
        });
        expect(configs[1]).toMatchObject({
            id: "id2",
            slug: "slack",
            transport: "sse",
            url: "http://localhost:9/mcp",
            headers: { Authorization: "Bearer x" },
        });
    });

    it("no-ops on blank workspace id", async () => {
        await syncWorkspaceExternalMcpServers("   ");
        expect(getExternalMcpRuntimeConfig).not.toHaveBeenCalled();
        expect(McpClient.getInstance).not.toHaveBeenCalled();
    });

    it("propagates empty config list to clear workspace connectors", async () => {
        vi.mocked(getExternalMcpRuntimeConfig).mockResolvedValue([]);
        await syncWorkspaceExternalMcpServers("ws-empty");
        expect(mockSyncExternalServers).toHaveBeenCalledWith("ws-empty", []);
    });
});
