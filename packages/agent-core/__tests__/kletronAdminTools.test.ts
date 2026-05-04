import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
    mockGetWorkspaceContext: vi.fn(),
    mockAuditLog: vi.fn(async () => undefined),
    mockAgentGraphService: {
        listGraphs: vi.fn(),
        getGraph: vi.fn(),
        createGraph: vi.fn(),
        updateGraph: vi.fn(),
        deleteGraph: vi.fn(),
    },
    mockAutomationExecutor: {
        listAutomations: vi.fn(),
        getAutomation: vi.fn(),
        createAutomation: vi.fn(),
        updateAutomation: vi.fn(),
        deleteAutomation: vi.fn(),
        runAutomationAsThread: vi.fn(),
    },
}));

const { mockGetWorkspaceContext, mockAuditLog } = hoisted;
const mockAgentGraphService = hoisted.mockAgentGraphService;
const mockAutomationExecutor = hoisted.mockAutomationExecutor;

vi.mock("@kletron/server/workspace/workspaceContext", () => ({
    getWorkspaceContext: () => hoisted.mockGetWorkspaceContext(),
}));

vi.mock("@kletron/server/services/agentAuditService", () => ({
    agentAuditService: { log: hoisted.mockAuditLog },
}));

vi.mock("@kletron/server/services/agentGraphService", () => ({
    agentGraphService: hoisted.mockAgentGraphService,
}));

vi.mock("@kletron/server/services/automationExecutor", () => ({
    automationExecutor: hoisted.mockAutomationExecutor,
}));

vi.mock("@kletron/server/services/skillsService", () => ({
    listSkills: vi.fn(async () => []),
    getSkillBySlug: vi.fn(async () => null),
    createSkill: vi.fn(async () => ({ slug: "x" })),
    updateSkill: vi.fn(async () => ({ slug: "x" })),
    deleteSkill: vi.fn(async () => true),
    listWorkspaceSkills: vi.fn(async () => []),
    setWorkspaceSkill: vi.fn(async () => ({ enabled: true })),
    removeWorkspaceSkill: vi.fn(async () => true),
}));

vi.mock("@kletron/server/services/connectorsService", () => ({
    listIntegrations: vi.fn(async () => []),
    createIntegration: vi.fn(async () => ({ id: "i1" })),
    deleteIntegration: vi.fn(async () => true),
    listMcpServers: vi.fn(async () => []),
    createMcpServer: vi.fn(async () => ({ id: "s1" })),
    deleteMcpServer: vi.fn(async () => true),
}));

vi.mock("@kletron/server/services/pluginsService", () => ({
    listInstalledPluginIds: vi.fn(async () => []),
    installPlugin: vi.fn(async () => undefined),
    removePlugin: vi.fn(async () => true),
    listPluginDefinitions: vi.fn(() => [
        { id: "demo", name: "Demo", description: "", skillSlugs: [] },
    ]),
}));

import { KLETRON_ADMIN_TOOL_NAMES } from "@kletron/agent-core/tools/kletronAdminToolNames";
import {
    kletronAdminTools,
    kletronListGraphs,
    kletronCreateGraph,
    kletronDeleteGraph,
} from "@kletron/agent-core/tools/kletronAdminTools";

describe("kletronAdminTools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetWorkspaceContext.mockReturnValue({
            workspaceId: "ws1",
            userId: "u1",
            runId: "r1",
            rootPath: "/tmp/repo",
            workspace: { _id: "ws1" },
        });
    });

    it("exposes a non-empty admin tool name list that matches the pack", () => {
        expect(KLETRON_ADMIN_TOOL_NAMES.length).toBeGreaterThan(0);
        expect(new Set(KLETRON_ADMIN_TOOL_NAMES).size).toBe(
            KLETRON_ADMIN_TOOL_NAMES.length
        );
        expect(kletronAdminTools.length).toBe(KLETRON_ADMIN_TOOL_NAMES.length);
        const derived = kletronAdminTools
            .map((t: { name?: string }) => String(t?.name ?? ""))
            .sort();
        const listed = [...KLETRON_ADMIN_TOOL_NAMES].sort();
        expect(derived).toEqual(listed);
    });

    it("kletron_list_graphs calls the service and audits success", async () => {
        mockAgentGraphService.listGraphs.mockResolvedValue([
            {
                _id: { toString: () => "g1" },
                name: "Test",
                description: "",
                nodes: [],
                edges: [],
                updatedAt: new Date(),
            },
        ]);
        const result = await (kletronListGraphs as any).invoke({});
        expect(JSON.parse(result)[0]).toMatchObject({ id: "g1", name: "Test" });
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: "kletron_list_graphs",
                outcome: "success",
                userId: "u1",
                workspaceId: "ws1",
            })
        );
    });

    it("kletron_create_graph creates and audits", async () => {
        mockAgentGraphService.createGraph.mockResolvedValue("new-graph-id");
        const result = await (kletronCreateGraph as any).invoke({
            name: "demo",
            nodes: [
                {
                    id: "n1",
                    label: "node",
                    react: {
                        systemPrompt: "do",
                        userPromptTemplate: "{{state}}",
                        toolNames: [],
                    },
                    output: { schemaId: "generic_json" },
                },
            ],
            edges: [],
        });
        expect(JSON.parse(result).id).toBe("new-graph-id");
        expect(mockAgentGraphService.createGraph).toHaveBeenCalled();
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ tool: "kletron_create_graph", outcome: "success" })
        );
    });

    it("kletron_delete_graph requires confirm=true", async () => {
        await expect(
            (kletronDeleteGraph as any).invoke({
                graphId: "g1",
                confirm: false,
            })
        ).rejects.toThrow();
    });

    it("refuses to act when run identity is missing", async () => {
        mockGetWorkspaceContext.mockReturnValue({
            workspaceId: "ws1",
            rootPath: "/tmp",
            workspace: { _id: "ws1" },
        });
        await expect((kletronListGraphs as any).invoke({})).rejects.toThrow(
            /User identity missing/
        );
    });
});
