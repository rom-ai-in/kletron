/**
 * Comprehensive integration tests for the real execute_bash tool.
 * Tests cover: basic execution, exit codes, stderr, timeouts, cwd resolution,
 * pipes, multi-line commands, environment, large output, special chars,
 * safe-command detection, and approval policy correctness.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";

// ════════════════════════════════════════════════════════════════════════
// 1. REAL BASH EXECUTOR TESTS
// ════════════════════════════════════════════════════════════════════════

// Dynamic import to avoid ESM issues
let executeBash: any;
const loadExecuteBash = async () => {
    if (!executeBash) {
        const mod = await import("../../../apps/mcp-server/tools/executeBash.js");
        executeBash = mod.executeBash;
    }
    return executeBash;
};

describe("execute_bash: basic execution", () => {
    it("runs echo and captures stdout", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo hello" });
        assert.equal(result.ok, true);
        assert.equal(result.exitCode, 0);
        assert.equal(result.output, "hello");
        assert.equal(result.truncated, false);
    });

    it("runs multi-word echo", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: 'echo "hello world"' });
        assert.equal(result.ok, true);
        assert.equal(result.output, "hello world");
    });

    it("runs pwd", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "pwd" });
        assert.equal(result.ok, true);
        assert.ok(result.output.startsWith("/"));
    });

    it("runs multi-line output (seq)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "seq 1 5" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "1\n2\n3\n4\n5");
    });
});

describe("execute_bash: exit codes", () => {
    it("captures exit code 0", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "true" });
        assert.equal(result.ok, true);
        assert.equal(result.exitCode, 0);
    });

    it("captures exit code 1", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "false" });
        assert.equal(result.ok, false);
        assert.equal(result.exitCode, 1);
    });

    it("captures exit code 42", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "exit 42" });
        assert.equal(result.ok, false);
        assert.equal(result.exitCode, 42);
    });

    it("captures exit code 127 (command not found)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "nonexistent_command_xyz_12345" });
        assert.equal(result.ok, false);
        assert.equal(result.exitCode, 127);
        assert.ok(result.output.includes("not found") || result.output.includes("command not found"));
    });
});

describe("execute_bash: stderr handling", () => {
    it("captures stderr separately", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo out; echo err >&2" });
        assert.equal(result.ok, true);
        assert.ok(result.output.includes("out"));
        assert.ok(result.output.includes("[stderr]"));
        assert.ok(result.output.includes("err"));
    });

    it("handles stderr-only output from failed command", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "ls /nonexistent_path_xyz" });
        assert.equal(result.ok, false);
        assert.ok(result.output.includes("[stderr]"));
        assert.ok(result.output.includes("No such file"));
    });
});

describe("execute_bash: pipes and complex commands", () => {
    it("handles pipes", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo 'hello world' | wc -w" });
        assert.equal(result.ok, true);
        assert.equal(result.output.trim(), "2");
    });

    it("handles command substitution", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo $(echo nested)" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "nested");
    });

    it("handles semicolons (sequential commands)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo A; echo B; echo C" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "A\nB\nC");
    });

    it("handles && chaining (success path)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "true && echo success" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "success");
    });

    it("handles && chaining (fail path)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "false && echo success" });
        assert.equal(result.ok, false);
        assert.equal(result.output, "");
    });

    it("handles || chaining", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "false || echo fallback" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "fallback");
    });
});

describe("execute_bash: environment", () => {
    it("TERM is set to dumb (no color codes)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo $TERM" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "dumb");
    });

    it("inherits PATH from environment", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "which node" });
        assert.equal(result.ok, true);
        assert.ok(result.output.includes("node"));
    });

    it("supports inline env vars", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "MY_VAR=hello echo $MY_VAR" });
        // Note: this specific syntax might not work as expected in bash
        // because env is set for the external command, not shell builtins
        // The correct test:
        const result2 = await bash.run({ command: "export MY_VAR=hello && echo $MY_VAR" });
        assert.equal(result2.ok, true);
        assert.equal(result2.output, "hello");
    });
});

describe("execute_bash: timeout", () => {
    it("kills command that exceeds timeout", async () => {
        const bash = await loadExecuteBash();
        const start = Date.now();
        const result = await bash.run({ command: "sleep 30", timeoutMs: 1500 });
        const elapsed = Date.now() - start;
        assert.equal(result.ok, false);
        assert.equal(result.killed, true);
        assert.ok(result.output.includes("[killed: timeout exceeded]"));
        assert.ok(elapsed < 5000, `Expected timeout within 5s but took ${elapsed}ms`);
    });

    it("respects minimum timeout of 1000ms", async () => {
        const bash = await loadExecuteBash();
        const start = Date.now();
        const result = await bash.run({ command: "sleep 10", timeoutMs: 100 });
        const elapsed = Date.now() - start;
        assert.equal(result.killed, true);
        assert.ok(elapsed >= 900, `Expected timeout >= 1000ms but took ${elapsed}ms`);
    });

    it("succeeds within generous timeout", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo fast", timeoutMs: 5000 });
        assert.equal(result.ok, true);
        assert.equal(result.output, "fast");
    });
});

describe("execute_bash: special characters and edge cases", () => {
    it("handles single quotes", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo 'hello world'" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "hello world");
    });

    it("handles double quotes with variables", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: 'echo "HOME=$HOME"' });
        assert.equal(result.ok, true);
        assert.ok(result.output.startsWith("HOME=/"));
    });

    it("handles newlines in command", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo line1\necho line2" });
        assert.equal(result.ok, true);
        assert.equal(result.output, "line1\nline2");
    });

    it("handles empty command (bash -c '' exits 0)", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "" });
        assert.equal(result.ok, true);
        assert.equal(result.exitCode, 0);
    });

    it("handles glob patterns", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "ls *.json 2>/dev/null || echo 'no match'" });
        assert.equal(result.ok, true);
    });
});

describe("execute_bash: cwd resolution", () => {
    it("uses default cwd (repo root) when path is not specified", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "pwd" });
        assert.equal(result.ok, true);
        // Should resolve to some directory
        assert.ok(result.output.startsWith("/"), "cwd should be absolute path");
    });

    it("rejects paths outside workspace (security gate)", async () => {
        const bash = await loadExecuteBash();
        await assert.rejects(
            bash.run({ command: "pwd", path: "/tmp" }),
            /outside.*configured.*repo|outside.*workspace/i,
            "Should reject paths outside configured workspace roots"
        );
    });
});

describe("execute_bash: output structure", () => {
    it("returns { ok, exitCode, output, truncated } on success", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "echo test" });
        assert.ok("ok" in result, "Missing 'ok' field");
        assert.ok("exitCode" in result, "Missing 'exitCode' field");
        assert.ok("output" in result, "Missing 'output' field");
        assert.ok("truncated" in result, "Missing 'truncated' field");
        assert.equal(typeof result.ok, "boolean");
        assert.equal(typeof result.exitCode, "number");
        assert.equal(typeof result.output, "string");
        assert.equal(typeof result.truncated, "boolean");
    });

    it("returns { ok, exitCode, output, truncated, killed } on failure", async () => {
        const bash = await loadExecuteBash();
        const result = await bash.run({ command: "false" });
        assert.ok("ok" in result);
        assert.ok("exitCode" in result);
        assert.ok("output" in result);
        assert.ok("truncated" in result);
        assert.ok("killed" in result, "Missing 'killed' field on error");
    });
});

// ════════════════════════════════════════════════════════════════════════
// 2. isSafeCommand EXHAUSTIVE TESTS
// ════════════════════════════════════════════════════════════════════════

import { isSafeCommand } from "../src/services/toolApprovalPolicy";

describe("isSafeCommand: exhaustive coverage", () => {
    const safeCmds = [
        // Basic read-only
        "ls", "ls -la", "ls -R src/", "ls *.ts",
        "cat README.md", "cat -n package.json",
        "head -20 file.txt", "tail -f log.txt", "tail -100 output.log",
        "wc -l src/index.ts", "wc -w README.md",
        "find . -name '*.ts'", "find src -type f -name '*.test.ts'",
        "grep -r 'TODO' src/", "grep -n 'export' file.ts",
        "rg 'pattern' src/", "rg --files src/",
        // Info commands
        "echo hello", "echo $PATH",
        "pwd", "which node", "whoami", "date", "env",
        "printenv HOME", "file package.json",
        "stat README.md", "du -sh src/", "df -h",
        "uname -a", "type ls",
        // Version checks
        "node --version", "node -v",
        "npm --version", "npm -v",
        "npx --version", "npx -v",
        "pnpm --version",
        // Git read-only
        "git status", "git status --short",
        "git log --oneline -10", "git log --stat -5",
        "git diff", "git diff HEAD~1", "git diff --stat",
        "git branch", "git branch -a",
        "git show HEAD", "git show abc123",
        "git blame src/index.ts",
        "git remote -v", "git tag",
        // With pipes (safe first segment)
        "ls -la | head -10", "cat file | grep pattern",
        "wc -l *.ts | sort -n",
        // With env var prefix
        "FOO=bar ls", "NODE_ENV=test echo hello",
    ];

    const unsafeCmds = [
        // Destructive
        "rm file.txt", "rm -rf /", "rm -rf node_modules",
        "rmdir empty/", "mv old.txt new.txt",
        "cp file1 file2",
        // Package management
        "npm install", "npm install express", "npm ci",
        "npm run build", "npm test", "npm run lint",
        "yarn add express", "pnpm install",
        "npx create-react-app my-app",
        // Network
        "curl https://example.com", "wget https://evil.com",
        "ssh user@host",
        // Git write operations
        "git commit -m 'fix'", "git push", "git push origin main",
        "git merge develop", "git rebase main",
        "git checkout -b new-branch", "git stash",
        "git reset --hard HEAD~1",
        // System
        "sudo apt-get install", "brew install node",
        "chmod 777 script.sh", "chown root file",
        // Execution
        "python script.py", "python -c 'import os'",
        "node script.js", "bash script.sh",
        "./script.sh",
        // Write
        "touch newfile.txt", "mkdir newdir",
        "tee output.log",
        // Redirection (unsafe first segment)
        "npm test > output.log",
    ];

    for (const cmd of safeCmds) {
        it(`safe: "${cmd}"`, () => {
            assert.ok(isSafeCommand(cmd), `Expected "${cmd}" to be safe`);
        });
    }

    for (const cmd of unsafeCmds) {
        it(`unsafe: "${cmd}"`, () => {
            assert.ok(!isSafeCommand(cmd), `Expected "${cmd}" to be unsafe`);
        });
    }
});

// ════════════════════════════════════════════════════════════════════════
// 3. APPROVAL POLICY - FULL MATRIX
// ════════════════════════════════════════════════════════════════════════

import {
    classifyTool,
    getToolApprovalPolicy,
    normalizeRunSource,
    READONLY_TOOLS,
    EXECUTION_TOOLS,
    WRITE_REPO_TOOLS,
    setToolApprovalConfigOverride,
    clearToolApprovalConfigOverride,
} from "../src/services/toolApprovalPolicy";

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

describe("approval policy: classification", () => {
    it("all READONLY_TOOLS classify as readonly", () => {
        for (const tool of READONLY_TOOLS) {
            assert.equal(classifyTool(tool), "readonly", `${tool} should be readonly`);
        }
    });

    it("all EXECUTION_TOOLS classify as execution", () => {
        for (const tool of EXECUTION_TOOLS) {
            assert.equal(classifyTool(tool), "execution", `${tool} should be execution`);
        }
    });

    it("all WRITE_REPO_TOOLS classify as write_repo", () => {
        for (const tool of WRITE_REPO_TOOLS) {
            assert.equal(classifyTool(tool), "write_repo", `${tool} should be write_repo`);
        }
    });

    it("unknown tools classify as unknown", () => {
        assert.equal(classifyTool("mystery_tool"), "unknown");
        assert.equal(classifyTool(""), "unknown");
    });

    it("execute_bash is NOT readonly", () => {
        assert.ok(!READONLY_TOOLS.has("execute_bash"));
        assert.ok(EXECUTION_TOOLS.has("execute_bash"));
    });
});

describe("approval policy: full decision matrix (default config)", () => {
    // Default: autoApproveReadonlySources=["agent","automation"], autoApproveSafeBash=true

    it("readonly + agent = auto_approve", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        assert.equal(p.decision, "auto_approve");
        assert.equal(p.toolClass, "readonly");
    });

    it("readonly + automation = auto_approve", () => {
        const p = getToolApprovalPolicy({ source: "automation", toolName: "list_files" });
        assert.equal(p.decision, "auto_approve");
    });

    it("readonly + unknown = requires_approval", () => {
        const p = getToolApprovalPolicy({ source: "legacy", toolName: "read_file" });
        assert.equal(p.decision, "requires_approval");
    });

    it("execute_bash (no command) = requires_approval", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        assert.equal(p.decision, "requires_approval");
        assert.equal(p.toolClass, "execution");
    });

    it("execute_bash + safe command (ls) = auto_approve (default autoApproveSafeBash=true)", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "ls -la" });
        assert.equal(p.decision, "auto_approve");
    });

    it("execute_bash + unsafe command (npm test) = requires_approval", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "npm test" });
        assert.equal(p.decision, "requires_approval");
    });

    it("execute_bash + safe command + unknown source = requires_approval", () => {
        const p = getToolApprovalPolicy({ source: "unknown", toolName: "execute_bash", command: "ls" });
        assert.equal(p.decision, "requires_approval");
    });

    it("write_file = requires_approval always", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "write_file" });
        assert.equal(p.decision, "requires_approval");
        assert.equal(p.toolClass, "write_repo");
    });

    it("unknown tool = requires_approval", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "mystery" });
        assert.equal(p.decision, "requires_approval");
    });
});

describe("approval policy: per-tool overrides", () => {
    it("always_approve override bypasses all checks", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent"],
            neverAutoApproveTools: [],
            autoApproveSafeBash: false,
            toolOverrides: { "execute_bash": "always_approve" },
        });
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "rm -rf /" });
        assert.equal(p.decision, "auto_approve");
        assert.ok(p.reason.includes("always_approve"));
    });

    it("always_require override blocks even safe commands", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent"],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: { "execute_bash": "always_require" },
        });
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "ls" });
        assert.equal(p.decision, "requires_approval");
        assert.ok(p.reason.includes("always_require"));
    });

    it("default override falls through to normal logic", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent"],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: { "execute_bash": "default" },
        });
        const safe = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "ls" });
        const unsafe = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "npm test" });
        assert.equal(safe.decision, "auto_approve");
        assert.equal(unsafe.decision, "requires_approval");
    });

    it("per-tool override takes precedence over neverAutoApproveTools", () => {
        setToolApprovalConfigOverride({
            autoApproveReadonlySources: ["agent"],
            neverAutoApproveTools: ["execute_bash"],
            autoApproveSafeBash: true,
            toolOverrides: { "execute_bash": "always_approve" },
        });
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        assert.equal(p.decision, "auto_approve", "per-tool override should beat neverAutoApprove");
    });
});

describe("approval policy: env var backwards compatibility", () => {
    it("AUTO_APPROVE_READONLY_SOURCES=agent restricts automation", () => {
        process.env.AUTO_APPROVE_READONLY_SOURCES = "agent";
        const agent = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        const auto = getToolApprovalPolicy({ source: "automation", toolName: "read_file" });
        assert.equal(agent.decision, "auto_approve");
        assert.equal(auto.decision, "requires_approval");
    });

    it("AUTO_APPROVE_SAFE_BASH=false disables safe command auto-approval", () => {
        process.env.AUTO_APPROVE_SAFE_BASH = "false";
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "ls" });
        assert.equal(p.decision, "requires_approval");
    });

    it("NEVER_AUTO_APPROVE_TOOLS=execute_bash blocks all execute_bash", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash";
        const p = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash", command: "ls" });
        assert.equal(p.decision, "requires_approval");
    });
});

describe("approval policy: normalizeRunSource", () => {
    it("handles all edge cases", () => {
        assert.equal(normalizeRunSource("agent"), "agent");
        assert.equal(normalizeRunSource("Agent"), "agent");
        assert.equal(normalizeRunSource("AGENT"), "agent");
        assert.equal(normalizeRunSource("automation"), "automation");
        assert.equal(normalizeRunSource("Automation"), "automation");
        assert.equal(normalizeRunSource(""), "unknown");
        assert.equal(normalizeRunSource(undefined), "unknown");
        assert.equal(normalizeRunSource("  agent  "), "agent");
        assert.equal(normalizeRunSource("manual"), "unknown");
    });
});
