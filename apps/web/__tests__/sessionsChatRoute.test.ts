import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
    requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const resolveLlmSelection = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/llm", () => ({
    resolveLlmSelection: (...args: unknown[]) => resolveLlmSelection(...args),
}));

const getRun = vi.hoisted(() => vi.fn());
const patchRun = vi.hoisted(() => vi.fn());
const updateRunStatus = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphRunService", () => ({
    agentGraphRunService: {
        getRun: (...args: unknown[]) => getRun(...args),
        patchRun: (...args: unknown[]) => patchRun(...args),
        updateRunStatus: (...args: unknown[]) => updateRunStatus(...args),
    },
}));

const setCurrentCategory = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/categoryService", () => ({
    categoryService: {
        setCurrentCategory: (...args: unknown[]) => setCurrentCategory(...args),
    },
}));

const continueRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphExecutor", () => ({
    agentGraphExecutor: {
        continueRun: (...args: unknown[]) => continueRun(...args),
    },
}));

const getGraph = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphService", () => ({
    agentGraphService: {
        getGraph: (...args: unknown[]) => getGraph(...args),
    },
}));

const buildThreadSkillState = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceSkillStateService", () => ({
    buildThreadSkillState: (...args: unknown[]) => buildThreadSkillState(...args),
}));

const resolveWorkspaceFromRequestStrict = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceService", () => ({
    resolveWorkspaceFromRequestStrict: (...args: unknown[]) => resolveWorkspaceFromRequestStrict(...args),
    workspaceErrorToHttp: () => null,
}));

