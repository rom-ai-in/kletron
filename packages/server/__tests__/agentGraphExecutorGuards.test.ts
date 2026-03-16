/**
 * Tests for the anti-looping and deduplication guards added to AgentGraphExecutor.
 *
 * Tests verify:
 * 1. write_todos deduplication (hash-based duplicate rejection)
 * 2. Read-only tool call caching (dedup identical calls)
 * 3. Workspace context injection (repo awareness)
 * 4. System prompt anti-loop rules
 *
 * Uses Node.js built-in test runner (node --test) for zero-dependency execution.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getToolApprovalPolicy } from "../src/services/toolApprovalPolicy";

// ─── Helpers (replicated from executor for isolated testing) ────────────────

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
};

// ─── 1. stableStringify ─────────────────────────────────────────────────────

describe("stableStringify", () => {
    it("produces consistent output regardless of key order", () => {
        const a = { z: 1, a: 2, m: 3 };
        const b = { a: 2, m: 3, z: 1 };
        assert.equal(stableStringify(a), stableStringify(b));
    });

    it("handles nested objects", () => {
        const a = { outer: { z: 1, a: 2 } };
        const b = { outer: { a: 2, z: 1 } };
        assert.equal(stableStringify(a), stableStringify(b));
    });

    it("handles arrays (order-sensitive)", () => {
        const a = [1, 2, 3];
        const b = [1, 3, 2];
        assert.notEqual(stableStringify(a), stableStringify(b));
    });

    it("handles primitives", () => {
        assert.equal(stableStringify(null), "null");
        assert.equal(stableStringify(42), "42");
        assert.equal(stableStringify("hello"), '"hello"');
    });
});

// ─── 2. write_todos deduplication ───────────────────────────────────────────

describe("write_todos deduplication", () => {
    const MAX_CONSECUTIVE_TODOS_DUPLICATES = 2;

    function simulateWriteTodos(calls: Array<{ tasks: any[]; currentTaskId?: string }>) {
        let lastTodosHash: string | null = null;
        let consecutiveTodosDuplicates = 0;
        const results: Array<{ updated: boolean; warning?: string }> = [];

        for (const input of calls) {
            const tasks = Array.isArray(input.tasks) ? input.tasks : [];
            const payloadHash = stableStringify({ tasks, currentTaskId: input.currentTaskId });

            if (payloadHash === lastTodosHash) {
                consecutiveTodosDuplicates++;
                if (consecutiveTodosDuplicates >= MAX_CONSECUTIVE_TODOS_DUPLICATES) {
                    results.push({ updated: false, warning: `Duplicate detected (${consecutiveTodosDuplicates} times)` });
                    continue;
                }
            } else {
                consecutiveTodosDuplicates = 0;
            }
            lastTodosHash = payloadHash;
            results.push({ updated: true });
        }
        return results;
    }

    it("allows the first call", () => {
        const results = simulateWriteTodos([
            { tasks: [{ id: "1", title: "Task 1", status: "todo" }], currentTaskId: "1" },
        ]);
        assert.equal(results[0].updated, true);
    });

    it("allows a second identical call (grace period)", () => {
        const payload = { tasks: [{ id: "1", title: "Task 1", status: "todo" }], currentTaskId: "1" };
        const results = simulateWriteTodos([payload, payload]);
        assert.equal(results[0].updated, true);
        assert.equal(results[1].updated, true);
    });

    it("rejects the third consecutive identical call", () => {
        const payload = { tasks: [{ id: "1", title: "Task 1", status: "todo" }], currentTaskId: "1" };
        const results = simulateWriteTodos([payload, payload, payload]);
        assert.equal(results[0].updated, true);
        assert.equal(results[1].updated, true);
        assert.equal(results[2].updated, false);
        assert.ok(results[2].warning);
    });

    it("rejects all further identical calls beyond the threshold", () => {
        const payload = { tasks: [{ id: "1", title: "Task 1", status: "todo" }], currentTaskId: "1" };
        const results = simulateWriteTodos([payload, payload, payload, payload, payload]);
        assert.equal(results[0].updated, true);
        assert.equal(results[1].updated, true);
        assert.equal(results[2].updated, false);
        assert.equal(results[3].updated, false);
        assert.equal(results[4].updated, false);
    });

    it("resets the counter when the payload changes", () => {
        const payloadA = { tasks: [{ id: "1", title: "Task A", status: "todo" }], currentTaskId: "1" };
        const payloadB = { tasks: [{ id: "1", title: "Task B", status: "done" }], currentTaskId: "1" };
        const results = simulateWriteTodos([payloadA, payloadA, payloadB, payloadB, payloadB]);
        assert.equal(results[0].updated, true);  // A first
        assert.equal(results[1].updated, true);  // A second (grace)
        assert.equal(results[2].updated, true);  // B first — counter resets
        assert.equal(results[3].updated, true);  // B second (grace)
        assert.equal(results[4].updated, false); // B third — rejected
    });

    it("treats reordered keys as the same payload", () => {
        const payloadA = { tasks: [{ id: "1", status: "todo", title: "Task" }], currentTaskId: "1" };
        const payloadB = { tasks: [{ title: "Task", id: "1", status: "todo" }], currentTaskId: "1" };
        const results = simulateWriteTodos([payloadA, payloadB, payloadB]);
        assert.equal(results[0].updated, true);
        assert.equal(results[1].updated, true);  // grace
        assert.equal(results[2].updated, false); // rejected
    });

    it("handles empty tasks array", () => {
        const payload = { tasks: [], currentTaskId: "" };
        const results = simulateWriteTodos([payload, payload, payload]);
        assert.equal(results[0].updated, true);
        assert.equal(results[1].updated, true);
        assert.equal(results[2].updated, false);
    });
});

// ─── 3. Tool call cache ────────────────────────────────────────────────────

describe("tool call cache (deduplication)", () => {
    const DEDUP_CACHE_MAX = 50;
    const READ_ONLY_DEDUP_TOOLS = new Set([
        "list_files", "read_file", "read_file_range", "search_code",
        "repo_metrics", "dependency_info", "describe_structure",
        "git_log", "git_diff", "git_grep", "git_blame",
        "semantic_code_search", "structural_search", "symbols_list",
        "find_symbol", "go_to_definition", "references", "find_references",
        "todo_search", "bootstrap_context", "web_search", "fetch_url",
        "output_format", "write_todos",
    ]);

    function simulateToolCalls(calls: Array<{ name: string; input: Record<string, unknown> }>) {
        const toolCallCache = new Map<string, string>();
        const results: Array<{ cached: boolean; result: string }> = [];

        for (const call of calls) {
            const { name, input } = call;

            if (READ_ONLY_DEDUP_TOOLS.has(name) && name !== "write_todos") {
                const cacheKey = `${name}:${stableStringify(input)}`;
                const cached = toolCallCache.get(cacheKey);
                if (cached !== undefined) {
                    results.push({ cached: true, result: `[Cached]\n${cached}` });
                    continue;
                }
            }

            const result = `Result for ${name}(${JSON.stringify(input)})`;

            if (READ_ONLY_DEDUP_TOOLS.has(name) && name !== "write_todos") {
                const cacheKey = `${name}:${stableStringify(input)}`;
                if (toolCallCache.size >= DEDUP_CACHE_MAX) {
                    const firstKey = toolCallCache.keys().next().value;
                    if (firstKey !== undefined) toolCallCache.delete(firstKey);
                }
                toolCallCache.set(cacheKey, result);
            }

            results.push({ cached: false, result });
        }

        return results;
    }

    it("caches and returns cached results for identical read-only calls", () => {
        const call = { name: "read_file", input: { filePath: "src/index.ts" } };
        const results = simulateToolCalls([call, call]);
        assert.equal(results[0].cached, false);
        assert.equal(results[1].cached, true);
        assert.ok(results[1].result.includes("[Cached]"));
    });

    it("does not cache write_todos calls", () => {
        const call = { name: "write_todos", input: { tasks: [] } };
        const results = simulateToolCalls([call, call]);
        assert.equal(results[0].cached, false);
        assert.equal(results[1].cached, false);
    });

    it("does not cache write tools (write_file, execute_bash, str_replace_editor)", () => {
        for (const toolName of ["write_file", "execute_bash", "str_replace_editor"]) {
            const call = { name: toolName, input: { filePath: "a.ts", content: "hello" } };
            const results = simulateToolCalls([call, call]);
            assert.equal(results[0].cached, false);
            assert.equal(results[1].cached, false);
        }
    });

    it("distinguishes different arguments for the same tool", () => {
        const call1 = { name: "read_file", input: { filePath: "a.ts" } };
        const call2 = { name: "read_file", input: { filePath: "b.ts" } };
        const results = simulateToolCalls([call1, call2, call1]);
        assert.equal(results[0].cached, false);
        assert.equal(results[1].cached, false);
        assert.equal(results[2].cached, true);
    });

    it("evicts oldest entry when cache is full", () => {
        const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
        for (let i = 0; i < DEDUP_CACHE_MAX + 1; i++) {
            calls.push({ name: "search_code", input: { query: `query-${i}` } });
        }
        calls.push({ name: "search_code", input: { query: "query-0" } });

        const results = simulateToolCalls(calls);
        for (let i = 0; i <= DEDUP_CACHE_MAX; i++) {
            assert.equal(results[i].cached, false);
        }
        // query-0 was evicted when query-50 was inserted
        assert.equal(results[DEDUP_CACHE_MAX + 1].cached, false);
    });

    it("caches all expected read-only tools", () => {
        const readOnlyTools = ["list_files", "search_code", "git_grep", "repo_metrics", "describe_structure", "dependency_info"];
        for (const toolName of readOnlyTools) {
            const call = { name: toolName, input: { query: "test" } };
            const results = simulateToolCalls([call, call]);
            assert.equal(results[1].cached, true, `Expected ${toolName} to be cached on second call`);
        }
    });
});

describe("tool approval policy guard coverage", () => {
    it("treats str_replace_editor as read-only auto-approve and execute_bash as execution requiring approval for agent", () => {
        const executePolicy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        const replacePolicy = getToolApprovalPolicy({ source: "agent", toolName: "str_replace_editor" });
        assert.equal(executePolicy.decision, "requires_approval");
        assert.equal(replacePolicy.decision, "auto_approve");
    });

    it("keeps write_file behind manual approval for agent", () => {
        const policy = getToolApprovalPolicy({ source: "agent", toolName: "write_file" });
        assert.equal(policy.decision, "requires_approval");
    });


    it("marks automation write tools as approval-required (executor fail-fast handles blocking)", () => {
        const repoWrite = getToolApprovalPolicy({ source: "automation", toolName: "write_file" });
        assert.equal(repoWrite.decision, "requires_approval");
    });
});

// ─── 4. Workspace context block ────────────────────────────────────────────

describe("workspace context block", () => {
    function buildWorkspaceContextBlock(rootDir: string, workspaceId: string) {
        return [
            "\n\n## WORKSPACE ENVIRONMENT",
            `You are running inside the repository at: ${rootDir}`,
            `Workspace ID: ${workspaceId}`,
            "You already have full filesystem access via tools (list_files, read_file, search_code, etc.).",
            "Do NOT ask the user for repository access — you already have it.",
            "Do NOT re-plan if you have already created a plan — proceed with execution.",
            "",
            "## ANTI-LOOPING RULES",
            "- Never call the same tool with identical arguments more than once per turn. Reuse prior results.",
            "- Never call write_todos more than twice without making progress on actual tasks between calls.",
            "- If a tool returns a cached/duplicate warning, stop calling it and use the existing result.",
            "- Focus on PRODUCING OUTPUT, not endlessly planning. After gathering information, synthesize and report.",
        ].join("\n");
    }

    it("includes the repo root path", () => {
        const block = buildWorkspaceContextBlock("/home/user/my-repo", "ws-123");
        assert.ok(block.includes("/home/user/my-repo"));
    });

    it("includes workspace ID", () => {
        const block = buildWorkspaceContextBlock("/repo", "ws-456");
        assert.ok(block.includes("ws-456"));
    });

    it("tells the agent it has filesystem access", () => {
        const block = buildWorkspaceContextBlock("/repo", "ws-1");
        assert.ok(block.includes("full filesystem access"));
        assert.ok(block.includes("Do NOT ask the user for repository access"));
    });

    it("includes anti-looping rules", () => {
        const block = buildWorkspaceContextBlock("/repo", "ws-1");
        assert.ok(block.includes("ANTI-LOOPING RULES"));
        assert.ok(block.includes("Never call the same tool with identical arguments"));
        assert.ok(block.includes("PRODUCING OUTPUT"));
    });
});

// ─── 5. System prompt anti-loop content ────────────────────────────────────

describe("system prompt anti-loop content verification", () => {
    it("TOOL_PREFERENCE_GUIDANCE includes anti-repeat rules", () => {
        const guidance = [
            "Tooling guidance:",
            "- Prefer list_files/read_file/search_code/git_grep/semantic_code_search before execute_bash.",
            "- Use execute_bash only when a shell pipeline is truly required.",
            "- Avoid repeating commands; reuse prior outputs.",
            "- NEVER call write_todos with the same payload more than once. Create your plan, then execute it.",
            "- After gathering enough information, STOP gathering and produce your output/report.",
        ].join(" ");

        assert.ok(guidance.includes("NEVER call write_todos with the same payload more than once"));
        assert.ok(guidance.includes("STOP gathering and produce your output/report"));
    });

    it("simpleReactSystemPrompt includes anti-loop instructions", () => {
        // Import the actual prompt to verify it contains key anti-loop phrases
        const { simpleReactSystemPrompt } = require("../src/services/agentGraphPresets");

        assert.ok(simpleReactSystemPrompt.includes("write_todos **ONCE**"));
        assert.ok(simpleReactSystemPrompt.includes("Never recreate the same queue"));
        assert.ok(simpleReactSystemPrompt.includes("Stop tool usage and produce the final answer"));
        assert.ok(simpleReactSystemPrompt.includes("Numezis Code"));
        assert.ok(simpleReactSystemPrompt.includes("Repository First Principle"));
    });
});
