import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { issueLocalMcpToken, verifyLocalMcpToken } from "../src/lib/codexLocalMcpAuth";
import { _resetKeyCacheForTests } from "../src/lib/crypto/secrets";

describe("codexLocalMcpAuth", () => {
    const prevEnc = process.env.KLETRON_ENCRYPTION_KEY;
    const prevSecret = process.env.NEXTAUTH_SECRET;

    beforeEach(() => {
        _resetKeyCacheForTests();
        delete process.env.KLETRON_ENCRYPTION_KEY;
        process.env.NEXTAUTH_SECRET = "unit-test-nextauth-secret";
    });

    afterEach(() => {
        _resetKeyCacheForTests();
        process.env.KLETRON_ENCRYPTION_KEY = prevEnc;
        process.env.NEXTAUTH_SECRET = prevSecret;
    });

    it("issues and verifies a Bearer token", () => {
        const raw = issueLocalMcpToken({
            userId: "507f1f77bcf86cd799439011",
            workspaceId: "507f191e810c19729de860ea",
            ttlSec: 120,
        });
        const payload = verifyLocalMcpToken(`Bearer ${raw}`);
        expect(payload?.userId).toBe("507f1f77bcf86cd799439011");
        expect(payload?.workspaceId).toBe("507f191e810c19729de860ea");
    });

    it("rejects tampered tokens", () => {
        const raw = issueLocalMcpToken({
            userId: "u1",
            workspaceId: "w1",
            ttlSec: 60,
        });
        const broken = `${raw.slice(0, -4)}aaaa`;
        expect(verifyLocalMcpToken(broken)).toBeNull();
    });

    it("caps TTL at 48 hours", () => {
        const before = Math.floor(Date.now() / 1000);
        const raw = issueLocalMcpToken({
            userId: "507f1f77bcf86cd799439011",
            workspaceId: "507f191e810c19729de860ea",
            ttlSec: 999_999_999,
        });
        const payload = verifyLocalMcpToken(raw);
        expect(payload).not.toBeNull();
        const delta = payload!.exp - before;
        expect(delta).toBeLessThanOrEqual(48 * 3600 + 3);
        expect(delta).toBeGreaterThanOrEqual(48 * 3600 - 3);
    });
});
