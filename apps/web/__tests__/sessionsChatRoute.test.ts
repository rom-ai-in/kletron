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
        continueRun.mockResolvedValue({
            sessionId: "run-1",
            timeline: [],
            conclusion: "done",
            outputs: {},
            eventStream: [],
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
        expect(continueRun.mock.calls[0]?.[2]?.workspaceContextUserId).toBe("user-1");
    });
});
