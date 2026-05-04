# Kletron admin tool pack

> Source: `packages/agent-core/src/tools/kletronAdminTools.ts`
>
> Audit: `packages/server/src/services/agentAuditService.ts`
>
> Identity: `packages/server/src/workspace/workspaceContext.ts`

The Kletron admin tool pack is an always-on set of LangChain tools that lets
agents manage Kletron itself: agent graphs, automations, the skills library,
workspace skill activations, connectors (integrations + external MCP
servers), and plugins. They are the missing piece that takes the agent from
"works in a folder" (Cowork-style) to "self-configuring product".

## Why in-process (not MCP)?

Admin tools mutate Mongo and need a trusted user identity. Putting them
behind the bundled MCP server would force us to thread per-call user identity
across an extra hop. Instead they are LangChain tools registered directly by
the executor, with identity read from
`runWithWorkspaceContext(workspace, fn, { userId, runId })`.

## Identity flow

```text
executeRunStreaming(runId)
    └─ runWithWorkspaceContext(workspace, fn, { userId: workspace.ownerId, runId })
            └─ ReAct agent invokes a kletron_* tool
                    └─ requireRunIdentity()  // reads ALS context
                            └─ service call (workspace-scoped)
                                    └─ agentAuditService.log({ outcome, userId, ... })
```

`requireRunIdentity()` throws if no `userId` is present, so the LLM cannot
trick the system into performing admin actions on behalf of a different user.

## Tool catalogue (v1)

| Group | Tool | Purpose |
|---|---|---|
| Graphs | `kletron_list_graphs` | List/search graphs |
| | `kletron_get_graph` | Fetch one graph by id |
| | `kletron_create_graph` | Create a new graph (nodes + edges) |
| | `kletron_update_graph` | Patch fields/nodes/edges |
| | `kletron_clone_graph` | Duplicate under a new name |
| | `kletron_delete_graph` | Delete a graph (`confirm: true` required) |
| Automations | `kletron_list_automations` | List automations in this workspace |
| | `kletron_get_automation` | Fetch one automation |
| | `kletron_create_automation` | Create an automation (≥1 stage with prompt) |
| | `kletron_update_automation` | Patch fields/stages |
| | `kletron_delete_automation` | Delete (`confirm: true` required) |
| | `kletron_run_automation` | Trigger a run; returns thread id |
| Skills | `kletron_list_skills` | Browse the library (filter by source/search) |
| | `kletron_get_skill` | Fetch one skill (full body) |
| | `kletron_create_skill` | Create a user skill (slug must be unique) |
| | `kletron_update_skill` | Update a user skill (owner-only) |
| | `kletron_delete_skill` | Delete a user skill (`confirm: true`) |
| | `kletron_list_workspace_skills` | List activations on this workspace |
| | `kletron_enable_workspace_skill` | Activate a skill on this workspace |
| | `kletron_disable_workspace_skill` | Deactivate a skill |
| Connectors | `kletron_list_connectors` | Integrations + external MCP servers |
| | `kletron_add_integration` | Add/upsert an integration credential |
| | `kletron_remove_integration` | Remove an integration (`confirm: true`) |
| | `kletron_add_mcp_server` | Register an external MCP (stdio or SSE) |
| | `kletron_remove_mcp_server` | Remove an external MCP (`confirm: true`) |
| Plugins | `kletron_list_plugins` | Catalog with install status |
| | `kletron_install_plugin` | Install a plugin (enables bundled skills) |
| | `kletron_uninstall_plugin` | Uninstall (`confirm: true`) |

## Safety model

1. **Strict zod schemas at the tool boundary.** No free-form payloads for
   destructive ops. Names, descriptions, and slugs are length-bounded.
2. **`confirm: true` literal** for every destructive action
   (delete/uninstall/remove). The LLM cannot delete by accident.
3. **Per-run user identity** is read from `runWithWorkspaceContext` and
   never from arguments.
4. **Audit log** (`agent_audit` Mongo collection) records every call with:
   `tool`, `args`, `result|error`, `outcome`, `userId`, `workspaceId`,
   `runId`, `createdAt`. Args/results are truncated past ~8 KB to keep the
   collection bounded.
5. **Resolver baseline.** `KLETRON_ADMIN_TOOL_NAMES` is added to
   `BASELINE_TOOLS` in
   [`workspaceCapabilityResolver`](../../packages/server/src/services/workspaceCapabilityResolver.ts)
   so admin tools are always part of `enabledToolSet` regardless of which
   skills are active.

## Adding a new admin tool

1. Add a `tool({...})` to `kletronAdminTools.ts` following the existing
   pattern (zod schema, `requireRunIdentity()`, service call, `withAudit`).
2. Append the tool to the `kletronAdminTools` array (this is what the
   executor binds and what `KLETRON_ADMIN_TOOL_NAMES` reads).
3. If the action mutates state, require a `confirm: z.literal(true)`
   parameter for destructive variants.
4. Add a vitest case mocking the underlying service.
5. Document the tool in the catalogue above.

## Operational notes

- Audit log: index by `(workspaceId, createdAt)` for fast per-workspace
  history. Old entries can be expired with a Mongo TTL index if needed.
- Failure isolation: if Mongo is unreachable, audit logging falls back to
  `console.warn` with the structured payload so the call is still traceable.
- The pack is enabled for **every** workspace by default. To disable, remove
  the spread in `BASELINE_TOOLS` in
  [`workspaceCapabilityResolver.ts`](../../packages/server/src/services/workspaceCapabilityResolver.ts)
  and stop importing `kletronAdminTools` from the executor.
