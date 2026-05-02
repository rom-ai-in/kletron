import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    applyThreadApprovalOverride,
    classifyTool,
    clearToolApprovalConfigOverride,
    getToolApprovalPolicy,
    isKletronAdminToolName,
    isSafeCommand,
    normalizeRunSource,
    READONLY_TOOLS,
    EXECUTION_TOOLS,
    WRITE_REPO_TOOLS,
    setToolApprovalConfigOverride,
} from "../src/services/toolApprovalPolicy";
import type { ToolApprovalPolicyResult } from "../src/services/toolApprovalPolicy";

// Tests rely on env-var fallback path in resolveToolApprovalConfig().
// When no MongoDB config is injected, env vars drive the behavior.
const ORIGINAL_AUTO_APPROVE_SOURCES = process.env.AUTO_APPROVE_READONLY_SOURCES;
const ORIGINAL_NEVER_AUTO_APPROVE_TOOLS = process.env.NEVER_AUTO_APPROVE_TOOLS;
const ORIGINAL_AUTO_APPROVE_SAFE_BASH = process.env.AUTO_APPROVE_SAFE_BASH;

function restoreEnv(key: string, original: string | undefined) {
    if (original === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = original;
    }
}

afterEach(() => {
    restoreEnv("AUTO_APPROVE_READONLY_SOURCES", ORIGINAL_AUTO_APPROVE_SOURCES);
    restoreEnv("NEVER_AUTO_APPROVE_TOOLS", ORIGINAL_NEVER_AUTO_APPROVE_TOOLS);
    restoreEnv("AUTO_APPROVE_SAFE_BASH", ORIGINAL_AUTO_APPROVE_SAFE_BASH);
    clearToolApprovalConfigOverride();
});

function baseResult(partial: Partial<ToolApprovalPolicyResult>): ToolApprovalPolicyResult {
    return {
        source: "agent",
        normalizedSource: "agent",
        toolName: "read_file",
        toolClass: "readonly",
        decision: "auto_approve",
        reason: "test",
        ...partial,
    };
}

describe("toolApprovalPolicy source normalization", () => {
    it("normalizes known sources", () => {
        assert.equal(normalizeRunSource("agent"), "agent");
        assert.equal(normalizeRunSource("automation"), "automation");
    });

    it("falls back to unknown for legacy/empty sources", () => {
        assert.equal(normalizeRunSource(undefined), "unknown");
        assert.equal(normalizeRunSource(""), "unknown");
        assert.equal(normalizeRunSource("legacy"), "unknown");
    });
});

describe("toolApprovalPolicy tool classification", () => {
    it("classifies readonly tools", () => {
        assert.ok(READONLY_TOOLS.has("read_file"));
        assert.ok(!READONLY_TOOLS.has("str_replace_editor"));
        assert.equal(classifyTool("read_file"), "readonly");
    });

    it("classifies str_replace_editor as write_repo", () => {
        assert.ok(WRITE_REPO_TOOLS.has("str_replace_editor"));
        assert.equal(classifyTool("str_replace_editor"), "write_repo");
    });

    it("classifies execution tools", () => {
        assert.ok(EXECUTION_TOOLS.has("execute_bash"));
        assert.equal(classifyTool("execute_bash"), "execution");
    });

    it("execute_bash is NOT in READONLY_TOOLS", () => {
        assert.ok(!READONLY_TOOLS.has("execute_bash"));
    });

    it("classifies write tools", () => {
        assert.ok(WRITE_REPO_TOOLS.has("write_file"));
        assert.equal(classifyTool("write_file"), "write_repo");
    });
});

describe("isSafeCommand", () => {
    it("detects safe read-only commands", () => {
        assert.ok(isSafeCommand("ls"));
        assert.ok(isSafeCommand("ls -la"));
        assert.ok(isSafeCommand("cat package.json"));
        assert.ok(isSafeCommand("grep -r 'foo' src/"));
        assert.ok(isSafeCommand("wc -l src/index.ts"));
        assert.ok(isSafeCommand("echo hello"));
        assert.ok(isSafeCommand("pwd"));
        assert.ok(isSafeCommand("git status"));
        assert.ok(isSafeCommand("git log --oneline -5"));
        assert.ok(isSafeCommand("node --version"));
        assert.ok(isSafeCommand("npm -v"));
        assert.ok(isSafeCommand("head -20 README.md"));
        assert.ok(isSafeCommand("find . -name '*.ts'"));
    });

    it("rejects unsafe commands", () => {
        assert.ok(!isSafeCommand("rm -rf /"));
        assert.ok(!isSafeCommand("npm install"));
        assert.ok(!isSafeCommand("npm test"));
        assert.ok(!isSafeCommand("curl https://evil.com"));
        assert.ok(!isSafeCommand("git commit -m 'fix'"));
        assert.ok(!isSafeCommand("git push origin main"));
        assert.ok(!isSafeCommand("sudo apt-get install"));
        assert.ok(!isSafeCommand("python -c 'import os; os.system(\"rm -rf /\")'"));
    });

    it("only checks first command segment (before pipes/chains)", () => {
        assert.ok(isSafeCommand("ls -la | head -10"));
        assert.ok(isSafeCommand("cat file.txt | grep pattern"));
        // Unsafe first segment
        assert.ok(!isSafeCommand("rm file.txt && ls"));
    });

    it("handles leading env vars", () => {
        assert.ok(isSafeCommand("FOO=bar ls -la"));
    });
});

