import { describe, it, expect } from "vitest";

import {
    assertTransportSecurity,
    extractPresentedToken,
    isAuthorizedRequest,
    isLoopbackHost,
    McpAuthConfigError,
    resolveBindHost,
    resolveMcpAuthToken,
} from "../lib/httpAuth.js";

const VALID = "a".repeat(64);
const req = (headers = {}) => ({ headers });

describe("resolveMcpAuthToken", () => {
    it("returns null when nothing is configured", () => {
        expect(resolveMcpAuthToken({})).toBeNull();
    });

    it("reads the token env vars in precedence order", () => {
        const specific = "s".repeat(64);
        expect(resolveMcpAuthToken({ MCP_SERVER_TOKEN: VALID })).toBe(VALID);
        expect(resolveMcpAuthToken({ MCP_INTERNAL_TOKEN: VALID })).toBe(VALID);
        expect(resolveMcpAuthToken({ KLETRON_INTERNAL_TOKEN: VALID })).toBe(VALID);
        expect(
            resolveMcpAuthToken({ MCP_SERVER_TOKEN: specific, MCP_INTERNAL_TOKEN: VALID })
        ).toBe(specific);
    });

    // Unusable values resolve to null, which assertTransportSecurity then turns
    // into a refused startup on any exposed bind.
    it("ignores placeholder values shipped in example configs", () => {
        expect(resolveMcpAuthToken({ MCP_INTERNAL_TOKEN: "change-me-long-random-token" })).toBeNull();
    });

    it("ignores tokens too short to be a real secret", () => {
        expect(resolveMcpAuthToken({ MCP_SERVER_TOKEN: "short" })).toBeNull();
    });

    it("a placeholder cannot be used to expose the server", () => {
        const token = resolveMcpAuthToken({ MCP_INTERNAL_TOKEN: "change-me-long-random-token" });
        expect(() => assertTransportSecurity({ host: "0.0.0.0", token })).toThrow(
            McpAuthConfigError
        );
    });
});

describe("resolveBindHost", () => {
    it("defaults to loopback", () => {
        expect(resolveBindHost({})).toBe("127.0.0.1");
    });

    it("honours an explicit bind host", () => {
        expect(resolveBindHost({ MCP_BIND_HOST: "0.0.0.0" })).toBe("0.0.0.0");
    });
});

describe("assertTransportSecurity", () => {
    // The tool surface includes execute_bash, so exposing it off-host without
    // a credential must abort startup rather than degrade to an open server.
    it("refuses a non-loopback bind with no token", () => {
        expect(() => assertTransportSecurity({ host: "0.0.0.0", token: null })).toThrow(
            McpAuthConfigError
        );
    });

    it("allows a non-loopback bind once a token is configured", () => {
        expect(() => assertTransportSecurity({ host: "0.0.0.0", token: VALID })).not.toThrow();
    });

    it("allows loopback without a token", () => {
        expect(() => assertTransportSecurity({ host: "127.0.0.1", token: null })).not.toThrow();
    });
});

describe("isLoopbackHost", () => {
    it("recognises loopback addresses", () => {
        for (const host of ["127.0.0.1", "localhost", "::1", "127.1.2.3"]) {
            expect(isLoopbackHost(host)).toBe(true);
        }
    });

    it("does not treat public hosts as loopback", () => {
        for (const host of ["0.0.0.0", "10.0.0.5", "example.com"]) {
            expect(isLoopbackHost(host)).toBe(false);
        }
    });
});

describe("extractPresentedToken", () => {
    it("reads a bearer header", () => {
        expect(extractPresentedToken(req({ authorization: `Bearer ${VALID}` }))).toBe(VALID);
    });

    it("reads the internal token headers", () => {
        expect(extractPresentedToken(req({ "x-mcp-internal-token": VALID }))).toBe(VALID);
        expect(extractPresentedToken(req({ "x-internal-token": VALID }))).toBe(VALID);
    });

    it("ignores non-bearer schemes and missing headers", () => {
        expect(extractPresentedToken(req({ authorization: `Basic ${VALID}` }))).toBeNull();
        expect(extractPresentedToken(req())).toBeNull();
    });
});

describe("isAuthorizedRequest", () => {
    it("accepts the configured token", () => {
        expect(isAuthorizedRequest(req({ authorization: `Bearer ${VALID}` }), VALID)).toBe(true);
    });

    it("rejects a wrong or absent token", () => {
        expect(isAuthorizedRequest(req({ authorization: `Bearer ${"b".repeat(64)}` }), VALID)).toBe(
            false
        );
        expect(isAuthorizedRequest(req(), VALID)).toBe(false);
    });

    it("rejects a token that is merely a prefix of the real one", () => {
        expect(isAuthorizedRequest(req({ authorization: "Bearer a" }), VALID)).toBe(false);
    });

    it("allows unauthenticated calls only when no token is configured (loopback mode)", () => {
        expect(isAuthorizedRequest(req(), null)).toBe(true);
    });
});
