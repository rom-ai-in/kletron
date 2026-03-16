import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    classifyTool,
    getToolApprovalPolicy,
    isSafeCommand,
    normalizeRunSource,
    READONLY_TOOLS,
    EXECUTION_TOOLS,
    WRITE_REPO_TOOLS,
} from "../src/services/toolApprovalPolicy";

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
});

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
        assert.ok(READONLY_TOOLS.has("str_replace_editor"));
        assert.equal(classifyTool("read_file"), "readonly");
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
