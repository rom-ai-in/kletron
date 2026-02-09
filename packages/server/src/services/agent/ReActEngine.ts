
import path from "node:path";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { streamReactAgentMessages } from "@numezis/agent-core/reactAgentRunner";
import { allMcpTools } from "@numezis/agent-core/tools/mcpTools";
import { ConversationService } from "./ConversationService";
import { SafeEditGate } from "./SafeEditGate";
import { AgentEvent } from "@numezis/shared/types";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { McpClient } from "@numezis/mcp-client/client";
import { getConfig } from "@numezis/server/config";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { getWorkspaceContext } from "@numezis/server/workspace/workspaceContext";
import { getWorkspaceByIdUnsafe } from "@numezis/server/services/workspaceService";
import { buildAuditContextPrompt } from "@numezis/server/services/auditContextService";
import { agentGraphService } from "@numezis/server/services/agentGraphService";

const safeEditGate = SafeEditGate.getInstance();

export class ReActEngine {
    private static instance: ReActEngine;

    private constructor() { }

    static getInstance(): ReActEngine {
        if (!ReActEngine.instance) {
            ReActEngine.instance = new ReActEngine();
        }
        return ReActEngine.instance;
    }

    // Wrap sensitive tools + inject task queue updates
    private getSafeTools(
        conversationId: string,
        conversationService: ConversationService,
        toolAllowlist?: string[]
    ) {
        const safeWriteFile = tool(
            async (input: { filePath: string; content: string; repoPath?: string; overwrite?: boolean }) => {
                // Propose the edit instead of executing
                const workspaceId = getWorkspaceContext()?.workspaceId;
                const edit = safeEditGate.proposeEdit(
                    conversationId,
                    "write_file",
                    input,
                    `Write to ${input.filePath}`,
                    workspaceId
                );

                return `Edit proposed (ID: ${edit.id}) for ${input.filePath}. The edit has been queued for user review. Continue with your task - the user will review all proposed edits together at the end.`;
            },
            {
                name: "write_file",
                description: "Propose writing a file. The user must approve this action.",
                schema: z.object({
                    filePath: z.string(),
                    content: z.string(),
                    repoPath: z.string().optional(),
                    overwrite: z.boolean().optional(),
                    createDirs: z.boolean().optional()
                })
            }
        );
        const safeStrReplace = tool(
            async (input: { repoPath?: string; path?: string; filePath?: string; action?: string; operation?: string; startLine?: number; endLine?: number; maxBytes?: number }) => {
                const workspaceId = getWorkspaceContext()?.workspaceId;
                const edit = safeEditGate.proposeEdit(
                    conversationId,
                    "str_replace_editor",
                    input,
                    `Edit (str_replace) ${input.filePath || input.path}`,
                    workspaceId
                );
                return `Edit proposed (ID: ${edit.id}) for ${input.filePath || input.path}. The edit has been queued for user review. Continue with your task.`;
            },
            {
                name: "str_replace_editor",
                description: "Propose editing a file via string replacement. The user must approve this action.",
                schema: z.object({
                    repoPath: z.string().optional(),
                    path: z.string().optional(),
                    filePath: z.string().optional(),
                    action: z.string().optional(),
                    operation: z.string().optional(),
                    startLine: z.number().int().positive().optional(),
                    endLine: z.number().int().positive().optional(),
                    maxBytes: z.number().int().positive().optional(),
                })
            }
        );

        const normalizeTaskStatus = (value: string) => {
            if (value === "todo" || value === "done" || value === "in_progress") return value;
            return "todo";
        };

        const writeTodosTool = tool(
            async (input: { tasks: Array<{ id?: string; title?: string; status?: string }>; currentTaskId?: string }) => {
                const conversation = await conversationService.get(conversationId);
                if (!conversation) throw new Error("Conversation not found");
                const tasks = Array.isArray(input.tasks) ? input.tasks : [];
                const normalized = tasks.map((task, index) => {
                    const id = typeof task.id === "string" && task.id ? task.id : `task-${index + 1}`;
                    const title = typeof task.title === "string" ? task.title : `Task ${index + 1}`;
                    const status = normalizeTaskStatus(typeof task.status === "string" ? task.status : "todo");
                    return { id, title, status };
                });
                conversation.taskQueue = normalized;
                conversation.currentTaskId =
                    typeof input.currentTaskId === "string" && input.currentTaskId
                        ? input.currentTaskId
                        : normalized.find((t) => t.status !== "done")?.id ?? "";
                await conversationService.save(conversation);
                return JSON.stringify(
                    {
                        updated: true,
                        currentTaskId: conversation.currentTaskId ?? "",
                        taskCount: Array.isArray(conversation.taskQueue) ? conversation.taskQueue.length : 0,
                    },
                    null,
                    2
                );
            },
            {
                name: "write_todos",
                description: "Update the task queue and current task pointer for this conversation.",
                schema: z.object({
                    tasks: z
                        .array(
                            z.object({
                                id: z.string().optional(),
                                title: z.string().optional(),
                                status: z.enum(["todo", "in_progress", "done"]).optional(),
                            })
                        )
                        .default([]),
                    currentTaskId: z.string().optional(),
                }),
            }
        );

        const safeToolNames = ["write_file", "str_replace_editor"];
        const allowlist = Array.isArray(toolAllowlist)
            ? new Set(toolAllowlist.concat(["write_todos"]))
            : null;
        const baseTools = allMcpTools.filter(t => !safeToolNames.includes(t.name));
        const filtered = allowlist
            ? baseTools.filter((t) => allowlist.has(t.name))
            : baseTools;
        const tools = (filtered as any[]).concat([
            ...(allowlist ? (allowlist.has("write_file") ? [safeWriteFile] : []) : [safeWriteFile]),
            ...(allowlist ? (allowlist.has("str_replace_editor") ? [safeStrReplace] : []) : [safeStrReplace]),
            ...(allowlist ? (allowlist.has("write_todos") ? [writeTodosTool] : []) : [writeTodosTool]),
        ]);
        return tools;
    }

