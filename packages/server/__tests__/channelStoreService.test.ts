import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildChannelSessionKey } from "../src/services/channelStoreService";

describe("buildChannelSessionKey", () => {
    it("is stable for the same inputs", () => {
        const a = buildChannelSessionKey("507f1f77bcf86cd799439011", "telegram", "telegram:chat:1");
        const b = buildChannelSessionKey("507f1f77bcf86cd799439011", "telegram", "telegram:chat:1");
        assert.equal(a, b);
    });

    it("differs when external chat key differs", () => {
        const a = buildChannelSessionKey("507f1f77bcf86cd799439011", "telegram", "telegram:chat:1");
        const b = buildChannelSessionKey("507f1f77bcf86cd799439011", "telegram", "telegram:chat:2");
        assert.notEqual(a, b);
    });
});
