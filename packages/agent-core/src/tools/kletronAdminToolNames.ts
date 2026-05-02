/**
 * Stable list of Kletron admin tool names (in-process LangChain tools).
 * Kept in a dependency-free module so `workspaceCapabilityResolver` and
 * other server entry points can import it without pulling in the full admin
 * pack (avoids circular init with `kletronAdminTools.ts` ↔ server services).
 *
 * When adding a tool in `kletronAdminTools.ts`, add its `name` here too.
 */
export const KLETRON_ADMIN_TOOL_NAMES: readonly string[] = [
    "kletron_list_graphs",
    "kletron_get_graph",
    "kletron_create_graph",
    "kletron_update_graph",
    "kletron_clone_graph",
    "kletron_delete_graph",
    "kletron_list_automations",
    "kletron_get_automation",
    "kletron_create_automation",
    "kletron_update_automation",
    "kletron_delete_automation",
    "kletron_run_automation",
    "kletron_list_skills",
    "kletron_get_skill",
    "kletron_create_skill",
    "kletron_update_skill",
    "kletron_delete_skill",
    "kletron_list_workspace_skills",
    "kletron_enable_workspace_skill",
    "kletron_disable_workspace_skill",
    "kletron_list_connectors",
    "kletron_add_integration",
    "kletron_remove_integration",
    "kletron_add_mcp_server",
    "kletron_remove_mcp_server",
    "kletron_list_plugins",
    "kletron_install_plugin",
    "kletron_uninstall_plugin",
] as const;
