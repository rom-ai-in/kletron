import { describe, expect, it } from "vitest";

import {
    filterGmailMessagesLocally,
    isGmailMetadataQueryScopeError,
    parseGmailLocalQuery,
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
    from: "leonor@newco.ch",
    to: "romain@numezis.com",
    date: new Date().toUTCString(),
};

describe("googleWorkspaceTools Gmail fallback helpers", () => {
    it("detects the Gmail metadata q-parameter scope error", () => {
        expect(
            isGmailMetadataQueryScopeError(
                new Error("Google API request failed (403): Metadata scope does not support 'q' parameter")
            )
        ).toBe(true);
    });

    it("extracts label and field terms from a Gmail query", () => {
        const parsed = parseGmailLocalQuery("in:inbox is:unread from:leonor@newco.ch subject:UBS newer_than:7d");
        expect(parsed.labelIds).toEqual(["INBOX", "UNREAD"]);
        expect(parsed.fromTerms).toEqual(["leonor@newco.ch"]);
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
            "in:inbox from:leonor@newco.ch subject:UBS"
        );

        expect(filtered.filtered.map((message) => message.id)).toEqual(["msg-1"]);
        expect(filtered.warnings).toEqual([]);
    });
});
