import manifest from "./agentBundledTools.json";

/** Semantic version string for debugging / capabilities API (bump when the bundled tool list changes). */
export const AGENT_BUNDLED_PROFILE_VERSION: string = manifest.version;

/**
 * Bundled MCP / executor tools enabled for every workspace by default (unioned with
 * {@link packages/server/src/services/workspaceCapabilityResolver.ts BASELINE_TOOLS}).
 *
 * Excludes connector-only tools (`web_search`, `fetch_url`) and integration-gated tools
 * (`github_api`, `notify`) — those stay behind integrations via existing resolver logic.
 *
 * Keep `standardWorkspaceBundledTools` in agentBundledTools.json in sync with
 * `buildAllTools()` in apps/mcp-server/server.js (plus `semantic_code_search` / `find_references`
 * which are executor-local LangChain tools).
 */
export const STANDARD_WORKSPACE_BUNDLED_TOOLS: readonly string[] =
    manifest.standardWorkspaceBundledTools;
