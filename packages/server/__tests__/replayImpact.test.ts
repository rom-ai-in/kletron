/**
 * Unit tests for the pure replay impact computation logic.
 *
 * The actual implementation lives in apps/desktop/src/replayImpact.ts.
 * We replicate the core algorithm here for isolated testing (same pattern
 * as agentGraphExecutorGuards.test.ts) so that tests run without React or
 * Electron dependencies.
 *
 * Covers:
 *  - Message and tool call counting
 *  - File change detection (write_file, create, str_replace_editor, delete)
 *  - write_todos exclusion from the "write" heuristic
 *  - Action-override logic (created → not downgraded by later write_file)
 *  - Diff line generation from str_replace edits
 *  - Content capture for created/modified files
 *
 * Uses Node.js built-in test runner (npx tsx --test) for zero-dependency execution.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Replicated types + algorithm (source of truth: apps/desktop/src/replayImpact.ts) ───

interface FileChange {
    path: string;
    action: "created" | "modified" | "deleted";
    newContent?: string;
    diffLines?: string[];
}

interface ReplayImpact {
    messagesRemoved: number;
    toolCallsRemoved: number;
    fileChanges: FileChange[];
    originalContent: string;
    newContent: string;
}

interface ReplayEvent {
    kind: string;
    toolName?: string;
    toolArgs?: string;
    messageIndex?: number;
}

function computeReplayImpactPure(
    events: ReplayEvent[],
    fromIndex: number,
    originalContent: string,
    newContent: string
): ReplayImpact {
    const eventsAfter = events.filter(
        (e) => typeof e.messageIndex === "number" && e.messageIndex > fromIndex
    );

    let messagesRemoved = 0;
    let toolCallsRemoved = 0;

    type FileEntry = {
        action: FileChange["action"];
        writtenContent?: string;
        replaceEdits: Array<{ oldStr: string; newStr: string }>;
    };
    const fileEntriesMap = new Map<string, FileEntry>();

    const getOrCreate = (path: string): FileEntry => {
        let entry = fileEntriesMap.get(path);
        if (!entry) {
            entry = { action: "modified", replaceEdits: [] };
            fileEntriesMap.set(path, entry);
        }
        return entry;
    };

    for (const event of eventsAfter) {
        if (event.kind === "user" || (event.kind === "assistant" && !event.toolName)) {
            messagesRemoved++;
        }
        if (event.kind === "assistant" && event.toolName) {
            toolCallsRemoved++;

            const toolName = event.toolName.toLowerCase();
            let args: Record<string, unknown> = {};
            if (event.toolArgs) {
                try {
                    args = JSON.parse(event.toolArgs);
                } catch {
                    // ignore
                }
            }

            const filePath =
                (args.filePath as string) ??
                (args.path as string) ??
                (args.file_path as string) ??
                (args.fileName as string) ??
                "";

            if (filePath) {
                const isFileWrite =
                    (toolName.includes("write") || toolName.includes("create") || toolName.includes("save")) &&
                    !toolName.includes("todo");

                if (isFileWrite) {
                    const isNew = !fileEntriesMap.has(filePath);
                    const entry = getOrCreate(filePath);
                    if (isNew || entry.action === "modified") {
                        entry.action = toolName.includes("create") ? "created" : "modified";
                    }
                    const content = args.content;
                    if (typeof content === "string") {
                        entry.writtenContent = content;
                    }
                } else if (toolName.includes("str_replace") || toolName === "str_replace_editor") {
                    const entry = getOrCreate(filePath);
                    const oldStr = (args.old_str ?? args.oldStr ?? args.old_string) as string | undefined;
                    const newStr = (args.new_str ?? args.newStr ?? args.new_string) as string | undefined;
                    if (typeof oldStr === "string" && typeof newStr === "string") {
                        entry.replaceEdits.push({ oldStr, newStr });
                    }
                } else if (toolName.includes("delete") || toolName.includes("remove")) {
                    const entry = getOrCreate(filePath);
                    entry.action = "deleted";
                }
            }
        }
    }

    const fileChanges: FileChange[] = Array.from(fileEntriesMap.entries()).map(
        ([path, entry]) => {
            const fc: FileChange = { path, action: entry.action };
            if (entry.action === "created" && entry.writtenContent) {
                fc.newContent = entry.writtenContent;
            }
            if (entry.action === "modified" && entry.replaceEdits.length > 0) {
                const diffLines: string[] = [];
                for (const edit of entry.replaceEdits) {
                    const oldLines = edit.oldStr.split("\n");
                    const newLines = edit.newStr.split("\n");
                    diffLines.push(`@@ str_replace in ${path.split("/").pop()} @@`);
                    for (const line of oldLines) {
                        diffLines.push(`-${line}`);
                    }
                    for (const line of newLines) {
                        diffLines.push(`+${line}`);
                    }
                }
                fc.diffLines = diffLines;
            }
            if (entry.action === "modified" && !fc.diffLines && entry.writtenContent) {
                fc.newContent = entry.writtenContent;
            }
            return fc;
        }
    );

    return { messagesRemoved, toolCallsRemoved, fileChanges, originalContent, newContent };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToolCallEvent(
    toolName: string,
    args: Record<string, unknown>,
    messageIndex: number
): ReplayEvent {
    return {
        kind: "assistant",
        toolName,
        toolArgs: JSON.stringify(args),
        messageIndex,
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("computeReplayImpactPure", () => {

    // ── Message counting ────────────────────────────────────────────────

    describe("message counting", () => {
        it("counts user and assistant (non-tool) messages removed", () => {
            const events: ReplayEvent[] = [
                { kind: "user", messageIndex: 0 },
                { kind: "assistant", messageIndex: 1 },
                { kind: "user", messageIndex: 2 },
                { kind: "assistant", messageIndex: 3 },
            ];
            const result = computeReplayImpactPure(events, 1, "old", "new");
            assert.equal(result.messagesRemoved, 2);
            assert.equal(result.toolCallsRemoved, 0);
        });

        it("counts assistant tool calls separately", () => {
            const events: ReplayEvent[] = [
                { kind: "user", messageIndex: 0 },
                makeToolCallEvent("write_file", { path: "a.ts", content: "x" }, 1),
                makeToolCallEvent("str_replace_editor", { path: "b.ts", old_str: "a", new_str: "b" }, 2),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.toolCallsRemoved, 2);
            assert.equal(result.messagesRemoved, 0);
        });

        it("does not count tool result events as tool calls", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("write_file", { path: "a.ts", content: "x" }, 1),
                { kind: "tool", messageIndex: 2 },
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.toolCallsRemoved, 1);
        });

        it("returns zero for no events after fromIndex", () => {
            const events: ReplayEvent[] = [
                { kind: "user", messageIndex: 0 },
                { kind: "assistant", messageIndex: 1 },
            ];
            const result = computeReplayImpactPure(events, 5, "old", "new");
            assert.equal(result.messagesRemoved, 0);
            assert.equal(result.toolCallsRemoved, 0);
            assert.deepStrictEqual(result.fileChanges, []);
        });
    });

    // ── write_todos exclusion ───────────────────────────────────────────

    describe("write_todos exclusion", () => {
        it("does NOT count write_todos as a file change", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("write_todos", { tasks: [{ id: "1", title: "foo" }] }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.deepStrictEqual(result.fileChanges, []);
            assert.equal(result.toolCallsRemoved, 1);
        });

        it("does NOT match write_todos even when args include a path", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("write_todos", { path: "todos.json", tasks: [] }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.deepStrictEqual(result.fileChanges, []);
        });
    });

    // ── File change detection ───────────────────────────────────────────

    describe("file change detection", () => {
        it("detects write_file as modified", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("write_file", { path: "src/index.ts", content: "hello" }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            assert.equal(result.fileChanges[0].path, "src/index.ts");
            assert.equal(result.fileChanges[0].action, "modified");
            assert.equal(result.fileChanges[0].newContent, "hello");
        });

        it("detects create_file as created", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("create_file", { filePath: "new.ts", content: "content" }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            assert.equal(result.fileChanges[0].action, "created");
            assert.equal(result.fileChanges[0].newContent, "content");
        });

        it("detects delete_file as deleted", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("delete_file", { path: "old.ts" }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            assert.equal(result.fileChanges[0].action, "deleted");
        });

        it("detects str_replace_editor and builds diff lines", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("str_replace_editor", {
                    path: "src/app.ts",
                    old_str: "const a = 1;",
                    new_str: "const a = 2;",
                }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            const fc = result.fileChanges[0];
            assert.equal(fc.action, "modified");
            assert.ok(fc.diffLines);
            assert.ok(fc.diffLines.some((l) => l.startsWith("@@")));
            assert.ok(fc.diffLines.some((l) => l === "-const a = 1;"));
            assert.ok(fc.diffLines.some((l) => l === "+const a = 2;"));
        });

        it("handles multiple str_replace edits on the same file", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("str_replace_editor", {
                    path: "src/app.ts",
                    old_str: "line1",
                    new_str: "LINE1",
                }, 1),
                makeToolCallEvent("str_replace_editor", {
                    path: "src/app.ts",
                    old_str: "line2",
                    new_str: "LINE2",
                }, 2),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            const fc = result.fileChanges[0];
            const headerCount = fc.diffLines!.filter((l) => l.startsWith("@@")).length;
            assert.equal(headerCount, 2);
        });
    });

    // ── Action-override logic ───────────────────────────────────────────

    describe("action-override logic", () => {
        it("does NOT downgrade 'created' to 'modified' on subsequent write_file", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("create_file", { path: "new.ts", content: "v1" }, 1),
                makeToolCallEvent("write_file", { path: "new.ts", content: "v2" }, 2),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            assert.equal(result.fileChanges[0].action, "created");
            assert.equal(result.fileChanges[0].newContent, "v2");
        });

        it("upgrades from default 'modified' to 'created' when create tool is used later", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("str_replace_editor", {
                    path: "app.ts",
                    old_str: "a",
                    new_str: "b",
                }, 1),
                makeToolCallEvent("create_file", { path: "app.ts", content: "fresh" }, 2),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 1);
            assert.equal(result.fileChanges[0].action, "created");
        });
    });

    // ── Content capture ─────────────────────────────────────────────────

    describe("content capture", () => {
        it("captures newContent for full-rewrite modified files without str_replace edits", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("write_file", { path: "config.json", content: '{"key": "value"}' }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            const fc = result.fileChanges[0];
            assert.equal(fc.action, "modified");
            assert.equal(fc.newContent, '{"key": "value"}');
            assert.equal(fc.diffLines, undefined);
        });

        it("prefers diffLines over newContent when str_replace edits are present", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("str_replace_editor", {
                    path: "app.ts",
                    old_str: "old",
                    new_str: "new",
                }, 1),
                makeToolCallEvent("write_file", { path: "app.ts", content: "full content" }, 2),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            const fc = result.fileChanges[0];
            assert.ok(fc.diffLines);
            assert.equal(fc.newContent, undefined);
        });

        it("returns originalContent and newContent passthrough", () => {
            const result = computeReplayImpactPure([], 0, "original msg", "edited msg");
            assert.equal(result.originalContent, "original msg");
            assert.equal(result.newContent, "edited msg");
        });
    });

    // ── Edge cases ──────────────────────────────────────────────────────

    describe("edge cases", () => {
        it("handles events with unparseable toolArgs gracefully", () => {
            const events: ReplayEvent[] = [
                {
                    kind: "assistant",
                    toolName: "write_file",
                    toolArgs: "not json{{{",
                    messageIndex: 1,
                },
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.toolCallsRemoved, 1);
            assert.deepStrictEqual(result.fileChanges, []);
        });

        it("handles events with no toolArgs", () => {
            const events: ReplayEvent[] = [
                {
                    kind: "assistant",
                    toolName: "write_file",
                    messageIndex: 1,
                },
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.toolCallsRemoved, 1);
            assert.deepStrictEqual(result.fileChanges, []);
        });

        it("supports filePath, path, file_path, and fileName arg keys", () => {
            const argVariants = [
                { filePath: "a.ts", content: "1" },
                { path: "b.ts", content: "2" },
                { file_path: "c.ts", content: "3" },
                { fileName: "d.ts", content: "4" },
            ];
            const events: ReplayEvent[] = argVariants.map((args, i) =>
                makeToolCallEvent("write_file", args, i + 1)
            );
            const result = computeReplayImpactPure(events, 0, "old", "new");
            assert.equal(result.fileChanges.length, 4);
            const paths = result.fileChanges.map((fc) => fc.path).sort();
            assert.deepStrictEqual(paths, ["a.ts", "b.ts", "c.ts", "d.ts"]);
        });

        it("handles multiline str_replace edits", () => {
            const events: ReplayEvent[] = [
                makeToolCallEvent("str_replace_editor", {
                    path: "multi.ts",
                    old_str: "line1\nline2\nline3",
                    new_str: "LINE1\nLINE2",
                }, 1),
            ];
            const result = computeReplayImpactPure(events, 0, "old", "new");
            const fc = result.fileChanges[0];
            const deletions = fc.diffLines!.filter((l) => l.startsWith("-")).length;
            const additions = fc.diffLines!.filter((l) => l.startsWith("+")).length;
            assert.equal(deletions, 3);
            assert.equal(additions, 2);
        });
    });
});
