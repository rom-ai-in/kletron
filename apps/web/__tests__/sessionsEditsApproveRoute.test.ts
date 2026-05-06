import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
  requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const resolveWorkspaceFromRequest = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/workspaceService", () => ({
  resolveWorkspaceFromRequest: (...args: unknown[]) => resolveWorkspaceFromRequest(...args),
}));

const getRun = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/agentGraphRunService", () => ({
  agentGraphRunService: {
    getRun: (...args: unknown[]) => getRun(...args),
  },
}));

const listPendingApprovals = vi.hoisted(() => vi.fn());
const resolveApproval = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/codexExecutionService", () => ({
  codexExecutionService: {
    listPendingApprovals: (...args: unknown[]) => listPendingApprovals(...args),
    resolveApproval: (...args: unknown[]) => resolveApproval(...args),
  },
}));

import { POST } from "../app/api/sessions/[id]/edits/approve/route";

describe("POST /api/sessions/[id]/edits/approve (codex)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppRouteAuth.mockResolvedValue({ userId: "user-1", authType: "session" });
    resolveWorkspaceFromRequest.mockResolvedValue({
      _id: "workspace-1",
      rootPath: "/tmp/workspace-1",
    });
    getRun.mockResolvedValue({
      _id: "run-codex-1",
      executionBackend: "codex",
      state: {
        approvals: { pending: [], granted: [], rejected: [] },
      },
    });
    listPendingApprovals.mockReturnValue([]);
    resolveApproval.mockResolvedValue(true);
  });

  it("accepts acceptForSession decisions for codex approvals", async () => {
    const req = new Request("http://localhost/api/sessions/run-codex-1/edits/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editId: "codex-approval-1", decision: "acceptForSession" }),
    });

    const res = await POST(req, { params: { id: "run-codex-1" } });
    expect(res.status).toBe(200);
    expect(resolveApproval).toHaveBeenCalledWith("run-codex-1", "codex-approval-1", "acceptForSession");
  });
});
