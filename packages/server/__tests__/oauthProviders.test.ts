import { afterEach, describe, expect, it, vi } from "vitest";
import {
    OAUTH_PROVIDERS,
    decodeState,
    encodeState,
} from "../src/services/oauthProviders";

describe("oauthProviders", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("locks the Google scope sets and offline auth params", () => {
        expect(OAUTH_PROVIDERS["google-drive"].authUrl).toBe(
            "https://accounts.google.com/o/oauth2/v2/auth"
        );
        expect(OAUTH_PROVIDERS["google-drive"].defaultScopes).toEqual([
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ]);
        expect(OAUTH_PROVIDERS["google-drive"].extraAuthParams).toEqual({
            access_type: "offline",
            prompt: "consent",
        });

        expect(OAUTH_PROVIDERS.gmail.defaultScopes).toEqual([
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.metadata",
        ]);
        expect(OAUTH_PROVIDERS["google-calendar"].defaultScopes).toEqual([
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.freebusy",
        ]);
    });

    it("extracts granted Google scopes and falls back to defaults", () => {
        expect(
            OAUTH_PROVIDERS["google-drive"].extractScopes?.({
                scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
            })
        ).toEqual([
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.readonly",
        ]);

        expect(OAUTH_PROVIDERS.gmail.extractScopes?.({})).toEqual([
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.metadata",
        ]);
    });

    it("round-trips state and rejects stale OAuth states", () => {
        const now = 1_700_000_000_000;
        vi.spyOn(Date, "now").mockReturnValue(now);

        const state = {
            workspaceId: "workspace-1",
            userId: "69f9eecb6de5cfce219eaa41",
            providerId: "gmail",
            iat: now,
            redirect: "/app/config/connectors",
        };
        const encoded = encodeState(state);

        expect(decodeState(encoded)).toEqual(state);
        expect(
            decodeState(
                encodeState({
                    ...state,
                    iat: now - 31 * 60 * 1000,
                })
            )
        ).toBeNull();
    });
});
