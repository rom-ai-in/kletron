import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    googleScopeStringHasGmailMailboxApi,
    probeGoogleWorkspaceConnection,
    resolveGoogleHostedGmailMcpBearer,
} from "../src/services/googleWorkspaceApi";

describe("googleScopeStringHasGmailMailboxApi", () => {
    it("returns true for Gmail API scope URLs", () => {
        expect(
            googleScopeStringHasGmailMailboxApi(
                "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose"
            )
        ).toBe(true);
    });

    it("returns false for calendar-only or openid-only scopes", () => {
        expect(googleScopeStringHasGmailMailboxApi("openid email profile")).toBe(false);
        expect(
            googleScopeStringHasGmailMailboxApi("https://www.googleapis.com/auth/calendar.events")
        ).toBe(false);
    });
});

describe("probeGoogleWorkspaceConnection", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);

            if (url.includes("/gmail/v1/users/me/labels?maxResults=1")) {
                return new Response(JSON.stringify({ labels: [{ id: "INBOX" }] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.includes("/gmail/v1/users/me/messages?maxResults=1&includeSpamTrash=false")) {
                return new Response(JSON.stringify({ messages: [] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.includes("/calendar/v3/users/me/calendarList?maxResults=1")) {
                return new Response(JSON.stringify({ items: [{ id: "primary" }] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.includes("/calendar/v3/freeBusy")) {
                expect(init?.method).toBe("POST");
                const body = JSON.parse(String(init?.body ?? "{}")) as {
                    timeMin?: string;
                    timeMax?: string;
                    items?: Array<{ id?: string }>;
                };
                expect(body.items).toEqual([{ id: "primary" }]);
                expect(body.timeMin).toBeTruthy();
                expect(body.timeMax).toBeTruthy();
                return new Response(JSON.stringify({ calendars: { primary: { busy: [] } } }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            if (url.includes("/drive/v3/files?pageSize=1")) {
                return new Response(JSON.stringify({ files: [{ id: "file-1", name: "Doc" }] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });
    });

    it("verifies Gmail listing capability without using unsupported q filters", async () => {
        const result = await probeGoogleWorkspaceConnection("gmail", {
            accessToken: "token",
        });

        expect(result.ok).toBe(true);
        expect(result.message).toContain("label(s)");
        expect(result.message).toContain("message(s)");
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/messages?maxResults=1&includeSpamTrash=false"))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("q="))).toBe(false);
    });

    it("verifies Calendar freeBusy in addition to calendar list", async () => {
        const result = await probeGoogleWorkspaceConnection("google-calendar", {
            accessToken: "token",
        });

        expect(result.ok).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/calendar/v3/freeBusy"))).toBe(true);
    });
});

describe("resolveGoogleHostedGmailMcpBearer", () => {
    const fetchMock = vi.fn();
    const prevId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
        process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
    });

    afterEach(() => {
        process.env.GOOGLE_OAUTH_CLIENT_ID = prevId;
        process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevSecret;
    });

    it("prefers stored access_token when labels probe succeeds (no refresh)", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo) => {
            const url = String(input);
            if (url.includes("/gmail/v1/users/me/labels")) {
                return new Response(JSON.stringify({ labels: [{ id: "INBOX" }] }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            return new Response("{}", { status: 404 });
        });

        const out = await resolveGoogleHostedGmailMcpBearer({
            accessToken: "good-at",
            refreshToken: "rt",
        });

        expect(out).toBe("good-at");
        expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/oauth2.googleapis.com/token"))).toHaveLength(0);
    });

    it("falls back to refresh when stored access fails labels probe", async () => {
        let labelsCalls = 0;
        fetchMock.mockImplementation(async (input: RequestInfo) => {
            const url = String(input);
            if (url.includes("/gmail/v1/users/me/labels")) {
                labelsCalls += 1;
                if (labelsCalls === 1) {
                    return new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 });
                }
                return new Response(JSON.stringify({ labels: [] }), { status: 200 });
            }
            if (url.includes("/oauth2.googleapis.com/token")) {
                return new Response(JSON.stringify({ access_token: "from-refresh" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            return new Response("{}", { status: 404 });
        });

        const out = await resolveGoogleHostedGmailMcpBearer({
            accessToken: "bad-at",
            refreshToken: "rt",
        });

        expect(out).toBe("from-refresh");
        expect(labelsCalls).toBe(2);
    });

    it("returns null when neither token can list labels", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo) => {
            const url = String(input);
            if (url.includes("/gmail/v1/users/me/labels")) {
                return new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 });
            }
            if (url.includes("/oauth2.googleapis.com/token")) {
                return new Response(JSON.stringify({ access_token: "still-bad" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            return new Response("{}", { status: 404 });
        });

        const out = await resolveGoogleHostedGmailMcpBearer({
            accessToken: "bad-at",
            refreshToken: "rt",
        });

        expect(out).toBe(null);
    });
});
