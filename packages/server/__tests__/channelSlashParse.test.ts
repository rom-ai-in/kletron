import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseSlashCommand } from "../src/services/channelSlashParse";

describe("parseSlashCommand", () => {
    it("parses command without args", () => {
        const r = parseSlashCommand("/switch");
        assert.equal(r.isSlash, true);
        assert.equal(r.cmd, "switch");
        assert.equal(r.rest, "");
    });

    it("strips bot suffix", () => {
        const r = parseSlashCommand("/help@MyBot");
        assert.equal(r.cmd, "help");
    });

    it("parses rest", () => {
        const r = parseSlashCommand("/switch my workspace");
        assert.equal(r.cmd, "switch");
        assert.equal(r.rest, "my workspace");
    });

    it("non-slash", () => {
        const r = parseSlashCommand("hello");
        assert.equal(r.isSlash, false);
        assert.equal(r.rest, "hello");
    });
});
