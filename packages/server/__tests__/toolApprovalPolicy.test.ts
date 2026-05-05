import { afterEach, describe, it, expect } from "vitest";

import {
    applyThreadApprovalOverride,
    classifyTool,
    clearToolApprovalConfigOverride,
    getToolApprovalPolicy,
    isKletronAdminToolName,
    isNamespacedExternalMcpToolName,
    isSafeCommand,
    normalizeRunSource,
    READONLY_TOOLS,
    EXECUTION_TOOLS,
    WRITE_REPO_TOOLS,
    setToolApprovalConfigOverride,
} from "../src/services/toolApprovalPolicy";
import type { ToolApprovalConfig, ToolApprovalPolicyResult } from "../src/services/toolApprovalPolicy";

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
        expect(normalizeRunSource("agent")).toBe("agent");
        expect(normalizeRunSource("automation")).toBe("automation");
    });

    it("falls back to unknown for legacy/empty sources", () => {
        expect(normalizeRunSource(undefined)).toBe("unknown");
        expect(normalizeRunSource("")).toBe("unknown");
        expect(normalizeRunSource("legacy")).toBe("unknown");
    });

    it("normalizes channel-prefixed sources", () => {
        expect(normalizeRunSource("channel:telegram")).toBe("channel");
        expect(normalizeRunSource("CHANNEL:slack")).toBe("channel");
    });
});

describe("toolApprovalPolicy tool classification", () => {
    it("classifies readonly tools", () => {
        expect(READONLY_TOOLS.has("read_file")).toBe(true);
        expect(READONLY_TOOLS.has("str_replace_editor")).toBe(false);
        expect(classifyTool("read_file")).toBe("readonly");
    });

    it("classifies SaaS connector API tools as readonly", () => {
        for (const toolName of ["github_api", "sentry_api"]) {
            expect(READONLY_TOOLS.has(toolName)).toBe(true);
            expect(classifyTool(toolName)).toBe("readonly");
        }
    });

    it("classifies Google read-only tools as readonly", () => {
        for (const toolName of [
            "gmail_list_labels",
            "gmail_search_messages",
            "gmail_read_message",
            "calendar_list_calendars",
            "calendar_freebusy",
            "calendar_list_events",
            "calendar_get_event",
            "drive_list_files",
            "drive_read_file",
        ]) {
            expect(READONLY_TOOLS.has(toolName)).toBe(true);
            expect(classifyTool(toolName)).toBe("readonly");
        }
    });

    it("classifies str_replace_editor as write_repo", () => {
        expect(WRITE_REPO_TOOLS.has("str_replace_editor")).toBe(true);
        expect(classifyTool("str_replace_editor")).toBe("write_repo");
    });

    it("classifies execution tools", () => {
        expect(EXECUTION_TOOLS.has("execute_bash")).toBe(true);
        expect(classifyTool("execute_bash")).toBe("execution");
    });

    it("execute_bash is NOT in READONLY_TOOLS", () => {
        expect(READONLY_TOOLS.has("execute_bash")).toBe(false);
    });

    it("classifies write tools", () => {
        expect(WRITE_REPO_TOOLS.has("write_file")).toBe(true);
        expect(classifyTool("write_file")).toBe("write_repo");
    });
});

describe("isSafeCommand", () => {
    it("detects safe read-only commands", () => {
        expect(isSafeCommand("ls")).toBe(true);
        expect(isSafeCommand("ls -la")).toBe(true);
        expect(isSafeCommand("cat package.json")).toBe(true);
        expect(isSafeCommand("grep -r 'foo' src/")).toBe(true);
        expect(isSafeCommand("wc -l src/index.ts")).toBe(true);
        expect(isSafeCommand("echo hello")).toBe(true);
        expect(isSafeCommand("pwd")).toBe(true);
        expect(isSafeCommand("git status")).toBe(true);
        expect(isSafeCommand("git log --oneline -5")).toBe(true);
        expect(isSafeCommand("node --version")).toBe(true);
        expect(isSafeCommand("npm -v")).toBe(true);
        expect(isSafeCommand("head -20 README.md")).toBe(true);
        expect(isSafeCommand("find . -name '*.ts'")).toBe(true);
    });

    it("rejects unsafe commands", () => {
        expect(isSafeCommand("rm -rf /")).toBe(false);
        expect(isSafeCommand("npm install")).toBe(false);
        expect(isSafeCommand("npm test")).toBe(false);
        expect(isSafeCommand("curl https://evil.com")).toBe(false);
        expect(isSafeCommand("git commit -m 'fix'")).toBe(false);
        expect(isSafeCommand("git push origin main")).toBe(false);
        expect(isSafeCommand("sudo apt-get install")).toBe(false);
        expect(isSafeCommand("python -c 'import os; os.system(\"rm -rf /\")'")).toBe(false);
    });

    it("only checks first command segment (before pipes/chains)", () => {
        expect(isSafeCommand("ls -la | head -10")).toBe(true);
        expect(isSafeCommand("cat file.txt | grep pattern")).toBe(true);
        // Unsafe first segment
        expect(isSafeCommand("rm file.txt && ls")).toBe(false);
    });

    it("handles leading env vars", () => {
        expect(isSafeCommand("FOO=bar ls -la")).toBe(true);
    });
});

