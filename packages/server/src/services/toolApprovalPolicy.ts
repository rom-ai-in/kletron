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

export type ToolApprovalConfig = {
    autoApproveReadonlySources: string[];
    neverAutoApproveTools: string[];
    autoApproveSafeBash: boolean;
    toolOverrides: Record<string, "always_approve" | "always_require" | "default">;
};

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

export type NormalizedRunSource = "agent" | "automation" | "unknown";

export type ToolClass = "readonly" | "execution" | "write_repo" | "unknown";

export type ToolApprovalDecision = "auto_approve" | "requires_approval" | "deny";

export type ToolApprovalPolicyInput = {
    source?: string;
    toolName: string;
    /** For execution tools like execute_bash, the command string for safe-command detection */
    command?: string;
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
    "find_references",
    "todo_search",
    "bootstrap_context",
    "web_search",
    "fetch_url",
    "output_format",
    "write_todos",
    "str_replace_editor",
]);

export const EXECUTION_TOOLS = new Set<string>([
    "execute_bash",
]);

export const WRITE_REPO_TOOLS = new Set<string>(["write_file"]);

/**
 * Safe command prefixes — read-only commands with no side effects.
 * Used for auto-approval when autoApproveSafeBash is enabled.
 */
const SAFE_COMMAND_PREFIXES = [
    "ls", "cat", "head", "tail", "wc", "find", "grep", "rg",
    "echo", "pwd", "which", "whoami", "date", "env", "printenv",
    "file", "stat", "du", "df", "uname", "type",
    "node --version", "node -v", "npm --version", "npm -v",
    "npx --version", "npx -v", "pnpm --version",
    "git status", "git log", "git diff", "git branch",
    "git show", "git blame", "git remote", "git tag",
];

/**
 * Checks if a command is safe (read-only, no side effects).
 * Only inspects the first command segment before pipes/chains.
 */
export const isSafeCommand = (command: string): boolean => {
    const trimmed = command.trim();
    // Take only the first command before any pipe, semicolon, &&, ||, or newline
    const first = trimmed.split(/[|;&\n]/)[0].trim();
    // Strip leading env vars (e.g. "FOO=bar ls")
    const withoutEnvVars = first.replace(/^(\w+=\S+\s+)+/, "");
    return SAFE_COMMAND_PREFIXES.some(
        (prefix) => withoutEnvVars === prefix || withoutEnvVars.startsWith(prefix + " ")
    );
};

export const normalizeRunSource = (source?: string): NormalizedRunSource => {
    const normalized = String(source ?? "").trim().toLowerCase();
    if (normalized === "agent") return "agent";
    if (normalized === "automation") return "automation";
    return "unknown";
};

export const classifyTool = (toolName: string): ToolClass => {
    const normalizedToolName = String(toolName).trim().toLowerCase();
    if (READONLY_TOOLS.has(normalizedToolName)) return "readonly";
    if (EXECUTION_TOOLS.has(normalizedToolName)) return "execution";
    if (WRITE_REPO_TOOLS.has(normalizedToolName)) return "write_repo";
    return "unknown";
};

export const getToolApprovalPolicy = (input: ToolApprovalPolicyInput): ToolApprovalPolicyResult => {
    const toolName = String(input.toolName ?? "").trim().toLowerCase();
    const source = String(input.source ?? "");
    const normalizedSource = normalizeRunSource(source);
    const toolClass = classifyTool(toolName);

    // Read config from persisted config → env vars → defaults
    const cfg: ToolApprovalConfig = resolveToolApprovalConfig();

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

