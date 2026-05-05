import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
    requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const resolveGraphForStage = vi.hoisted(() => vi.fn());
const listGraphs = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphService", () => ({
    agentGraphService: {
        resolveGraphForStage: (...args: unknown[]) => resolveGraphForStage(...args),
        listGraphs: (...args: unknown[]) => listGraphs(...args),
    },
}));

const createRun = vi.hoisted(() => vi.fn());
const updateRunStatus = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphRunService", () => ({
    agentGraphRunService: {
        createRun: (...args: unknown[]) => createRun(...args),
        updateRunStatus: (...args: unknown[]) => updateRunStatus(...args),
    },
}));

const preflightMissionForNewRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/skillSlashPreflight", () => ({
    preflightMissionForNewRun: (...args: unknown[]) => preflightMissionForNewRun(...args),
}));

const resolveEffectiveToolApprovalConfigForUser = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/effectiveToolApprovalService", () => ({
    resolveEffectiveToolApprovalConfigForUser: (...args: unknown[]) =>
        resolveEffectiveToolApprovalConfigForUser(...args),
}));

const resolveWorkspaceFromRequestStrict = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceService", () => ({
    resolveWorkspaceFromRequestStrict: (...args: unknown[]) => resolveWorkspaceFromRequestStrict(...args),
    workspaceErrorToHttp: () => null,
}));

const getWorkspaceContextConfig = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/auditContextService", () => ({
    getWorkspaceContextConfig: (...args: unknown[]) => getWorkspaceContextConfig(...args),
}));

const resolveWorkspaceCapabilities = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceCapabilityResolver", () => ({
    resolveWorkspaceCapabilities: (...args: unknown[]) => resolveWorkspaceCapabilities(...args),
}));

const workspaceChannelSettingsGet = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceChannelSettingsService", () => ({
    workspaceChannelSettingsService: {
        get: (...args: unknown[]) => workspaceChannelSettingsGet(...args),
    },
}));

const getCurrentCategory = vi.hoisted(() => vi.fn());
const setCurrentCategory = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/categoryService", () => ({
    categoryService: {
        getCurrentCategory: (...args: unknown[]) => getCurrentCategory(...args),
        setCurrentCategory: (...args: unknown[]) => setCurrentCategory(...args),
    },
}));

const executeRunStreaming = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphExecutor", () => ({
    agentGraphExecutor: {
        executeRunStreaming: (...args: unknown[]) => executeRunStreaming(...args),
    },
}));

import { POST } from "../app/api/sessions/route";

const now = new Date("2026-05-05T08:00:00.000Z");

function makeGraph(id: string, name: string, routing?: Record<string, unknown>) {
    return {
        _id: id,
        name,
        category: "graph",
        createdAt: now,
        updatedAt: now,
        nodes: [
            {
                id: "node-1",
                label: "Node 1",
                react: {
                    systemPrompt: "prompt",
                    userPromptTemplate: "{{mission}}",
                    toolNames: [],
                },
                output: { schemaId: "conversational" },
            },
        ],
        edges: [],
        routing,
    };
}

