import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("AES-GCM secrets helper", () => {
    const prevKey = process.env.KLETRON_ENCRYPTION_KEY;
    const prevNextAuth = process.env.NEXTAUTH_SECRET;

    beforeEach(async () => {
        delete process.env.KLETRON_ENCRYPTION_KEY;
        process.env.NEXTAUTH_SECRET = "test-secret-for-unit-tests";
        const m = await import("../src/lib/crypto/secrets");
        m._resetKeyCacheForTests();
    });

    afterEach(async () => {
        process.env.KLETRON_ENCRYPTION_KEY = prevKey;
        process.env.NEXTAUTH_SECRET = prevNextAuth;
        const m = await import("../src/lib/crypto/secrets");
        m._resetKeyCacheForTests();
    });

    it("round-trips JSON payloads", async () => {
        const { encryptJson, decryptJson } = await import("../src/lib/crypto/secrets");
        const payload = { token: "ghp_test", nested: { a: 1 } };
        const enc = encryptJson(payload);
        expect(decryptJson(enc)).toEqual(payload);
    });

    it("round-trips arbitrary strings", async () => {
        const { encryptSecret, decryptSecret } = await import("../src/lib/crypto/secrets");
        const secret = "hello world 🔐";
        const enc = encryptSecret(secret);
        expect(decryptSecret(enc)).toBe(secret);
    });
});
