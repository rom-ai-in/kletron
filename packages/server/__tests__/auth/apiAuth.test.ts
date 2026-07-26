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

  describe("dev auth bypass", () => {
    const anonymousRequest = (host: string) =>
      new Request(`${TEST_URL}/api/sessions`, { headers: { host } });

    it("is off in production", async () => {
      process.env.NODE_ENV = "production";
      const { getAppRouteAuth } = await loadApiAuth();
      expect(await getAppRouteAuth(anonymousRequest("localhost:3000"))).toBeNull();
    });

    // Gating on `NODE_ENV !== 'production'` meant any deployment that simply
    // forgot to set NODE_ENV authenticated anonymous callers as dev-user.
    it("is off when NODE_ENV is unset", async () => {
      delete process.env.NODE_ENV;
      const { getAppRouteAuth } = await loadApiAuth();
      expect(await getAppRouteAuth(anonymousRequest("localhost:3000"))).toBeNull();
    });

    it("is off for an unrecognised NODE_ENV", async () => {
      process.env.NODE_ENV = "staging";
      const { getAppRouteAuth } = await loadApiAuth();
      expect(await getAppRouteAuth(anonymousRequest("localhost:3000"))).toBeNull();
    });

    it("is on for local development from a loopback host", async () => {
      process.env.NODE_ENV = "development";
      const { getAppRouteAuth } = await loadApiAuth();
      const auth = await getAppRouteAuth(anonymousRequest("localhost:3000"));
      expect(auth).toEqual({ userId: "dev-user", authType: "session" });
    });

    // `host.includes('localhost')` accepted any attacker-controlled hostname
    // that merely contained the substring.
    it("does not accept a host that only contains 'localhost'", async () => {
      process.env.NODE_ENV = "development";
      const { getAppRouteAuth } = await loadApiAuth();
      for (const host of [
        "notlocalhost.example.com",
        "localhost.attacker.com",
        "evil.com#localhost",
      ]) {
        expect(await getAppRouteAuth(anonymousRequest(host))).toBeNull();
      }
    });

    it("accepts loopback IP forms with a port", async () => {
      process.env.NODE_ENV = "development";
      const { getAppRouteAuth } = await loadApiAuth();
      for (const host of ["127.0.0.1:3000", "[::1]:3000", "localhost"]) {
        expect(await getAppRouteAuth(anonymousRequest(host))).toEqual({
          userId: "dev-user",
          authType: "session",
        });
      }
    });

    it("can be disabled explicitly even in development", async () => {
      process.env.NODE_ENV = "development";
      process.env.KLETRON_AUTH_BYPASS = "false";
      const { getAppRouteAuth } = await loadApiAuth();
      expect(await getAppRouteAuth(anonymousRequest("localhost:3000"))).toBeNull();
    });
  });

  describe("IDE tokens", () => {
    it("rejects IDE tokens in production when no secret is configured", async () => {
      process.env.NODE_ENV = "production";
      const { SignJWT } = await import("jose");
      // Signed with the constant this repository used to ship.
      const forged = await new SignJWT({ sub: SESSION_USER_ID, type: "ide_access" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(new TextEncoder().encode("ide-secret-key-change-in-production"));

      const { getAppRouteAuth } = await loadApiAuth();
      const auth = await getAppRouteAuth(
        new Request(`${TEST_URL}/api/sessions`, {
          headers: { host: "www.kletron.com", authorization: `Bearer ${forged}` },
        }),
      );

      expect(auth).toBeNull();
    });
  });
});
