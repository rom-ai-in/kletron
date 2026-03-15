export type NormalizedRunSource = "agent" | "automation" | "unknown";

export type ToolClass = "readonly" | "write_repo" | "unknown";

export type ToolApprovalDecision = "auto_approve" | "requires_approval" | "deny";

export type ToolApprovalPolicyInput = {
    source?: string;
    toolName: string;
};

export type ToolApprovalPolicyResult = {
    source: string;
    normalizedSource: NormalizedRunSource;
    toolName: string;
    toolClass: ToolClass;
    decision: ToolApprovalDecision;
    reason: string;
};

const normalizeCsv = (raw: string | undefined): Set<string> => {
    if (!raw) return new Set();
    return new Set(
        raw
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
    );
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
    "execute_bash",
    "str_replace_editor",
]);

export const WRITE_REPO_TOOLS = new Set<string>(["write_file"]);

export const normalizeRunSource = (source?: string): NormalizedRunSource => {
    const normalized = String(source ?? "").trim().toLowerCase();
    if (normalized === "agent") return "agent";
    if (normalized === "automation") return "automation";
    return "unknown";
};

export const classifyTool = (toolName: string): ToolClass => {
    const normalizedToolName = String(toolName).trim().toLowerCase();
    if (READONLY_TOOLS.has(normalizedToolName)) return "readonly";
    if (WRITE_REPO_TOOLS.has(normalizedToolName)) return "write_repo";
    return "unknown";
};

export const getToolApprovalPolicy = (input: ToolApprovalPolicyInput): ToolApprovalPolicyResult => {
    const toolName = String(input.toolName ?? "").trim().toLowerCase();
    const source = String(input.source ?? "");
    const normalizedSource = normalizeRunSource(source);
    const toolClass = classifyTool(toolName);

    const autoApproveReadonlySources = normalizeCsv(
        process.env.AUTO_APPROVE_READONLY_SOURCES ?? "agent,automation"
    );
    const neverAutoApproveTools = normalizeCsv(process.env.NEVER_AUTO_APPROVE_TOOLS);

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


    return {
        source,
        normalizedSource,
        toolName,
        toolClass,
        decision: "requires_approval",
        reason: "Unknown tool class defaults to requiring approval.",
    };
};
