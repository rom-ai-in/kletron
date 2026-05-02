// Kletron admin tool pack — always-on, in-process LangChain tools that let
// an agent manage Kletron itself (graphs, automations, skills, connectors,
// plugins). Each tool:
//
//   * Is bound to the run's identity (userId + workspace) via
//     `runWithWorkspaceContext` — never trusts an LLM-supplied user.
//   * Validates input with strict zod schemas at the boundary.
//   * Logs every call to `agent_audit` with outcome / args / result.
//   * Refuses destructive ops unless the SafeEditGate allows it.
//
// New tools should follow the same shape: declare a zod schema, fetch
// identity from context, call the underlying service, log audit, return
// JSON-stringified output.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { asJson, requireRunIdentity, withAudit } from "./kletronAdminHelpers";
import { kletronExtendedAdminTools } from "./kletronExtendedAdminTools";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import {
    listSkills,
    getSkillBySlug,
    createSkill,
    updateSkill,
    deleteSkill,
    listWorkspaceSkills,
    setWorkspaceSkill,
    removeWorkspaceSkill,
} from "@kletron/server/services/skillsService";
import {
    listIntegrations,
    createIntegration,
    deleteIntegration,
    listMcpServers,
    createMcpServer,
    deleteMcpServer,
} from "@kletron/server/services/connectorsService";
import {
    listInstalledPluginIds,
    installPlugin,
    removePlugin,
    listPluginDefinitions,
} from "@kletron/server/services/pluginsService";
import { SLUG_REGEX } from "@kletron/shared";

// Hard cap on payload sizes so the LLM cannot stash megabytes of body text
// in a single create/update call.
const MAX_BODY_CHARS = 50_000;
const MAX_DESC_CHARS = 5_000;
const MAX_NAME_CHARS = 200;

// ─── Graph schemas (kept loose; the service layer enforces the full shape) ──

const llmSelectionSchema = z
    .object({
        provider: z.string(),
        model: z.string().optional(),
    })
    .passthrough();

const reactConfigSchema = z
    .object({
        systemPrompt: z.string(),
        userPromptTemplate: z.string().default("{{state}}"),
        toolNames: z.array(z.string()).default([]),
        skillIds: z.array(z.string()).optional(),
        llmSelection: llmSelectionSchema.optional(),
        maxToolCalls: z.number().int().positive().optional(),
    })
    .passthrough();

const nodeSchema = z
    .object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(["react", "router", "delegate"]).optional(),
        react: reactConfigSchema,
        output: z
            .object({
                schemaId: z.string(),
                statePath: z.string().optional(),
                stateMerge: z.boolean().optional(),
            })
            .passthrough(),
    })
    .passthrough();

const edgeSchema = z
    .object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        condition: z.string().optional(),
    })
    .passthrough();

// ─── Graphs ─────────────────────────────────────────────────────────────────

export const kletronListGraphs = tool(
    async (input: { search?: string }) => {
        return await withAudit("kletron_list_graphs", input, async () => {
            const graphs = await agentGraphService.listGraphs(
                input?.search ? { search: input.search } : undefined
            );
            return asJson(
                graphs.map((g) => ({
                    id: g._id?.toString(),
                    name: g.name,
                    description: g.description,
                    category: (g as any).category,
                    nodes: g.nodes?.length ?? 0,
                    edges: g.edges?.length ?? 0,
                    updatedAt: g.updatedAt,
                }))
            );
        });
    },
    {
        name: "kletron_list_graphs",
        description:
            "List all agent graphs. Optional `search` filters by name/description. Returns id, name, description, node/edge counts.",
        schema: z.object({ search: z.string().optional() }),
    }
);

export const kletronGetGraph = tool(
    async (input: { graphId: string }) => {
        return await withAudit("kletron_get_graph", input, async () => {
            const graph = await agentGraphService.getGraph(input.graphId);
            if (!graph) throw new Error(`Graph ${input.graphId} not found`);
            return asJson(graph);
        });
    },
    {
        name: "kletron_get_graph",
        description: "Fetch the full definition of one agent graph by id.",
        schema: z.object({ graphId: z.string().min(1) }),
    }
);

