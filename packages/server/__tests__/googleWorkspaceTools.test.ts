import { describe, expect, it } from "vitest";

import {
    buildGoogleWorkspaceTools,
    filterGmailMessagesLocally,
    isGmailMetadataQueryScopeError,
    parseGmailLocalQuery,
    resolveGoogleWorkspaceUrl,
    type GmailMessageSummary,
} from "../src/services/googleWorkspaceTools";

const baseMessage: GmailMessageSummary = {
    id: "msg-1",
    threadId: "thread-1",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Potential UBS meeting follow-up",
    historyId: "1",
    internalDate: String(Date.now()),
    subject: "UBS follow-up",
    from: "alice@example.com",
    to: "bob@example.com",
    date: new Date().toUTCString(),
};

describe("googleWorkspaceTools Gmail fallback helpers", () => {
    it("preserves absolute Google Workspace URLs and prefixes relative ones exactly once", () => {
        expect(resolveGoogleWorkspaceUrl("/calendar/v3/users/me/calendarList?maxResults=1")).toBe(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1"
        );
        expect(
            resolveGoogleWorkspaceUrl("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1")
        ).toBe("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1");
    });

    it("detects the Gmail metadata q-parameter scope error", () => {
        expect(
            isGmailMetadataQueryScopeError(
                new Error("Google API request failed (403): Metadata scope does not support 'q' parameter")
            )
        ).toBe(true);
    });

    it("extracts label and field terms from a Gmail query", () => {
        const parsed = parseGmailLocalQuery("in:inbox is:unread from:alice@example.com subject:UBS newer_than:7d");
        expect(parsed.labelIds).toEqual(["INBOX", "UNREAD"]);
        expect(parsed.fromTerms).toEqual(["alice@example.com"]);
        expect(parsed.subjectTerms).toEqual(["UBS"]);
        expect(parsed.newerThanDays).toBe(7);
    });

    it("filters hydrated Gmail summaries locally when API-side querying is unavailable", () => {
        const messages: GmailMessageSummary[] = [
            baseMessage,
            {
                ...baseMessage,
                id: "msg-2",
                subject: "Unrelated note",
                from: "other@example.com",
                snippet: "Nothing about UBS here",
            },
        ];

        const filtered = filterGmailMessagesLocally(
            messages,
            "in:inbox from:alice@example.com subject:UBS"
        );

        expect(filtered.filtered.map((message) => message.id)).toEqual(["msg-1"]);
        expect(filtered.warnings).toEqual([]);
    });
});

describe("googleWorkspaceTools schemas", () => {
    it("accepts pageToken on calendar_list_events", () => {
        const tools = buildGoogleWorkspaceTools();
        const tool = tools.find((entry: any) => entry.name === "calendar_list_events");
        expect(tool).toBeTruthy();
        expect(tool.schema.safeParse({
            calendarId: "primary",
            timeMin: "2026-05-06T00:00:00+02:00",
            timeMax: "2026-05-13T23:59:59+02:00",
            pageToken: "next-token",
        }).success).toBe(true);
    });
});