    async chat(
        conversationId: string,
        userMessage: string,
        onUpdate?: (event: AgentEvent) => void,
        llmSelection?: { provider: LlmProviderType; model?: string },
        graphId?: string
    ): Promise<string> {
        const conversationService = new ConversationService(getWorkspaceContext()?.workspaceId);
        // 1. Load conversation history
        const conversation = await conversationService.get(conversationId);
        if (!conversation) throw new Error("Conversation not found");

        const workspaceContext = getWorkspaceContext();
        const workspaceInfo = workspaceContext?.workspace;
        // 2. Prepare messages for the agent
        // We map stored AgentEvents back to BaseMessages to maintain context
        const previousMessages: BaseMessage[] = conversation.messages.map(m => {
            if (m.kind === "user") return new HumanMessage(m.content);
            if (m.kind === "system") return new SystemMessage(m.content);
            if (m.kind === "assistant") {
                // If it had tool calls, we should reconstruct that structure if possible
                // For simplicity in this sync, we'll treat text history as text
                return new HumanMessage(m.content); // Fallback
            }
            if (m.kind === "tool") {
                // Return generic human message for tool context as fallback
                return new HumanMessage(`Tool Output (${m.toolName}): ${m.content}`);
            }
            return new HumanMessage(m.content);
        });

        // 3. Append new user message to history
        const newUserEvent: AgentEvent = {
            id: `ev-${Date.now()}`,
            phaseId: "chat",
            kind: "user",
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        await conversationService.appendEvent(conversationId, newUserEvent);
        if (onUpdate) onUpdate(newUserEvent);

        // 4. Resolve graph config (default to Simple ReAct agent graph)
        let graphSystemPrompt = "";
        let graphToolNames: string[] | undefined = undefined;
        let resolvedGraphId: string | undefined = undefined;
        try {
            if (graphId) {
                const graph = await agentGraphService.getGraph(graphId);
                if (graph?.nodes?.length) {
                    graphSystemPrompt = graph.nodes[0]?.react?.systemPrompt ?? "";
                    graphToolNames = graph.nodes[0]?.react?.toolNames ?? [];
                    resolvedGraphId = graphId;
                }
            }
            if (!graphSystemPrompt) {
                const graphs = await agentGraphService.listGraphs({ search: "Simple ReAct" });
                const simpleGraph = graphs.find((g) => g.name === "Simple ReAct (agent graph)") ?? graphs[0];
                if (simpleGraph?.nodes?.length) {
                    graphSystemPrompt = simpleGraph.nodes[0]?.react?.systemPrompt ?? "";
                    graphToolNames = simpleGraph.nodes[0]?.react?.toolNames ?? [];
                    resolvedGraphId = simpleGraph._id?.toString?.();
                }
            }
        } catch (err) {
            console.warn("[ReActEngine] Failed to load graph config:", err);
        }

        if (resolvedGraphId && conversation.graphId !== resolvedGraphId) {
            const refreshed = await conversationService.get(conversationId);
            if (refreshed) {
                refreshed.graphId = resolvedGraphId;
                await conversationService.save(refreshed);
            }
        }

        const tools = this.getSafeTools(conversationId, conversationService, graphToolNames);
        const workspaceSummary = workspaceInfo
            ? [
                `Workspace name: ${workspaceInfo.name}`,
                `Workspace root: ${workspaceInfo.rootPath}`,
                workspaceInfo.repoUrl ? `Repo URL: ${workspaceInfo.repoUrl}` : undefined,
                workspaceInfo.provider ? `Repo provider: ${workspaceInfo.provider}` : undefined,
                workspaceInfo.defaultBranch ? `Default branch: ${workspaceInfo.defaultBranch}` : undefined,
            ].filter(Boolean).join("\n")
            : "Workspace details unavailable.";

        let systemPrompt = `You are an expert developer assistant embedded in Numezis Code.
You can analyze code, browse files, and propose edits.

WORKSPACE CONTEXT:
${workspaceSummary}

WORKFLOW:
- When you use 'write_file' or 'str_replace_editor', the edit is queued for user review.
- You should CONTINUE working after proposing edits - do NOT stop to wait for approval.
- The user will review all proposed edits together at the end (like Cursor).
- Complete your entire task, proposing all necessary file changes.

TOOLS:
- You have access to the MCP tool suite (e.g., list_files, read_file, read_file_range, search_code, semantic_code_search, execute_bash, write_file, str_replace_editor, and more).
- Prefer precise file reads and scoped searches before making changes.

IMPORTANT:
- Do NOT ask about approving individual edits - just keep working.
- The execute_bash tool only supports: find, grep, rg, ls, cat (safe emulation). Complex shell commands won't work.
- For file verification, use read_file or list_files instead of bash commands.
- Do NOT reveal chain-of-thought. Provide concise, user-facing reasoning summaries only when necessary.`;

        if (graphSystemPrompt) {
            systemPrompt = `${systemPrompt}\n\nGRAPH INSTRUCTIONS:\n${graphSystemPrompt}`;
        }

        const taskQueue = Array.isArray(conversation.taskQueue) ? conversation.taskQueue : [];
        const currentTaskId = typeof conversation.currentTaskId === "string" ? conversation.currentTaskId : "";
        const taskContextBlock = [
            "## PLAN & TASK QUEUE",
            `Current task id: ${currentTaskId || "(none)"}`,
            `Task queue: ${JSON.stringify(taskQueue, null, 2)}`,
            "Use write_todos to create or update the task queue when the mission requires multiple steps.",
        ].join("\n");
        systemPrompt = `${systemPrompt}\n\n${taskContextBlock}`;

        // Inject Audit Context if enabled
        try {
            const auditContextPrompt = await buildAuditContextPrompt(workspaceContext?.workspaceId);
            if (auditContextPrompt) {
                systemPrompt = `${systemPrompt}\n\n${auditContextPrompt}`;
            }
        } catch (err) {
            console.warn("[ReActEngine] Failed to load audit context:", err);
        }

        let finalResponse = "";
        const metricsTotals = { inputTokens: 0, outputTokens: 0, totalTokens: 0, callCount: 0 };

        try {
            // Helper to process and save a message
            const processMessage = async (msg: BaseMessage) => {
                const type = msg.getType();
                const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

                // Skip user/system messages we already know
                if (type === "human" && content === userMessage) return;
                if (type === "system") return;

                if (type === "ai") {
                    const aiMsg = msg as any;
                    const toolCalls = aiMsg.tool_calls || [];

                    // 1. Handle assistant content (skip tool-call reasoning to avoid exposing chain-of-thought)
                    if (content && content.trim() && toolCalls.length === 0) {
                        const event: AgentEvent = {
                            id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            phaseId: "chat",
                            kind: "assistant",
                            role: "assistant",
                            content: content,
                            timestamp: new Date().toISOString()
                        };
                        await conversationService.appendEvent(conversationId, event);
                        if (onUpdate) onUpdate(event);
                    }

                    // 2. Handle Tool Calls
                    for (const tc of toolCalls) {
                        const event: AgentEvent = {
                            id: `ev-${Date.now()}-${tc.id}`,
                            phaseId: "chat",
                            kind: "assistant",
                            role: "assistant",
                            content: "",
                            toolName: tc.name,
                            toolArgs: JSON.stringify(tc.args),
                            toolCallId: tc.id,
                            timestamp: new Date().toISOString()
                        };
                        await conversationService.appendEvent(conversationId, event);
                        if (onUpdate) onUpdate(event);
                    }
                } else if (type === "tool") {
                    const toolMsg = msg as any;
                    const event: AgentEvent = {
                        id: `ev-${Date.now()}-${toolMsg.tool_call_id || Math.random()}`,
                        phaseId: "chat",
                        kind: "tool",
                        role: "tool",
                        content: content,
                        toolName: toolMsg.name || "unknown",
                        toolOutput: content,
                        toolCallId: toolMsg.tool_call_id,
                        timestamp: new Date().toISOString()
                    };
                    await conversationService.appendEvent(conversationId, event);
                    if (onUpdate) onUpdate(event);
                }
            };

            await streamReactAgentMessages({
                name: "AgentDeveloper",
                systemPrompt,
                userPrompt: userMessage,
                tools,
                llmSelection,
                extraMessages: previousMessages.filter(m => m.getType() !== "system"),
                onMessage: async (msg: BaseMessage) => {
                    await processMessage(msg);
                },
                onTokenUsage: async (usage, modelName) => {
                    metricsTotals.inputTokens += usage.inputTokens ?? 0;
                    metricsTotals.outputTokens += usage.outputTokens ?? 0;
                    metricsTotals.totalTokens += usage.totalTokens ?? 0;
                    metricsTotals.callCount += 1;

                    if (onUpdate) {
                        onUpdate({
                            id: `metrics-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            phaseId: "metrics",
                            kind: "system",
                            role: "system",
                            content: "",
                            metadata: {
                                type: "token_usage",
                                tokenUsage: {
                                    totalInputTokens: metricsTotals.inputTokens,
                                    totalOutputTokens: metricsTotals.outputTokens,
                                    totalTokens: metricsTotals.totalTokens,
                                    callCount: metricsTotals.callCount,
                                },
                                model: modelName,
                            },
                            timestamp: new Date().toISOString(),
                        });
                    }
                },
            });

            finalResponse = "Agent execution completed.";

        } catch (error: any) {
            console.error("Agent error:", error);
            const errorEvent: AgentEvent = {
                id: `ev-${Date.now()}-err`,
                phaseId: "chat",
                kind: "assistant",
                role: "assistant",
                content: "Sorry, I encountered an error: " + error.message,
                timestamp: new Date().toISOString()
            };
            await conversationService.appendEvent(conversationId, errorEvent);
            if (onUpdate) onUpdate(errorEvent);
            finalResponse = "Error: " + error.message;
        }

        return finalResponse;
    }

    async executeApprovedEdit(editId: string) {
        const edit = safeEditGate.approveEdit(editId);
        if (!edit) throw new Error("Edit not found or not in pending state");

        const workspaceId = edit.workspaceId ?? getWorkspaceContext()?.workspaceId ?? null;
        const workspace = workspaceId
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : null;
        const workingFolder = workspace?.rootPath ?? (await getConfig()).workingFolder;

        // Helper to resolve relative paths against the working folder
        const resolveFilePath = (filePath: string): string => {
            if (!filePath) return filePath;
            if (path.isAbsolute(filePath)) return filePath;
            return path.resolve(workingFolder, filePath);
        };

        if (edit.toolName === "write_file") {
            const client = await McpClient.getInstance();
            // Resolve filePath and force overwrite true since user approved
            const args = {
                ...edit.args,
                filePath: resolveFilePath(edit.args.filePath as string),
                overwrite: true
            };
            await client.callTool("write_file", args);
            return true;
        }
        if (edit.toolName === "str_replace_editor") {
            const client = await McpClient.getInstance();
            // Resolve path/filePath for str_replace_editor
            const args = {
                ...edit.args,
                filePath: edit.args.filePath ? resolveFilePath(edit.args.filePath as string) : undefined,
                path: edit.args.path ? resolveFilePath(edit.args.path as string) : undefined,
            };
            await client.callTool("str_replace_editor", args);
            return true;
        }
        return false;
    }
}