export const kletronCreateGraph = tool(
    async (input: {
        name: string;
        description?: string;
        nodes: any[];
        edges: any[];
        execution?: any;
    }) => {
        return await withAudit("kletron_create_graph", input, async () => {
            const id = await agentGraphService.createGraph({
                name: input.name,
                description: input.description,
                nodes: input.nodes as any,
                edges: input.edges as any,
                execution: input.execution,
            } as any);
            return asJson({ id });
        });
    },
    {
        name: "kletron_create_graph",
        description:
            "Create a new agent graph. Node `react.systemPrompt` is required; `react.toolNames` must reference tools available to this workspace.",
        schema: z.object({
            name: z.string().min(1).max(MAX_NAME_CHARS),
            description: z.string().max(MAX_DESC_CHARS).optional(),
            nodes: z.array(nodeSchema).min(1),
            edges: z.array(edgeSchema).default([]),
            execution: z.record(z.any()).optional(),
        }),
    }
);

export const kletronUpdateGraph = tool(
    async (input: {
        graphId: string;
        name?: string;
        description?: string;
        nodes?: any[];
        edges?: any[];
        execution?: any;
    }) => {
        return await withAudit("kletron_update_graph", input, async () => {
            const { graphId, ...updates } = input;
            await agentGraphService.updateGraph(graphId, updates as any);
            return asJson({ ok: true, graphId });
        });
    },
    {
        name: "kletron_update_graph",
        description:
            "Update an existing graph. Pass only the fields to change. Nodes/edges replace the whole array.",
        schema: z.object({
            graphId: z.string().min(1),
            name: z.string().min(1).max(MAX_NAME_CHARS).optional(),
            description: z.string().max(MAX_DESC_CHARS).optional(),
            nodes: z.array(nodeSchema).optional(),
            edges: z.array(edgeSchema).optional(),
            execution: z.record(z.any()).optional(),
        }),
    }
);

