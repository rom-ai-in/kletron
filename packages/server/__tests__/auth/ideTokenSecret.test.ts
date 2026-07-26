import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Both files previously defaulted to the literal
 * 'ide-secret-key-change-in-production'. These tests pin the two properties
 * that made that a vulnerability: no key material ships in the repository, and
 * production fails closed instead of falling back.
 */
const PUBLISHED_FALLBACK = "ide-secret-key-change-in-production";

const envKeys = ["NODE_ENV", "IDE_JWT_SECRET", "NEXTAUTH_SECRET"] as const;
let previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

async function loadModule() {
    return import("@kletron/server/lib/auth/ideTokenSecret");
}

beforeEach(() => {
    previousEnv = {};
    for (const key of envKeys) previousEnv[key] = process.env[key];
    for (const key of envKeys) delete process.env[key];
    vi.resetModules();
});

afterEach(() => {
    for (const key of envKeys) {
        const value = previousEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    vi.resetModules();
});

describe("resolveIdeTokenSecret", () => {
    it("uses IDE_JWT_SECRET when configured", async () => {
        process.env.NODE_ENV = "production";
        process.env.IDE_JWT_SECRET = "s".repeat(40);
        const { resolveIdeTokenSecret, areIdeTokensEnabled } = await loadModule();
        expect(areIdeTokensEnabled()).toBe(true);
        expect(new TextDecoder().decode(resolveIdeTokenSecret()!)).toBe("s".repeat(40));
    });

    it("rejects an IDE_JWT_SECRET that is too short", async () => {
        process.env.NODE_ENV = "production";
        process.env.IDE_JWT_SECRET = "tooshort";
        const { resolveIdeTokenSecret } = await loadModule();
        expect(() => resolveIdeTokenSecret()).toThrow(/at least/);
    });

    it("disables IDE tokens in production when no secret is configured", async () => {
        process.env.NODE_ENV = "production";
        process.env.NEXTAUTH_SECRET = "n".repeat(40);
        const { resolveIdeTokenSecret, areIdeTokensEnabled } = await loadModule();
        expect(resolveIdeTokenSecret()).toBeNull();
        expect(areIdeTokensEnabled()).toBe(false);
    });

    it("derives an installation-specific key outside production", async () => {
        process.env.NODE_ENV = "development";
        process.env.NEXTAUTH_SECRET = "n".repeat(40);
        const { resolveIdeTokenSecret } = await loadModule();
        const derived = resolveIdeTokenSecret();
        expect(derived).not.toBeNull();
        expect(Buffer.from(derived!).toString("utf8")).not.toBe(PUBLISHED_FALLBACK);
    });

    it("gives different installations different dev keys", async () => {
        process.env.NODE_ENV = "development";
        process.env.NEXTAUTH_SECRET = "a".repeat(40);
        const first = Buffer.from((await loadModule()).resolveIdeTokenSecret()!).toString("hex");

        vi.resetModules();
        process.env.NEXTAUTH_SECRET = "b".repeat(40);
        const second = Buffer.from((await loadModule()).resolveIdeTokenSecret()!).toString("hex");

        expect(first).not.toBe(second);
    });

    it("stays disabled outside production when nothing at all is configured", async () => {
        process.env.NODE_ENV = "development";
        const { resolveIdeTokenSecret } = await loadModule();
        expect(resolveIdeTokenSecret()).toBeNull();
    });
});

describe("requireIdeTokenSecret", () => {
    it("throws instead of signing with a guessable key", async () => {
        process.env.NODE_ENV = "production";
        const { requireIdeTokenSecret } = await loadModule();
        expect(() => requireIdeTokenSecret()).toThrow(/not configured/);
    });

    it("returns the key when configured", async () => {
        process.env.NODE_ENV = "production";
        process.env.IDE_JWT_SECRET = "s".repeat(40);
        const { requireIdeTokenSecret } = await loadModule();
        expect(requireIdeTokenSecret()).toBeInstanceOf(Uint8Array);
    });
});

describe("token minting refuses to run unconfigured", () => {
    it("generateIdeTokens throws in production with no secret", async () => {
        process.env.NODE_ENV = "production";
        const { generateIdeTokens } = await import("@kletron/server/lib/auth/ideTokens");
        await expect(
            generateIdeTokens({ id: "u1", email: "a@b.c", fullName: null })
        ).rejects.toThrow(/not configured/);
    });
});
