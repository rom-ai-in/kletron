import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

const apiTokenServiceMock = vi.hoisted(() => ({
  findTokenByHash: vi.fn(),
  updateLastUsed: vi.fn(),
}));

vi.mock("@kletron/server/services/apiTokenService", () => apiTokenServiceMock);

const TEST_SECRET = "test-secret-for-api-auth";
const TEST_URL = "https://www.kletron.com";
const SESSION_USER_ID = "507f1f77bcf86cd799439011";

const envKeys = [
  "NODE_ENV",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "KLETRON_AUTH_BYPASS",
  "MCP_INTERNAL_TOKEN",
  "KLETRON_INTERNAL_TOKEN",
  "KLETRON_DEV_USER_ID",
] as const;

type EnvKey = (typeof envKeys)[number];

let previousEnv: Partial<Record<EnvKey, string | undefined>> = {};

function snapshotEnv() {
  previousEnv = {};
  for (const key of envKeys) {
    previousEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of envKeys) {
    const value = previousEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeBrowserRequest(cookie: string): Request {
  return new Request(`${TEST_URL}/api/sessions?limit=50&workMode=code`, {
    headers: {
      cookie,
    },
  });
}

async function loadApiAuth() {
  return import("@kletron/server/lib/auth/apiAuth");
}

describe("apiAuth", () => {
  beforeEach(() => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_URL = TEST_URL;
    delete process.env.KLETRON_AUTH_BYPASS;
    delete process.env.MCP_INTERNAL_TOKEN;
    delete process.env.KLETRON_INTERNAL_TOKEN;
    delete process.env.KLETRON_DEV_USER_ID;
    apiTokenServiceMock.findTokenByHash.mockReset();
    apiTokenServiceMock.updateLastUsed.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("accepts NextAuth session cookies for browser app routes", async () => {
    const token = await encode({
      token: { id: SESSION_USER_ID },
      secret: TEST_SECRET,
      maxAge: 30 * 24 * 60 * 60,
    });

    const { getAppRouteAuth } = await loadApiAuth();
    const auth = await getAppRouteAuth(
      makeBrowserRequest(`__Secure-next-auth.session-token=${token}`),
    );

    expect(auth).toEqual({ userId: SESSION_USER_ID, authType: "session" });
  });

  it("prefers a valid browser session cookie over an invalid bearer header", async () => {
    const token = await encode({
      token: { id: SESSION_USER_ID },
      secret: TEST_SECRET,
      maxAge: 30 * 24 * 60 * 60,
    });

    const { getAppRouteAuth } = await loadApiAuth();
    const auth = await getAppRouteAuth(
      new Request(`${TEST_URL}/api/sessions?limit=50&workMode=code`, {
        headers: {
          cookie: `__Secure-next-auth.session-token=${token}`,
          authorization: "Bearer definitely-not-a-valid-token",
        },
      }),
    );

    expect(auth).toEqual({ userId: SESSION_USER_ID, authType: "session" });
  });

  it("accepts NextAuth session cookies for pages routes too", async () => {
    const token = await encode({
      token: { id: SESSION_USER_ID },
      secret: TEST_SECRET,
      maxAge: 30 * 24 * 60 * 60,
    });

    const { getPagesRouteAuth } = await loadApiAuth();
    const auth = await getPagesRouteAuth({
      headers: {},
      cookies: {
        "__Secure-next-auth.session-token": token,
      },
    } as any);

    expect(auth).toEqual({ userId: SESSION_USER_ID, authType: "session" });
  });

  it("rejects non-Mongo session ids in production", async () => {
    const token = await encode({
      token: { id: "test-user-1" },
      secret: TEST_SECRET,
      maxAge: 30 * 24 * 60 * 60,
    });

    const { getAppRouteAuth } = await loadApiAuth();
    const auth = await getAppRouteAuth(
      makeBrowserRequest(`__Secure-next-auth.session-token=${token}`),
    );

    expect(auth).toBeNull();
  });

  it("still accepts bearer API tokens", async () => {
    const { API_TOKEN_PREFIX, hashApiToken } = await import("@kletron/server/lib/auth/apiTokens");
    const rawToken = `${API_TOKEN_PREFIX}abcdef123456`;
    apiTokenServiceMock.findTokenByHash.mockResolvedValue({
      _id: "token-id",
      userId: "user-456",
      tokenHash: hashApiToken(rawToken),
      label: "test",
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });

    const { getAppRouteAuth } = await loadApiAuth();
    const auth = await getAppRouteAuth(
      new Request(`${TEST_URL}/api/sessions?limit=50&workMode=code`, {
        headers: {
          authorization: `Bearer ${rawToken}`,
        },
      }),
    );

    expect(auth).toEqual({ userId: "user-456", authType: "api-token" });
    expect(apiTokenServiceMock.findTokenByHash).toHaveBeenCalledWith(hashApiToken(rawToken));
  });

  it("still accepts internal service tokens", async () => {
    process.env.MCP_INTERNAL_TOKEN = "internal-token";

    const { getAppRouteAuth } = await loadApiAuth();
    const auth = await getAppRouteAuth(
      new Request(`${TEST_URL}/api/sessions?limit=50&workMode=code`, {
        headers: {
          "x-mcp-internal-token": "internal-token",
          "x-on-behalf-of": "user-789",
        },
      }),
    );

    expect(auth).toEqual({
      userId: "user-789",
      authType: "internal",
      onBehalfOf: "user-789",
    });
  });
});
