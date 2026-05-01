// Single resolver that decides what an agent for a given workspace can do.
//
// Inputs:  workspaceId
// Output: {
//   enabledSkills    : ResolvedSkillRecord[]   (from skillsService)
//   enabledTools     : Set<string>             (gated by skills + integrations)
//   externalMcpServers: ExternalMcpRuntimeConfig[]
// }
//
// Used by:
//   - The bundled MCP server, to filter its tool list per workspace.
//   - The MCP client, to know which external servers to connect to.
//   - The agent graph executor, to resolve skill prompts at run time.

import { resolveWorkspaceSkills } from "./skillsService";
import {
    getExternalMcpRuntimeConfig,
    listEnabledIntegrationProviderIds,
    type ExternalMcpRuntimeConfig,
} from "./connectorsService";
import { toolsUnlockedByConnectors } from "@kletron/shared";
import type { ResolvedSkillRecord } from "@kletron/shared/skills/types";

export interface WorkspaceCapabilities {
    workspaceId: string;
    enabledSkills: ResolvedSkillRecord[];
    /** Concrete tool names that should be exposed for this workspace. */
    enabledTools: string[];
    enabledToolSet: Set<string>;
    /** Active SaaS integration provider ids. */
    enabledIntegrationProviderIds: string[];
    /** External MCP servers (with decrypted env/headers). */
    externalMcpServers: ExternalMcpRuntimeConfig[];
}

/**
 * Always-on baseline tools (read-only repo browsing). Without these, even an
 * "empty" workspace wouldn't be useful for the agent.
 */
const BASELINE_TOOLS = [
    "list_files",
    "read_file",
    "read_file_range",
    "search_code",
    "describe_structure",
    "symbols_list",
    "find_symbol",
    "go_to_definition",
    "references",
    "todo_search",
    "repo_metrics",
];

/**
 * Tool names the bundled MCP server exposes that need an integration to be
 * useful (so we don't expose `github_api` if no GitHub credentials present).
 * Anything not listed here is treated as "general purpose" and is gated only
 * by skills' requiredTools/suggestedTools.
 */
const TOOLS_REQUIRING_INTEGRATION: Record<string, string[]> = {
    github_api: ["github"],
    notify: ["slack"],
};

export async function resolveWorkspaceCapabilities(
    workspaceId: string
): Promise<WorkspaceCapabilities> {
    const [skills, integrationIds, externalServers] = await Promise.all([
        resolveWorkspaceSkills(workspaceId),
        listEnabledIntegrationProviderIds(workspaceId),
        getExternalMcpRuntimeConfig(workspaceId),
    ]);

    const tools = new Set<string>(BASELINE_TOOLS);

    // Tools requested by enabled skills.
    for (const skill of skills) {
        for (const t of skill.requiredTools) tools.add(t);
        for (const t of skill.suggestedTools) tools.add(t);
        for (const t of skill.resolvedTools) tools.add(t);
    }

    // Tools unlocked by integrations.
    const integrationTools = toolsUnlockedByConnectors(integrationIds);
    for (const t of integrationTools) tools.add(t);

    // Drop tools that need an integration the user does not have.
    for (const [toolName, providers] of Object.entries(TOOLS_REQUIRING_INTEGRATION)) {
        if (!tools.has(toolName)) continue;
        const hasAny = providers.some((p) => integrationIds.includes(p));
        if (!hasAny) tools.delete(toolName);
    }

    return {
        workspaceId,
        enabledSkills: skills,
        enabledTools: Array.from(tools).sort(),
        enabledToolSet: tools,
        enabledIntegrationProviderIds: integrationIds,
        externalMcpServers: externalServers,
    };
}