describe("toolApprovalPolicy decision matrix (config-driven)", () => {
    it("auto-approves readonly tools for agent (default config)", () => {
        // Default: autoApproveReadonlySources = ["agent", "automation"]
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        expect(agentPolicy.decision).toBe("auto_approve");
    });

    it("auto-approves Google read-only tools for agent (default config)", () => {
        const policy = getToolApprovalPolicy({ source: "agent", toolName: "drive_read_file" });
        expect(policy.decision).toBe("auto_approve");
        expect(policy.toolClass).toBe("readonly");
    });

    it("requires approval for execute_bash by default (agent source)", () => {
        // Default: autoApproveSafeBash = true, but no command provided
        const policy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        expect(policy.decision).toBe("requires_approval");
        expect(policy.toolClass).toBe("execution");
    });

    it("auto-approves safe bash commands by default (autoApproveSafeBash defaults to true)", () => {
        // Default config has autoApproveSafeBash=true
        delete process.env.AUTO_APPROVE_SAFE_BASH; // ensure env doesn't interfere
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls -la",
        });
        expect(policy.decision).toBe("auto_approve");
    });

    it("still requires approval for unsafe bash commands", () => {
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "npm test",
        });
        expect(policy.decision).toBe("requires_approval");
    });

    it("requires approval for safe command when autoApproveSafeBash is disabled via env", () => {
        process.env.AUTO_APPROVE_SAFE_BASH = "false";
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls",
        });
        expect(policy.decision).toBe("requires_approval");
    });

    it("requires manual approval for write_repo tools", () => {
        const repoWrite = getToolApprovalPolicy({ source: "agent", toolName: "write_file" });
        expect(repoWrite.decision).toBe("requires_approval");
    });

    it("uses conservative fallback for unknown source", () => {
        const readonlyPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "read_file" });
        const unknownToolPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "mystery_tool" });
        expect(readonlyPolicy.decision).toBe("requires_approval");
        expect(unknownToolPolicy.decision).toBe("requires_approval");
    });

    it("requires approval for readonly tools on channel runs (external messengers)", () => {
        const p = getToolApprovalPolicy({ source: "channel:telegram", toolName: "read_file" });
        expect(p.normalizedSource).toBe("channel");
        expect(p.decision).toBe("requires_approval");
    });
});

describe("toolApprovalPolicy env overrides (backwards compatibility)", () => {
    it("supports AUTO_APPROVE_READONLY_SOURCES override", () => {
        process.env.AUTO_APPROVE_READONLY_SOURCES = "agent";
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        const automationPolicy = getToolApprovalPolicy({ source: "automation", toolName: "read_file" });
        expect(agentPolicy.decision).toBe("auto_approve");
        expect(automationPolicy.decision).toBe("requires_approval");
    });

    it("supports NEVER_AUTO_APPROVE_TOOLS override", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash,read_file";
        const executePolicy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        const readPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        expect(executePolicy.decision).toBe("requires_approval");
        expect(readPolicy.decision).toBe("requires_approval");
    });

    it("NEVER_AUTO_APPROVE_TOOLS overrides safe bash auto-approval", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash";
        // autoApproveSafeBash defaults to true, but neverAutoApproveTools takes precedence
        const policy = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            command: "ls",
        });
        expect(policy.decision).toBe("requires_approval");
    });
});

