import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
  requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const getRun = vi.hoisted(() => vi.fn());
const updateRunStatus = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphRunService", () => ({
  agentGraphRunService: {
    getRun: (...args: unknown[]) => getRun(...args),
    updateRunStatus: (...args: unknown[]) => updateRunStatus(...args),
  },
}));

const stopRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/codexExecutionService", () => ({
  codexExecutionService: {
    stopRun: (...args: unknown[]) => stopRun(...args),
  },
}));

import { POST } from "../app/api/sessions/[id]/stop/route";

describe("POST /api/sessions/[id]/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppRouteAuth.mockResolvedValue({ userId: "user-1", authType: "session" });
    updateRunStatus.mockResolvedValue(undefined);
    stopRun.mockResolvedValue(undefined);
  });

  it("interrupts codex turn before marking run completed", async () => {
    getRun.mockResolvedValue({
      _id: "run-codex-1",
      status: "RUNNING",
      executionBackend: "codex",
    });

    const req = new Request("http://localhost/api/sessions/run-codex-1/stop", { method: "POST" });
    const res = await POST(req, { params: { id: "run-codex-1" } });

    expect(res.status).toBe(200);
    expect(stopRun).toHaveBeenCalledWith("run-codex-1");
    expect(updateRunStatus).toHaveBeenCalled();
  });
});
