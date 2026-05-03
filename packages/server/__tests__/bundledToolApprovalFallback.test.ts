import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
    invokeWriteFileApprovalFallback,
    invokeStrReplaceEditorApprovalFallback,
    isMcpBundledToolNotFoundError,
} from "../src/services/bundledToolApprovalFallback";

describe("bundledToolApprovalFallback", () => {
    it("detects MCP tool-not-found errors", () => {
        expect(isMcpBundledToolNotFoundError(new Error("MCP error -32603: Tool not found: write_file"))).toBe(true);
        expect(isMcpBundledToolNotFoundError(new Error("tool not found"))).toBe(true);
        expect(isMcpBundledToolNotFoundError(new Error("something else"))).toBe(false);
    });

    describe("invokeWriteFileApprovalFallback", () => {
        let tmp: string;
        beforeEach(async () => {
            tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kletron-write-fallback-"));
        });
        afterEach(async () => {
            await fs.rm(tmp, { recursive: true, force: true });
        });

        it("writes a relative file under workspace root", async () => {
            const raw = await invokeWriteFileApprovalFallback(tmp, {
                filePath: "notes/hello.txt",
                content: "hello",
            });
            expect(JSON.parse(raw).ok).toBe(true);
            const text = await fs.readFile(path.join(tmp, "notes/hello.txt"), "utf8");
            expect(text).toBe("hello");
        });

        it("rejects paths outside workspace", async () => {
            await expect(
                invokeWriteFileApprovalFallback(tmp, {
                    filePath: "../../../etc/passwd",
                    content: "x",
                })
            ).rejects.toThrow(/outside/i);
        });
    });

    describe("invokeStrReplaceEditorApprovalFallback", () => {
        let tmp: string;
        beforeEach(async () => {
            tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kletron-str-fallback-"));
        });
        afterEach(async () => {
            await fs.rm(tmp, { recursive: true, force: true });
        });

        it("applies str_replace via bundled editor module", async () => {
            const fp = path.join(tmp, "a.txt");
            await fs.writeFile(fp, "hello world\n", "utf8");
            const raw = await invokeStrReplaceEditorApprovalFallback(tmp, {
                command: "str_replace",
                path: "a.txt",
                old_str: "world",
                new_str: "there",
            });
            const parsed = JSON.parse(raw);
            expect(parsed.ok).toBe(true);
            expect(await fs.readFile(fp, "utf8")).toBe("hello there\n");
        });
    });
});
