import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
    requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const resolveGraphForStage = vi.hoisted(() => vi.fn());
const listGraphs = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphService", () => ({
    agentGraphService: {
        getGraph: (...args: unknown[]) => resolveGraphForStage(...args),
        resolveGraphForStage: (...args: unknown[]) => resolveGraphForStage(...args),
        listGraphs: (...args: unknown[]) => listGraphs(...args),
    },
}));

const createRun = vi.hoisted(() => vi.fn());
const updateRunStatus = vi.hoisted(() => vi.fn());
const getRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphRunService", () => ({
    agentGraphRunService: {
        createRun: (...args: unknown[]) => createRun(...args),
        updateRunStatus: (...args: unknown[]) => updateRunStatus(...args),
        getRun: (...args: unknown[]) => getRun(...args),
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

const codexStartTurnStream = vi.hoisted(() => vi.fn());
const codexRegisterRunMetadata = vi.hoisted(() => vi.fn());
const codexStopRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/codexExecutionService", () => ({
    codexExecutionService: {
        startTurnStream: (...args: unknown[]) => codexStartTurnStream(...args),
        registerRunMetadata: (...args: unknown[]) => codexRegisterRunMetadata(...args),
        stopRun: (...args: unknown[]) => codexStopRun(...args),
    },
}));

const buildThreadSkillState = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceSkillStateService", () => ({
    buildThreadSkillState: (...args: unknown[]) => buildThreadSkillState(...args),
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
        getRun.mockResolvedValue({
            _id: "run-1",
            status: "RUNNING",
            state: {
                conversationHistory: [],
            },
        });
        preflightMissionForNewRun.mockImplementation(async (message: string) => ({
            mission: message,
            loadedSkillIds: [],
            skillLoads: [],
        }));
        buildThreadSkillState.mockResolvedValue({
            availableSkills: [],
            loadedSkills: [],
            pinnedSkills: [],
        });
        executeRunStreaming.mockResolvedValue({
            sessionId: "run-1",
            timeline: [],
            conclusion: "done",
            outputs: {},
            eventStream: [],
        });
        codexRegisterRunMetadata.mockResolvedValue(undefined);
        codexStopRun.mockResolvedValue(undefined);
        codexStartTurnStream.mockResolvedValue({
            threadId: "thread-1",
            turnId: "turn-1",
            events: (async function* () {
                yield { kind: "event_snapshot", events: [] };
            })(),
            completed: Promise.resolve({
                threadId: "thread-1",
                turnId: "turn-1",
                status: "completed",
                error: null,
                agentText: "done",
                reasoningText: "",
                events: [],
            }),
        });
    });

    it("uses the requested graph directly even for a Sentry-like message", async () => {
        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphId: coderGraph._id,
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
        expect(chunks[0]?.payload.skills).toEqual({
            availableSkills: [],
            loadedSkills: [],
            pinnedSkills: [],
        });
        expect(updateRunStatus.mock.calls[0]?.[2]?.state?.route).toBeUndefined();
        expect(executeRunStreaming.mock.calls[0]?.[1]?.workspaceContextUserId).toBe("user-1");
    });

    it("falls back to the default graph when graphId is missing", async () => {
        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "bonjour",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.type).toBe("init");
        expect(chunks[0]?.payload.graphId).toBe(coderGraph._id);
    });

    it("returns 404 when the requested graph does not exist", async () => {
        resolveGraphForStage.mockResolvedValueOnce(null);

        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphId: "000000000000000000000099",
                message: "incident sentry en prod",
                workMode: "work",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(404);
    });

    it("creates a run with langgraph execution by default", async () => {
        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphId: coderGraph._id,
                message: "réponds en français",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(createRun.mock.calls[0]?.[3]?.executionBackend).toBe("langgraph");
    });

    it("forces codex execution backend when provider is codex", async () => {
        const req = new Request("http://localhost/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                graphId: coderGraph._id,
                provider: "codex",
                message: "réponds vite",
                workspaceId: "workspace-1",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(createRun.mock.calls[0]?.[3]?.executionBackend).toBe("codex");
        expect(codexStartTurnStream).toHaveBeenCalled();
        expect(executeRunStreaming).not.toHaveBeenCalled();
    });
});
