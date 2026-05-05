import { describe, expect, it } from "vitest";
import { normalizeInternalRedirect } from "../lib/safeRedirect";

describe("normalizeInternalRedirect", () => {
    it("keeps a valid same-origin path", () => {
        expect(normalizeInternalRedirect("/app/config/connectors")).toBe("/app/config/connectors");
    });

    it("rejects absolute URLs and protocol-relative URLs", () => {
        expect(normalizeInternalRedirect("https://evil.example")).toBe("/");
        expect(normalizeInternalRedirect("//evil.example")).toBe("/");
    });

    it("rejects malformed or dangerous path values", () => {
        expect(normalizeInternalRedirect("app/config/connectors")).toBe("/");
        expect(normalizeInternalRedirect("/foo\\bar")).toBe("/");
        expect(normalizeInternalRedirect("/foo\u0000bar")).toBe("/");
        expect(normalizeInternalRedirect("   ")).toBe("/");
        expect(normalizeInternalRedirect(null)).toBe("/");
        expect(normalizeInternalRedirect(undefined)).toBe("/");
    });
});
