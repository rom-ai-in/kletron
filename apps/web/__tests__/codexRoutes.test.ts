import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
  requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const getHealth = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/codexExecutionService", () => ({
  codexExecutionService: {
    getHealth: (...args: unknown[]) => getHealth(...args),
    login: (...args: unknown[]) => login(...args),
  },
}));

import { GET as getHealthRoute } from "../app/api/codex/health/route";
import { POST as postLoginRoute } from "../app/api/codex/account/login/route";

describe("/api/codex routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppRouteAuth.mockResolvedValue({ userId: "user-1", authType: "session" });
    getHealth.mockResolvedValue({
      enabled: true,
      running: true,
      binaryPath: "codex",
      codexHome: "/tmp/codex",
    });
    login.mockResolvedValue({
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-1234",
    });
  });

  it("returns codex health for authenticated user", async () => {
    const res = await getHealthRoute(new Request("http://localhost/api/codex/health"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.enabled).toBe(true);
    expect(getHealth).toHaveBeenCalledWith("user-1");
  });

  it("starts login with default chatgptDeviceCode", async () => {
    const req = new Request("http://localhost/api/codex/account/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await postLoginRoute(req);
    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalledWith("user-1", "chatgptDeviceCode", undefined);
    const json = await res.json();
    expect(json.userCode).toBe("ABCD-1234");
  });
});
