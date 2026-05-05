import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeState } from "@kletron/server/services/oauthProviders";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
const getWorkspaceById = vi.hoisted(() => vi.fn());
const createIntegration = vi.hoisted(() => vi.fn());

vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
    requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

vi.mock("@kletron/server/services/workspaceService", () => ({
    getWorkspaceById: (...args: unknown[]) => getWorkspaceById(...args),
}));

vi.mock("@kletron/server/services/connectorsService", () => ({
    createIntegration: (...args: unknown[]) => createIntegration(...args),
}));

import { GET as startGoogleOAuth } from "../app/api/auth/connect/[provider]/route";
import { GET as finishGoogleOAuth } from "../app/api/auth/connect/[provider]/callback/route";

const MONGO_USER_ID = "69f9eecb6de5cfce219eaa41";
const ORIGINAL_NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const ORIGINAL_GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const ORIGINAL_GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

function decodeState(raw: string) {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("Google OAuth routes", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        process.env.NEXT_PUBLIC_APP_URL = "https://www.kletron.com";
        process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
        process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
        requireAppRouteAuth.mockResolvedValue({
            userId: MONGO_USER_ID,
            authType: "session",
        });
        getWorkspaceById.mockResolvedValue({
            _id: "workspace-1",
            ownerId: MONGO_USER_ID,
            name: "Business",
            rootPath: "/tmp/business",
        });
        createIntegration.mockResolvedValue(undefined);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (ORIGINAL_NEXT_PUBLIC_APP_URL === undefined) {
            delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
            process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_NEXT_PUBLIC_APP_URL;
        }

        if (ORIGINAL_GOOGLE_OAUTH_CLIENT_ID === undefined) {
            delete process.env.GOOGLE_OAUTH_CLIENT_ID;
        } else {
            process.env.GOOGLE_OAUTH_CLIENT_ID = ORIGINAL_GOOGLE_OAUTH_CLIENT_ID;
        }

        if (ORIGINAL_GOOGLE_OAUTH_CLIENT_SECRET === undefined) {
            delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        } else {
            process.env.GOOGLE_OAUTH_CLIENT_SECRET = ORIGINAL_GOOGLE_OAUTH_CLIENT_SECRET;
        }
    });

    it("starts OAuth from the canonical public origin and uses Google scopes", async () => {
        const request = new Request(
            "https://www.kletron.com/api/auth/connect/gmail?workspaceId=workspace-1&redirect=/app/config/connectors"
        );

        const response = await startGoogleOAuth(request, {
            params: Promise.resolve({ provider: "gmail" }),
        });

        expect(response.status).toBe(307);
        const location = new URL(response.headers.get("location") ?? "");

        expect(location.origin).toBe("https://accounts.google.com");
        expect(location.pathname).toBe("/o/oauth2/v2/auth");
        expect(location.searchParams.get("client_id")).toBe("client-id");
        expect(location.searchParams.get("redirect_uri")).toBe(
            "https://www.kletron.com/api/auth/connect/gmail/callback"
        );
        expect(location.searchParams.get("response_type")).toBe("code");
        expect(location.searchParams.get("access_type")).toBe("offline");
        expect(location.searchParams.get("prompt")).toBe("consent");

        const scopes = (location.searchParams.get("scope") ?? "").split(/\s+/).filter(Boolean);
        expect(scopes).toEqual(
            expect.arrayContaining([
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.metadata",
            ])
        );

        const state = decodeState(location.searchParams.get("state") ?? "");
        expect(state).toMatchObject({
            workspaceId: "workspace-1",
            userId: MONGO_USER_ID,
            providerId: "gmail",
            redirect: "/app/config/connectors",
        });
    });

    it("sanitizes malicious redirect values before sending the user to login", async () => {
        requireAppRouteAuth.mockResolvedValueOnce(null);

        const request = new Request(
            "https://www.kletron.com/api/auth/connect/gmail?workspaceId=workspace-1&redirect=https://evil.example"
        );

        const response = await startGoogleOAuth(request, {
            params: Promise.resolve({ provider: "gmail" }),
        });

        expect(response.status).toBe(307);
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.pathname).toBe("/auth/login");
        expect(location.searchParams.get("redirect")).toBe("/app/config/connectors");
    });

    it("finishes OAuth with the canonical public callback URL", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                access_token: "access-token",
                refresh_token: "refresh-token",
                scope:
                    "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.metadata",
            }),
        });

        const state = encodeState({
            workspaceId: "workspace-1",
            userId: MONGO_USER_ID,
            providerId: "gmail",
            iat: Date.now(),
            redirect: "/app/config/connectors",
        });
        const request = new Request(
            `https://www.kletron.com/api/auth/connect/gmail/callback?code=code-123&state=${state}`
        );

        const response = await finishGoogleOAuth(request, {
            params: Promise.resolve({ provider: "gmail" }),
        });

        expect(fetchMock).toHaveBeenCalledOnce();
        const tokenRequest = fetchMock.mock.calls[0]!;
        expect(tokenRequest[0]).toBe("https://oauth2.googleapis.com/token");
        const body = String((tokenRequest[1] as RequestInit | undefined)?.body ?? "");
        const params = new URLSearchParams(body);
        expect(params.get("client_id")).toBe("client-id");
        expect(params.get("client_secret")).toBe("client-secret");
        expect(params.get("redirect_uri")).toBe(
            "https://www.kletron.com/api/auth/connect/gmail/callback"
        );

        expect(createIntegration).toHaveBeenCalledWith("workspace-1", {
            providerId: "gmail",
            displayName: undefined,
            credentials: {
                refreshToken: "refresh-token",
                accessToken: "access-token",
            },
            scopes: [
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.metadata",
            ],
        });

        expect(response.status).toBe(307);
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.origin).toBe("https://www.kletron.com");
        expect(location.pathname).toBe("/app/config/connectors");
        expect(location.searchParams.get("connected")).toBe("gmail");
    });
});
