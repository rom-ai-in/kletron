// Single source of truth for "what tool names this node is actually allowed
// to call at runtime", combining graph-node defaults, skill-derived tools,
// always-on admin tools, and the workspace-level capability set.
//
// Effective rule:
//
//   effective = ((node.toolNames ∪ skill.tools ∪ admin.alwaysOn) ∩ caps.enabledToolSet)
//               ∪ caps.externalNamespacedTools
//
// External MCP tools are namespaced as `slug__toolName` and are NOT gated by
// the per-node allowlist (they are exposed wholesale because the user opted
// into the external server at the workspace level). They are still pinned to
// the workspace's enabled external server set via `caps.externalMcpServers`.

export interface EffectiveToolNamesInput {
    /** Tool names declared on the graph node (may be empty for "use defaults"). */
    nodeToolNames: string[];
    /** Tool names derived from enabled skills (requiredTools + suggestedTools). */
    skillToolNames: string[];
    /** Always-on admin tools (Kletron management). */
    adminToolNames: string[];
    /** Workspace capability set (everything the workspace allows). */
    capabilityToolSet: Set<string>;
    /** Namespaced names exposed by enabled external MCP servers. */
    externalNamespacedTools: string[];
    /** Tools that are always added regardless of caps (e.g. `write_todos`). */
    alwaysOn?: string[];
}

export interface EffectiveToolNamesResult {
    /** Final, deduped, sorted list of tool names the node may invoke. */
    names: string[];
    /** Tool names referenced by node/skills that were dropped (not in caps). */
    dropped: string[];
    /** External tool names included verbatim. */
    externals: string[];
}

const DEFAULT_ALWAYS_ON = ["write_todos"];

/** Legacy / LLM aliases → canonical bundled tool id (must match MCP tool \`name\` and capability set keys). */
const BUNDLED_TOOL_ALIASES: Record<string, string> = {
    find_references: "references",
};

function canonicalBundledToolName(name: string): string {
    const lower = String(name ?? "")
        .trim()
        .toLowerCase();
    return BUNDLED_TOOL_ALIASES[lower] ?? lower;
}

export function effectiveToolNames(
    input: EffectiveToolNamesInput
): EffectiveToolNamesResult {
    const alwaysOn = input.alwaysOn ?? DEFAULT_ALWAYS_ON;
    const alwaysOnSet = new Set(alwaysOn.filter(Boolean).map((n) => n.trim().toLowerCase()));

    const requested = new Set<string>([
        ...input.nodeToolNames,
        ...input.skillToolNames,
        ...input.adminToolNames,
    ]);

    const allowed = new Set<string>();
    const dropped: string[] = [];

    // Apply the workspace gate to bundled / admin tool names.
    for (const name of requested) {
        if (!name) continue;
        const capKey = canonicalBundledToolName(name);
        const nameLower = name.trim().toLowerCase();
        // Always-on tools bypass caps but still appear on the graph allowlist — do not report as "dropped".
        if (alwaysOnSet.has(nameLower)) {
            const exact = alwaysOn.find((n) => n && n.trim().toLowerCase() === nameLower);
            if (exact) allowed.add(exact.trim());
            continue;
        }
        const adminHit = input.adminToolNames.some(
            (a) => a === name || a.trim().toLowerCase() === capKey || canonicalBundledToolName(a) === capKey,
        );
        if (input.capabilityToolSet.has(capKey) || input.adminToolNames.includes(name) || adminHit) {
            allowed.add(capKey);
        } else {
            dropped.push(name);
        }
    }

    // Always-on tools (executor essentials) bypass the gate.
    for (const name of alwaysOn) {
        if (name) allowed.add(name);
    }

    // External MCP tools: namespaced names are added wholesale.
    const externals: string[] = [];
    for (const name of input.externalNamespacedTools) {
        if (!name) continue;
        allowed.add(name);
        externals.push(name);
    }

    return {
        names: Array.from(allowed).sort(),
        dropped: Array.from(new Set(dropped)).sort(),
        externals: Array.from(new Set(externals)).sort(),
    };
}