async function readNdjson(response: Response) {
    const text = await response.text();
    return text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

describe("POST /api/sessions", () => {
    const coderGraph = makeGraph("graph-coder", "Coder Agent (agent graph)", {
        keywords: ["fix", "bug"],
        preferredWorkModes: ["code"],
    });
    const opsGraph = makeGraph("graph-ops", "Operations & Incident Response (work graph)", {
        intents: ["sentry", "incident"],
        keywords: ["sentry", "error", "incident"],
        requiredConnectors: ["sentry"],
        preferredWorkModes: ["work"],
    });
    const gtmGraph = makeGraph("graph-gtm", "Company Growth & GTM (work graph)", {
        keywords: ["gtm", "pipeline"],
        preferredWorkModes: ["work"],
    });

    beforeEach(() => {
        vi.clearAllMocks();
        requireAppRouteAuth.mockResolvedValue({ userId: "user-1", authType: "session" });
        resolveEffectiveToolApprovalConfigForUser.mockResolvedValue({
            defaultThreadApprovalMode: "inherit",
        });
        resolveWorkspaceFromRequestStrict.mockResolvedValue({
            _id: "workspace-1",
            ownerId: "owner-1",
            name: "Business",
            rootPath: "/tmp/business",
        });
        getWorkspaceContextConfig.mockResolvedValue({
            enabled: true,
            context: null,
            injection: {},
        });
        resolveWorkspaceCapabilities.mockResolvedValue({
            workspaceId: "workspace-1",
            enabledSkills: [],
            enabledTools: [],
            enabledToolSet: new Set<string>(),
            enabledIntegrationProviderIds: [],
            externalMcpServers: [],
        });
        workspaceChannelSettingsGet.mockResolvedValue(null);
        getCurrentCategory.mockResolvedValue("work");
        setCurrentCategory.mockResolvedValue(undefined);
        listGraphs.mockResolvedValue([coderGraph, opsGraph, gtmGraph]);
        resolveGraphForStage.mockImplementation(async (graphId?: string) => {
            if (!graphId) return coderGraph;
            return [coderGraph, opsGraph, gtmGraph].find((graph) => graph._id === graphId) ?? coderGraph;
        });
        createRun.mockResolvedValue("run-1");
        updateRunStatus.mockResolvedValue(undefined);
        preflightMissionForNewRun.mockImplementation(async (message: string) => ({
            mission: message,
            loadedSkillIds: [],
            skillLoads: [],
        }));
        executeRunStreaming.mockResolvedValue({
            sessionId: "run-1",
            timeline: [],
            conclusion: "done",
            outputs: {},
            eventStream: [],
        });
    });

    it("keeps the explicit graph in manual mode even for a Sentry-like message", async () => {
        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphId: coderGraph._id,
                graphSelectionMode: "manual",
                message: "utilise sentry et dis moi ou on en est",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.type).toBe("init");
        expect(chunks[0]?.payload.graphId).toBe(coderGraph._id);
        expect(chunks[0]?.payload.route?.source).toBe("explicit_graph");
        expect(updateRunStatus.mock.calls[0]?.[2]?.state?.route?.source).toBe("explicit_graph");
    });

    it("auto-routes to the ops graph for a vague Sentry request when Sentry is active", async () => {
        resolveWorkspaceCapabilities.mockResolvedValueOnce({
            workspaceId: "workspace-1",
            enabledSkills: [],
            enabledTools: [],
            enabledToolSet: new Set<string>(),
            enabledIntegrationProviderIds: ["sentry"],
            externalMcpServers: [],
        });

        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphSelectionMode: "auto",
                message: "utilise sentry et dis moi ou on en est avec les erreurs",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.payload.graphId).toBe(opsGraph._id);
        expect(chunks[0]?.payload.route?.source).toBe("auto_router");
        expect(chunks[0]?.payload.route?.resolvedGraphName).toBe(opsGraph.name);
    });

    it("prefers overrideGraphId over auto-routing and workspace channel default", async () => {
        resolveWorkspaceCapabilities.mockResolvedValueOnce({
            workspaceId: "workspace-1",
            enabledSkills: [],
            enabledTools: [],
            enabledToolSet: new Set<string>(),
            enabledIntegrationProviderIds: ["sentry"],
            externalMcpServers: [],
        });
        workspaceChannelSettingsGet.mockResolvedValueOnce({
            enabled: true,
            defaultGraphId: gtmGraph._id,
        });

        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphSelectionMode: "auto",
                overrideGraphId: coderGraph._id,
                channel: "slack",
                message: "incident sentry en prod",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.payload.graphId).toBe(coderGraph._id);
        expect(chunks[0]?.payload.route?.source).toBe("channel_override");
    });

    it("falls back to the workspace channel default when auto-routing is not confident", async () => {
        workspaceChannelSettingsGet.mockResolvedValueOnce({
            enabled: true,
            defaultGraphId: gtmGraph._id,
        });

        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphSelectionMode: "auto",
                channel: "slack",
                message: "bonjour",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.payload.graphId).toBe(gtmGraph._id);
        expect(chunks[0]?.payload.route?.source).toBe("workspace_channel_default");
    });
});