describe("applyThreadApprovalOverride", () => {
    it("inherit leaves base unchanged", () => {
        const b = baseResult({ decision: "auto_approve" });
        expect(applyThreadApprovalOverride(b, { mode: "inherit", toolName: "read_file" })).toEqual(b);
        expect(applyThreadApprovalOverride(b, { mode: undefined, toolName: "read_file" })).toEqual(b);
    });

    it("confirm_everything turns auto_approve into requires_approval", () => {
        const b = baseResult({ decision: "auto_approve", toolName: "read_file" });
        const out = applyThreadApprovalOverride(b, { mode: "confirm_everything", toolName: "read_file" });
        expect(out.decision).toBe("requires_approval");
        expect(out.reason).toMatch(/confirm_everything/);
    });

    it("full_auto_thread relaxes requires_approval for write_file when not blocked", () => {
        const b = baseResult({
            decision: "requires_approval",
            toolClass: "write_repo",
            toolName: "write_file",
            reason: "repo write",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "write_file" });
        expect(out.decision).toBe("auto_approve");
    });

    it("full_auto_thread does not relax Kletron admin tools", () => {
        expect(isKletronAdminToolName("kletron_list_graphs")).toBe(true);
        const b = baseResult({
            decision: "requires_approval",
            toolName: "kletron_list_graphs",
            toolClass: "unknown",
        });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "kletron_list_graphs" });
        expect(out.decision).toBe("requires_approval");
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
        expect(out.decision).toBe("requires_approval");
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
        expect(out.decision).toBe("requires_approval");
    });

    it("automation source ignores thread modes", () => {
        const b = baseResult({
            normalizedSource: "automation",
            source: "automation",
            decision: "auto_approve",
        });
        const out = applyThreadApprovalOverride(b, { mode: "confirm_everything", toolName: "read_file" });
        expect(out.decision).toBe("auto_approve");
    });

    it("deny decision is never changed", () => {
        const b = baseResult({ decision: "deny", reason: "blocked" });
        const out = applyThreadApprovalOverride(b, { mode: "full_auto_thread", toolName: "read_file" });
        expect(out.decision).toBe("deny");
    });

    it("work mode denies tools not in Work allowlist", () => {
        const p = getToolApprovalPolicy({
            source: "agent",
            toolName: "execute_bash",
            workMode: "work",
            command: "ls",
        });
        expect(p.decision).toBe("deny");
    });

    it("work mode allows read_file", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "read_file", workMode: "work" });
        expect(p.decision).not.toBe("deny");
    });

    it("work mode allows load_skill", () => {
        const p = getToolApprovalPolicy({ source: "agent", toolName: "load_skill", workMode: "work" });
        expect(p.decision).not.toBe("deny");
    });

    it("work mode allows sentry_api and github_api (readonly SaaS connectors)", () => {
        for (const toolName of ["sentry_api", "github_api"]) {
            const p = getToolApprovalPolicy({ source: "agent", toolName, workMode: "work" });
            expect(p.decision).not.toBe("deny");
            expect(p.decision).toBe("auto_approve");
        }
    });

    it("work mode allows namespaced external MCP tools (slug__tool)", () => {
        expect(isNamespacedExternalMcpToolName("hunter__domain-search")).toBe(true);
        const p = getToolApprovalPolicy({
            source: "agent",
            toolName: "hunter__domain-search",
            workMode: "work",
        });
        expect(p.decision).not.toBe("deny");
        expect(p.decision).toBe("requires_approval");
        const auto = applyThreadApprovalOverride(p, {
            mode: "full_auto_thread",
            toolName: "hunter__domain-search",
        });
        expect(auto.decision).toBe("auto_approve");
    });

    it("uses injected approvalConfig for never-auto list", () => {
        const cfg: ToolApprovalConfig = {
            autoApproveReadonlySources: ["agent", "automation"],
            neverAutoApproveTools: ["read_file"],
            autoApproveSafeBash: true,
            toolOverrides: {},
        };
        const p = getToolApprovalPolicy({ source: "agent", toolName: "read_file", approvalConfig: cfg });
        expect(p.decision).toBe("requires_approval");
    });

    it("applyThreadApprovalOverride full_auto honors approvalConfig never list", () => {
        const cfg: ToolApprovalConfig = {
            autoApproveReadonlySources: ["agent", "automation"],
            neverAutoApproveTools: ["read_file"],
            autoApproveSafeBash: true,
            toolOverrides: {},
        };
        const base = getToolApprovalPolicy({
            source: "channel:x",
            toolName: "read_file",
            approvalConfig: cfg,
        });
        expect(base.decision).toBe("requires_approval");
        const out = applyThreadApprovalOverride(base, {
            mode: "full_auto_thread",
            toolName: "read_file",
            approvalConfig: cfg,
        });
        expect(out.decision).toBe("requires_approval");
    });
});
