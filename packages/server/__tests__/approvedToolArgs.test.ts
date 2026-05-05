import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveApprovedToolArgs } from "../src/services/approvedToolArgs";

describe("resolveApprovedToolArgs", () => {
    const rootDir = "/tmp/workspace";

    it("maps str_replace_editor filePath to path without defaulting to the workspace directory", () => {
        const resolved = resolveApprovedToolArgs(
            "str_replace_editor",
            { command: "view", filePath: "TASKS.md" },
            rootDir,
        );

        expect(resolved.path).toBe(path.resolve(rootDir, "TASKS.md"));
        expect(resolved.filePath).toBe(path.resolve(rootDir, "TASKS.md"));
        expect(resolved.repoPath).toBe(path.resolve(rootDir));
    });

    it("maps write_file path to filePath and attaches repoPath", () => {
        const resolved = resolveApprovedToolArgs(
            "write_file",
            { path: "notes/out.md", content: "hello" },
            rootDir,
        );

        expect(resolved.filePath).toBe(path.resolve(rootDir, "notes/out.md"));
        expect(resolved.repoPath).toBe(path.resolve(rootDir));
    });

    it("defaults execute_bash path to the workspace root", () => {
        const resolved = resolveApprovedToolArgs(
            "execute_bash",
            { command: "pwd" },
            rootDir,
        );

        expect(resolved.path).toBe(path.resolve(rootDir));
    });
});