describe("toolApprovalPolicy decision matrix (config-driven)", () => {
    it("auto-approves readonly tools for agent (default config)", () => {
        // Default: autoApproveReadonlySources = ["agent", "automation"]
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        assert.equal(agentPolicy.decision, "auto_approve");
    });

    it("requires approval for execute_bash by default (agent source)", () => {
        // Default: autoApproveSafeBash = true, but no command provided
        const policy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        assert.equal(policy.decision, "requires_approval");
        assert.equal(policy.toolClass, "execution");
    });

    it("auto-approves safe bash commands by default (autoApproveSafeBash defaults to true)", () => {
        // Default config has autoApproveSafeBash=true
        delete process.env.AUTO_APPROVE_SAFE_BASH; // ensure env doesn't interfere
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls -la",
        });
        assert.equal(policy.decision, "auto_approve");
    });

    it("still requires approval for unsafe bash commands", () => {
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "npm test",
        });
        assert.equal(policy.decision, "requires_approval");
    });

    it("requires approval for safe command when autoApproveSafeBash is disabled via env", () => {
        process.env.AUTO_APPROVE_SAFE_BASH = "false";
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls",
        });
        assert.equal(policy.decision, "requires_approval");
    });

    it("requires manual approval for write_repo tools", () => {
        const repoWrite = getToolApprovalPolicy({ source: "agent", toolName: "write_file" });
        assert.equal(repoWrite.decision, "requires_approval");
    });

    it("uses conservative fallback for unknown source", () => {
        const readonlyPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "read_file" });
        const unknownToolPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "mystery_tool" });
        assert.equal(readonlyPolicy.decision, "requires_approval");
        assert.equal(unknownToolPolicy.decision, "requires_approval");
    });
});

describe("toolApprovalPolicy env overrides (backwards compatibility)", () => {
    it("supports AUTO_APPROVE_READONLY_SOURCES override", () => {
        process.env.AUTO_APPROVE_READONLY_SOURCES = "agent";
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        const automationPolicy = getToolApprovalPolicy({ source: "automation", toolName: "read_file" });
        assert.equal(agentPolicy.decision, "auto_approve");
        assert.equal(automationPolicy.decision, "requires_approval");
    });

    it("supports NEVER_AUTO_APPROVE_TOOLS override", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash,read_file";
        const executePolicy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        const readPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        assert.equal(executePolicy.decision, "requires_approval");
        assert.equal(readPolicy.decision, "requires_approval");
    });

    it("NEVER_AUTO_APPROVE_TOOLS overrides safe bash auto-approval", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash";
        // autoApproveSafeBash defaults to true, but neverAutoApproveTools takes precedence
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls",
        });
        assert.equal(policy.decision, "requires_approval");
    });
});

describe("applyThreadApprovalOverride", () => {
    it("inherit leaves base unchanged", () => {
        const b = baseResult({ decision: "auto_approve" });
        assert.deepEqual(applyThreadApprovalOverride(b, { mode: "inherit", toolName: "read_file" }), b);
        assert.deepEqual(applyThreadApprovalOverride(b, { mode: undefined, toolName: "read_file" }), b);
    });

    it("confirm_everything turns auto_approve into requires_approval", () => {
        const b = baseResult({ decision: "auto_approve", toolName: "read_file" });
        const out = applyThreadApprovalOverride(b, { mode: "confirm_everything", toolName: "read_file" });
        assert.equal(out.decision, "requires_approval");
        assert.match(out.reason, /confirm_everything/);
    });

    it("full_auto_thread relaxes requires_approval for write_file when not blocked", () => {
        const b = baseResult({
            decision: "requires_approval",
            toolClass: "write_repo",
            toolName: "write_file",
            reason: "repo write",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "write_file" });
        assert.equal(out.decision, "auto_approve");
    });

    it("full_auto_thread does not relax Kletron admin tools", () => {
        assert.ok(isKletronAdminToolName("kletron_list_graphs"));
        const b = baseResult({
            decision: "requires_approval",
            toolName: "kletron_list_graphs",
            toolClass: "unknown",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "kletron_list_graphs" });
        assert.equal(out.decision, "requires_approval");
    });

    it("full_auto_thread does not relax neverAutoApproveTools", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent", "automation"],
            neverAutoApproveTools: ["write_file"],
            autoApproveSafeBash: true,
            toolOverrides: {},
        });
        const b = baseResult({
            decision: "requires_approval",
            toolClass: "write_repo",
            toolName: "write_file",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "write_file" });
        assert.equal(out.decision, "requires_approval");
    });

    it("full_auto_thread does not relax always_require tool override", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent", "automation"],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: { write_file: "always_require" },
        });
        const b = baseResult({
            decision: "requires_approval",
            toolClass: "write_repo",
            toolName: "write_file",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "write_file" });
        assert.equal(out.decision, "requires_approval");
    });

    it("automation source ignores thread modes", () => {
        const b = baseResult({
            normalizedSource: "automation",
            source: "automation",
            decision: "auto_approve",
        });
        const out = applyThreadApprovalOverride(b, { mode: "confirm_everything", toolName: "read_file" });
        assert.equal(out.decision, "auto_approve");
    });

    it("deny decision is never changed", () => {
        const b = baseResult({ decision: "deny", reason: "blocked" });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "read_file" });
        assert.equal(out.decision, "deny");
    });
});