export const kletronDeleteGraph = tool(
    async (input: { graphId: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to delete a graph without explicit `confirm: true`."
            );
        }
        return await withAudit("kletron_delete_graph", input, async () => {
            await agentGraphService.deleteGraph(input.graphId);
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_delete_graph",
        description:
            "Permanently delete a graph. Requires `confirm: true`. Existing runs are not affected.",
        schema: z.object({
            graphId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

export const kletronCloneGraph = tool(
    async (input: { graphId: string; newName: string }) => {
        return await withAudit("kletron_clone_graph", input, async () => {
            const source = await agentGraphService.getGraph(input.graphId);
            if (!source) throw new Error(`Graph ${input.graphId} not found`);
            const id = await agentGraphService.createGraph({
                name: input.newName,
                description: source.description,
                category: (source as any).category,
                nodes: source.nodes,
                edges: source.edges,
                execution: source.execution,
                stateDefaults: source.stateDefaults,
            } as any);
            return asJson({ id });
        });
    },
    {
        name: "kletron_clone_graph",
        description: "Clone an existing graph under a new name.",
        schema: z.object({
            graphId: z.string().min(1),
            newName: z.string().min(1).max(MAX_NAME_CHARS),
        }),
    }
);

// ─── Automations ────────────────────────────────────────────────────────────

export const kletronListAutomations = tool(
    async () => {
        return await withAudit("kletron_list_automations", {}, async () => {
            const identity = requireRunIdentity();
            const list = await automationExecutor.listAutomations({
                workspaceId: identity.workspaceId,
            } as any);
            return asJson(
                list.map((a) => ({
                    id: a._id?.toString(),
                    name: a.name,
                    description: a.description,
                    triggerType: a.triggerType,
                    stages: a.stages?.length ?? 0,
                }))
            );
        });
    },
    {
        name: "kletron_list_automations",
        description: "List automations for the current workspace.",
        schema: z.object({}),
    }
);

export const kletronGetAutomation = tool(
    async (input: { automationId: string }) => {
        return await withAudit("kletron_get_automation", input, async () => {
            const identity = requireRunIdentity();
            const a = await automationExecutor.getAutomation(
                input.automationId,
                identity.workspaceId
            );
            if (!a) throw new Error(`Automation ${input.automationId} not found`);
            return asJson(a);
        });
    },
    {
        name: "kletron_get_automation",
        description: "Fetch one automation by id.",
        schema: z.object({ automationId: z.string().min(1) }),
    }
);

export const kletronCreateAutomation = tool(
    async (input: {
        name: string;
        description?: string;
        triggerType?: string;
        stages: any[];
    }) => {
        return await withAudit("kletron_create_automation", input, async () => {
            const identity = requireRunIdentity();
            const id = await automationExecutor.createAutomation({
                name: input.name,
                description: input.description,
                triggerType: (input.triggerType as any) ?? "manual",
                stages: input.stages,
                workspaceId: identity.workspaceId,
            } as any);
            return asJson({ id });
        });
    },
    {
        name: "kletron_create_automation",
        description:
            "Create a new automation in the current workspace. Each stage must include a non-empty `prompt`.",
        schema: z.object({
            name: z.string().min(1).max(MAX_NAME_CHARS),
            description: z.string().max(MAX_DESC_CHARS).optional(),
            triggerType: z.enum(["manual", "cron", "webhook"]).optional(),
            stages: z.array(z.record(z.any())).min(1),
        }),
    }
);

export const kletronUpdateAutomation = tool(
    async (input: {
        automationId: string;
        name?: string;
        description?: string;
        triggerType?: string;
        stages?: any[];
    }) => {
        return await withAudit("kletron_update_automation", input, async () => {
            const identity = requireRunIdentity();
            const { automationId, ...updates } = input;
            await automationExecutor.updateAutomation(
                automationId,
                updates as any,
                identity.workspaceId
            );
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_update_automation",
        description: "Update an automation. Only provided fields are changed.",
        schema: z.object({
            automationId: z.string().min(1),
            name: z.string().min(1).max(MAX_NAME_CHARS).optional(),
            description: z.string().max(MAX_DESC_CHARS).optional(),
            triggerType: z.enum(["manual", "cron", "webhook"]).optional(),
            stages: z.array(z.record(z.any())).optional(),
        }),
    }
);

export const kletronDeleteAutomation = tool(
    async (input: { automationId: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to delete an automation without explicit `confirm: true`."
            );
        }
        return await withAudit("kletron_delete_automation", input, async () => {
            const identity = requireRunIdentity();
            await automationExecutor.deleteAutomation(
                input.automationId,
                identity.workspaceId
            );
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_delete_automation",
        description:
            "Delete an automation by id. Requires `confirm: true`. Past runs are preserved.",
        schema: z.object({
            automationId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

export const kletronRunAutomation = tool(
    async (input: { automationId: string }) => {
        return await withAudit("kletron_run_automation", input, async () => {
            const identity = requireRunIdentity();
            const result = await automationExecutor.runAutomationAsThread(
                input.automationId,
                identity.workspaceId
            );
            return asJson(result);
        });
    },
    {
        name: "kletron_run_automation",
        description:
            "Trigger an automation now and return the run thread id. Stages execute asynchronously.",
        schema: z.object({ automationId: z.string().min(1) }),
    }
);

// ─── Skills library ─────────────────────────────────────────────────────────

const skillFrontmatterCreateSchema = z.object({
    name: z.string().min(1).max(MAX_NAME_CHARS),
    version: z
        .string()
        .regex(/^\d+\.\d+\.\d+/)
        .optional(),
    description: z.string().max(MAX_DESC_CHARS).optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    requiredTools: z.array(z.string()).optional(),
    suggestedTools: z.array(z.string()).optional(),
    extends: z.array(z.string()).optional(),
});

export const kletronListSkills = tool(
    async (input: { source?: "user" | "builtin"; search?: string }) => {
        return await withAudit("kletron_list_skills", input, async () => {
            const skills = await listSkills({
                source: input.source,
                search: input.search,
            });
            return asJson(
                skills.map((s) => ({
                    slug: s.slug,
                    name: s.name,
                    version: s.version,
                    description: s.description,
                    tags: s.tags,
                    source: s.source,
                }))
            );
        });
    },
    {
        name: "kletron_list_skills",
        description: "List skills from the library. Filter by source/search.",
        schema: z.object({
            source: z.enum(["user", "builtin"]).optional(),
            search: z.string().optional(),
        }),
    }
);

export const kletronGetSkill = tool(
    async (input: { slug: string }) => {
        return await withAudit("kletron_get_skill", input, async () => {
            const skill = await getSkillBySlug(input.slug);
            if (!skill) throw new Error(`Skill '${input.slug}' not found`);
            return asJson(skill);
        });
    },
    {
        name: "kletron_get_skill",
        description:
            "Fetch one skill by slug from the library (admin/catalog), including the full body. For agent runtime loading gated by workspace enablement, use load_skill instead.",
        schema: z.object({
            slug: z.string().regex(SLUG_REGEX, "invalid slug"),
        }),
    }
);

export const kletronCreateSkill = tool(
    async (input: {
        slug: string;
        frontmatter: z.infer<typeof skillFrontmatterCreateSchema>;
        body: string;
    }) => {
        return await withAudit("kletron_create_skill", input, async () => {
            const identity = requireRunIdentity();
            const skill = await createSkill(
                {
                    slug: input.slug,
                    frontmatter: input.frontmatter,
                    body: input.body,
                },
                identity.userId
            );
            return asJson({ slug: skill.slug });
        });
    },
    {
        name: "kletron_create_skill",
        description:
            "Create a new user skill in the library. Slug must be kebab-case and unique.",
        schema: z.object({
            slug: z.string().regex(SLUG_REGEX, "invalid slug"),
            frontmatter: skillFrontmatterCreateSchema,
            body: z.string().max(MAX_BODY_CHARS),
        }),
    }
);

export const kletronUpdateSkill = tool(
    async (input: {
        slug: string;
        frontmatter?: z.infer<typeof skillFrontmatterCreateSchema>;
        body?: string;
    }) => {
        return await withAudit("kletron_update_skill", input, async () => {
            const identity = requireRunIdentity();
            const skill = await updateSkill(
                input.slug,
                {
                    frontmatter: input.frontmatter,
                    body: input.body,
                } as any,
                identity.userId
            );
            if (!skill) throw new Error(`Skill '${input.slug}' not found`);
            return asJson({ slug: skill.slug });
        });
    },
    {
        name: "kletron_update_skill",
        description:
            "Update a user skill. Only the user who created it (or its owner) can update it.",
        schema: z.object({
            slug: z.string().regex(SLUG_REGEX, "invalid slug"),
            frontmatter: skillFrontmatterCreateSchema.optional(),
            body: z.string().max(MAX_BODY_CHARS).optional(),
        }),
    }
);

export const kletronDeleteSkill = tool(
    async (input: { slug: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to delete a skill without explicit `confirm: true`."
            );
        }
        return await withAudit("kletron_delete_skill", input, async () => {
            const identity = requireRunIdentity();
            const ok = await deleteSkill(input.slug, identity.userId);
            return asJson({ ok });
        });
    },
    {
        name: "kletron_delete_skill",
        description:
            "Delete a user skill from the library. Built-in skills cannot be deleted.",
        schema: z.object({
            slug: z.string().regex(SLUG_REGEX, "invalid slug"),
            confirm: z.literal(true),
        }),
    }
);

export const kletronListWorkspaceSkills = tool(
    async () => {
        return await withAudit(
            "kletron_list_workspace_skills",
            {},
            async () => {
                const identity = requireRunIdentity();
                const list = await listWorkspaceSkills(identity.workspaceId);
                return asJson(list);
            }
        );
    },
    {
        name: "kletron_list_workspace_skills",
        description:
            "List skill activations on the current workspace (enabled/disabled status).",
        schema: z.object({}),
    }
);

export const kletronEnableWorkspaceSkill = tool(
    async (input: { skillSlug: string }) => {
        return await withAudit(
            "kletron_enable_workspace_skill",
            input,
            async () => {
                const identity = requireRunIdentity();
                const result = await setWorkspaceSkill(
                    identity.workspaceId,
                    input.skillSlug,
                    true
                );
                return asJson(result);
            }
        );
    },
    {
        name: "kletron_enable_workspace_skill",
        description: "Enable a skill on the current workspace.",
        schema: z.object({
            skillSlug: z.string().regex(SLUG_REGEX, "invalid slug"),
        }),
    }
);

export const kletronDisableWorkspaceSkill = tool(
    async (input: { skillSlug: string }) => {
        return await withAudit(
            "kletron_disable_workspace_skill",
            input,
            async () => {
                const identity = requireRunIdentity();
                const removed = await removeWorkspaceSkill(
                    identity.workspaceId,
                    input.skillSlug
                );
                return asJson({ removed });
            }
        );
    },
    {
        name: "kletron_disable_workspace_skill",
        description: "Disable / remove a skill activation on the current workspace.",
        schema: z.object({
            skillSlug: z.string().regex(SLUG_REGEX, "invalid slug"),
        }),
    }
);

// ─── Connectors ─────────────────────────────────────────────────────────────

export const kletronListConnectors = tool(
    async () => {
        return await withAudit("kletron_list_connectors", {}, async () => {
            const identity = requireRunIdentity();
            const [integrations, mcpServers] = await Promise.all([
                listIntegrations(identity.workspaceId),
                listMcpServers(identity.workspaceId),
            ]);
            return asJson({ integrations, mcpServers });
        });
    },
    {
        name: "kletron_list_connectors",
        description:
            "List integrations and external MCP servers configured on the current workspace.",
        schema: z.object({}),
    }
);

export const kletronAddIntegration = tool(
    async (input: {
        providerId: string;
        displayName: string;
        credentials: Record<string, string>;
        scopes?: string[];
    }) => {
        return await withAudit("kletron_add_integration", input, async () => {
            const identity = requireRunIdentity();
            const summary = await createIntegration(
                identity.workspaceId,
                input as any
            );
            return asJson(summary);
        });
    },
    {
        name: "kletron_add_integration",
        description:
            "Add (or upsert) an integration credential for the current workspace. Credentials are stored encrypted.",
        schema: z.object({
            providerId: z.string().min(1),
            displayName: z.string().min(1).max(MAX_NAME_CHARS),
            credentials: z.record(z.string()),
            scopes: z.array(z.string()).optional(),
        }),
    }
);

export const kletronRemoveIntegration = tool(
    async (input: { integrationId: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to remove an integration without explicit `confirm: true`."
            );
        }
        return await withAudit(
            "kletron_remove_integration",
            input,
            async () => {
                const identity = requireRunIdentity();
                const removed = await deleteIntegration(
                    identity.workspaceId,
                    input.integrationId
                );
                return asJson({ removed });
            }
        );
    },
    {
        name: "kletron_remove_integration",
        description:
            "Remove an integration credential from the current workspace. Requires `confirm: true`.",
        schema: z.object({
            integrationId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

export const kletronAddMcpServer = tool(
    async (input: {
        name: string;
        transport: "stdio" | "sse";
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
        headers?: Record<string, string>;
    }) => {
        return await withAudit("kletron_add_mcp_server", input, async () => {
            const identity = requireRunIdentity();
            const summary = await createMcpServer(
                identity.workspaceId,
                input as any
            );
            return asJson(summary);
        });
    },
    {
        name: "kletron_add_mcp_server",
        description:
            "Register a new external MCP server for the current workspace. Use transport='stdio' with command/args, or 'sse' with url.",
        schema: z.object({
            name: z.string().min(1).max(MAX_NAME_CHARS),
            transport: z.enum(["stdio", "sse"]),
            command: z.string().optional(),
            args: z.array(z.string()).optional(),
            env: z.record(z.string()).optional(),
            url: z.string().url().optional(),
            headers: z.record(z.string()).optional(),
        }),
    }
);

export const kletronRemoveMcpServer = tool(
    async (input: { serverId: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to remove an MCP server without explicit `confirm: true`."
            );
        }
        return await withAudit(
            "kletron_remove_mcp_server",
            input,
            async () => {
                const identity = requireRunIdentity();
                const removed = await deleteMcpServer(
                    identity.workspaceId,
                    input.serverId
                );
                return asJson({ removed });
            }
        );
    },
    {
        name: "kletron_remove_mcp_server",
        description:
            "Remove an external MCP server registration. Requires `confirm: true`.",
        schema: z.object({
            serverId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

// ─── Plugins ────────────────────────────────────────────────────────────────

export const kletronListPlugins = tool(
    async () => {
        return await withAudit("kletron_list_plugins", {}, async () => {
            const identity = requireRunIdentity();
            const installed = new Set(
                await listInstalledPluginIds(identity.workspaceId)
            );
            const catalog = listPluginDefinitions().map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                installed: installed.has(p.id),
            }));
            return asJson(catalog);
        });
    },
    {
        name: "kletron_list_plugins",
        description: "List the plugin catalog with install status for this workspace.",
        schema: z.object({}),
    }
);

export const kletronInstallPlugin = tool(
    async (input: { pluginId: string }) => {
        return await withAudit("kletron_install_plugin", input, async () => {
            const identity = requireRunIdentity();
            await installPlugin(identity.workspaceId, input.pluginId);
            return asJson({ ok: true });
        });
    },
    {
        name: "kletron_install_plugin",
        description:
            "Install a plugin onto the current workspace, enabling its bundled skills.",
        schema: z.object({ pluginId: z.string().min(1) }),
    }
);

export const kletronUninstallPlugin = tool(
    async (input: { pluginId: string; confirm: boolean }) => {
        if (!input.confirm) {
            throw new Error(
                "Refusing to uninstall a plugin without explicit `confirm: true`."
            );
        }
        return await withAudit(
            "kletron_uninstall_plugin",
            input,
            async () => {
                const identity = requireRunIdentity();
                const ok = await removePlugin(
                    identity.workspaceId,
                    input.pluginId
                );
                return asJson({ ok });
            }
        );
    },
    {
        name: "kletron_uninstall_plugin",
        description:
            "Uninstall a plugin from the current workspace. Skills used by other installed plugins remain enabled.",
        schema: z.object({
            pluginId: z.string().min(1),
            confirm: z.literal(true),
        }),
    }
);

// ─── Pack export ────────────────────────────────────────────────────────────

export const kletronAdminTools = [
    kletronListGraphs,
    kletronGetGraph,
    kletronCreateGraph,
    kletronUpdateGraph,
    kletronCloneGraph,
    kletronDeleteGraph,
    kletronListAutomations,
    kletronGetAutomation,
    kletronCreateAutomation,
    kletronUpdateAutomation,
    kletronDeleteAutomation,
    kletronRunAutomation,
    kletronListSkills,
    kletronGetSkill,
    kletronCreateSkill,
    kletronUpdateSkill,
    kletronDeleteSkill,
    kletronListWorkspaceSkills,
    kletronEnableWorkspaceSkill,
    kletronDisableWorkspaceSkill,
    kletronListConnectors,
    kletronAddIntegration,
    kletronRemoveIntegration,
    kletronAddMcpServer,
    kletronRemoveMcpServer,
    kletronListPlugins,
    kletronInstallPlugin,
    kletronUninstallPlugin,
    ...kletronExtendedAdminTools,
];

// Re-export from a tiny module so `workspaceCapabilityResolver` can import
// names without creating a circular dependency through this file.
export { KLETRON_ADMIN_TOOL_NAMES } from "./kletronAdminToolNames";
