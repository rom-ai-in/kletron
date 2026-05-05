import { beforeEach, describe, expect, it, vi } from "vitest";
import { probeGoogleWorkspaceConnection } from "../src/services/googleWorkspaceApi";

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

            if (url.includes("/gmail/v1/users/me/messages?maxResults=1&q=in%3Ainbox")) {
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

    it("verifies Gmail search capability, not just label listing", async () => {
        const result = await probeGoogleWorkspaceConnection("gmail", {
            accessToken: "token",
        });

        expect(result.ok).toBe(true);
        expect(result.message).toContain("label(s)");
        expect(result.message).toContain("message(s)");
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/messages?maxResults=1&q=in%3Ainbox"))).toBe(true);
    });

    it("verifies Calendar freeBusy in addition to calendar list", async () => {
        const result = await probeGoogleWorkspaceConnection("google-calendar", {
            accessToken: "token",
        });

        expect(result.ok).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/calendar/v3/freeBusy"))).toBe(true);
    });
});