const applySkillSlashPreflight = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/skillSlashPreflight", () => ({
    applySkillSlashPreflight: (...args: unknown[]) => applySkillSlashPreflight(...args),
    mergeLoadedSkillIds: (existing: string[] | undefined, toAppend: string[]) => {
        const out = [...(existing ?? [])];
        const seen = new Set(out);
        for (const id of toAppend) {
            if (!seen.has(id)) {
                seen.add(id);
                out.push(id);
            }
        }
        return out;
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

import { POST } from "../app/api/sessions/[id]/chat/route";

async function readNdjson(response: Response) {
    const text = await response.text();
    return text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

describe("POST /api/sessions/[id]/chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAppRouteAuth.mockResolvedValue({ userId: "user-1", authType: "session" });
        getRun.mockResolvedValue({
            _id: "run-1",
            graphId: { toString: () => "graph-1" },
            status: "COMPLETED",
            startedAt: new Date("2026-05-05T08:00:00.000Z"),
            endedAt: new Date("2026-05-05T08:05:00.000Z"),
            workspaceId: { toString: () => "workspace-1" },
        });
        patchRun.mockResolvedValue(undefined);
        updateRunStatus.mockResolvedValue(undefined);
        getGraph.mockResolvedValue({
            _id: "graph-1",
            name: "Coder Agent (agent graph)",
            nodes: [],
            edges: [],
        });
        buildThreadSkillState.mockResolvedValue({
            availableSkills: [],
            loadedSkills: [],
            pinnedSkills: [],
        });
        applySkillSlashPreflight.mockImplementation(async (rawMessage: string) => ({
            mission: rawMessage.trim(),
            loadedSkillIdsToAppend: [],
        }));
        continueRun.mockResolvedValue({
            sessionId: "run-1",
            timeline: [],
            conclusion: "done",
            outputs: {},
            eventStream: [],
        });
        resolveWorkspaceFromRequestStrict.mockResolvedValue({
            _id: "workspace-1",
            rootPath: "/tmp/workspace-1",
        });
        codexRegisterRunMetadata.mockResolvedValue(undefined);
        codexStopRun.mockResolvedValue(undefined);
        codexStartTurnStream.mockImplementation(async () => {
            const events = (async function* () {
                yield {
                    kind: "event_snapshot",
                    events: [
                        {
                            id: "codex-user-temp",
                            phaseId: "chat",
                            phaseLabel: "User message",
                            kind: "user",
                            role: "user",
                            content: "continue",
                            timestamp: new Date("2026-05-05T08:00:00.000Z").toISOString(),
                        },
                    ],
                };
                yield {
                    kind: "notification",
                    method: "item/agentMessage/delta",
                    params: { delta: "Hello follow-up" },
                };
            })();
            return {
                threadId: "thr_codex_1",
                turnId: "turn_codex_2",
                events,
                completed: Promise.resolve({
                    threadId: "thr_codex_1",
                    turnId: "turn_codex_2",
                    status: "completed",
                    error: null,
                    agentText: "Hello follow-up",
                    reasoningText: "",
                    events: [
                        {
                            id: "event-codex-assistant-2",
                            phaseId: "chat",
                            phaseLabel: "Assistant",
                            kind: "assistant",
                            role: "assistant",
                            content: "Hello follow-up",
                            timestamp: new Date("2026-05-05T08:00:00.000Z").toISOString(),
                        },
                    ],
                }),
            };
        });
    });

    it("continues with the authenticated user as workspace context identity", async () => {
        const req = new Request("http://localhost/api/sessions/run-1/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "je m'appelle comment ?",
            }),
        });

        const res = await POST(req, { params: { id: "run-1" } });
        expect(res.status).toBe(200);

        const chunks = await readNdjson(res);
        expect(chunks[0]?.type).toBe("init");
        expect(chunks[0]?.payload.graphId).toBe("graph-1");
        expect(chunks[0]?.payload.skills).toEqual({
            availableSkills: [],
            loadedSkills: [],
            pinnedSkills: [],
        });
        expect(continueRun.mock.calls[0]?.[2]?.workspaceContextUserId).toBe("user-1");
    });

    it("routes to codex backend when run.executionBackend is codex", async () => {
        // Multiple getRun() calls in the handler; override for the whole test (not mockResolvedValueOnce).
        getRun.mockResolvedValue({
            _id: "run-1",
            graphId: { toString: () => "graph-1" },
            status: "COMPLETED",
            startedAt: new Date("2026-05-05T08:00:00.000Z"),
            endedAt: new Date("2026-05-05T08:05:00.000Z"),
            workspaceId: { toString: () => "workspace-1" },
            executionBackend: "codex",
            codexThreadId: "thr_codex_1",
            codexModel: "gpt-5.4",
            codexSandboxMode: "read-only",
            state: {},
            conversationTurns: 1,
        });

        const req = new Request("http://localhost/api/sessions/run-1/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "continue",
                codexModel: "gpt-5.5",
            }),
        });

        const res = await POST(req, { params: { id: "run-1" } });
        expect(res.status).toBe(200);
        const chunks = await readNdjson(res);
        expect(chunks[0]?.type).toBe("init");
        expect((chunks[0] as { payload?: { turnAnchorMessage?: string } }).payload?.turnAnchorMessage).toBe(
            "continue",
        );
        const updateIdx = chunks.findIndex((c: { type?: string }) => c.type === "update");
        const textDeltaIdx = chunks.findIndex((c: { type?: string }) => c.type === "text_delta");
        const finalIdx = chunks.findIndex((c: { type?: string }) => c.type === "final");
        expect(updateIdx).toBeGreaterThanOrEqual(0);
        expect(textDeltaIdx).toBeGreaterThan(updateIdx);
        expect(finalIdx).toBeGreaterThan(textDeltaIdx);
        expect(chunks[updateIdx]).toMatchObject({
            type: "update",
            payload: {
                timeline: [],
                eventStream: [{ kind: "user", content: "continue" }],
            },
        });
        expect(chunks.some((c) => c.type === "text_delta")).toBe(true);
        expect(chunks.some((c) => c.type === "final")).toBe(true);
        expect(codexStartTurnStream).toHaveBeenCalled();
        expect(continueRun).toHaveBeenCalledTimes(0);
    });
});
