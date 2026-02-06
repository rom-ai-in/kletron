import { BaseMessage } from "@langchain/core/messages";
import { tool as createTool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { AgentEvent, AgentEventKind, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent, AgentWorkflowAbortReason } from "@numezis/shared/types";
import { streamReactAgentMessages, AgentWorkflowAbortError } from "@numezis/agent-core/reactAgentRunner";
import { allMcpTools } from "@numezis/agent-core/tools/mcpTools";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphNode } from "./agentGraphTypes";
import type { LlmProviderType } from "@numezis/shared/schemas/llmConfig.schema";
import { nodeOutputSchemaRegistry } from "@numezis/shared/nodeOutputSchemas";
import { parseJsonOutput, renderUserPrompt } from "./agentGraphUtils";
import { evaluateCondition } from "./agentGraphConditions";
import { buildInitialState, getEntryNodeIds, getGraphNodeOrder, resolveExecutionMode } from "./agentGraphRuntime";
import { setNestedValue } from "./agentGraphState";
import { skillRegistry } from "@numezis/agent-core/skills/registry";
import { tokenUsageService } from "./tokenUsageService";
import { ObjectId } from "mongodb";
import { getAuditContextConfig } from "@numezis/server/services/auditContextService";
import { formatAuditContextPrompt, type AuditContext } from "@numezis/shared/documentContext";
import { agentMemoryService } from "./agentMemoryService";
import { SafeEditGate } from "./agent/SafeEditGate";

// --- Context Management Imports ---
import { getContextGraphStore } from "@numezis/server/context/graph/ContextGraphStore";
import { ContextRanker } from "@numezis/server/context/graph/ContextRanker";
import { getEditorStateManager } from "@numezis/server/context/graph/EditorStateManager";
import { ContextScanner } from "@numezis/server/context/graph/ContextScanner";
import { getWorkspaceByIdUnsafe, listAllWorkspaces } from "./workspaceService";
import { runWithWorkspaceContext } from "@numezis/server/workspace/workspaceContext";


const cloneValue = <T>(value: T): T => {
    if (
        typeof (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone })?.structuredClone ===
        "function"
    ) {
        return (globalThis as typeof globalThis & { structuredClone: typeof structuredClone }).structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

const safeEditGate = SafeEditGate.getInstance();

const TOOL_RESULT_EVICT_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10))
    ? Number.parseInt(process.env.TOOL_RESULT_EVICT_CHARS ?? "", 10)
    : 80000;
const TOOL_RESULT_PREVIEW_CHARS = Number.isFinite(Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10))
    ? Number.parseInt(process.env.TOOL_RESULT_PREVIEW_CHARS ?? "", 10)
    : 2000;

const stringifyToolResult = (raw: unknown): string => {
    if (typeof raw === "string") return raw;
    if (raw === undefined || raw === null) return "";
    try {
        return JSON.stringify(raw, null, 2);
    } catch {
        return String(raw);
    }
};

const normalizeMemoryPath = (rawPath: string): string | null => {
    const trimmed = rawPath.trim();
    if (!trimmed) return null;
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (withSlash === "/memories") return "/memories/";
    if (!withSlash.startsWith("/memories/")) return null;
    if (withSlash.includes("..")) return null;
    return withSlash;
};

const extractMemoryPath = (toolName: string, input: Record<string, unknown>): string | null => {
    if (!input || typeof input !== "object") return null;
    if (toolName === "list_files" && typeof input.path === "string") {
        return normalizeMemoryPath(input.path);
    }
    if ((toolName === "read_file" || toolName === "read_file_range" || toolName === "write_file") && typeof input.filePath === "string") {
        return normalizeMemoryPath(input.filePath);
    }
    return null;
};

const writeEvictedToolResult = async (opts: {
    rootDir: string;
    runId: string;
    nodeId: string;
    toolName: string;
    content: string;
}) => {
    const relativeDir = path.join(".numezis", "agent-cache", opts.runId);
    const dir = path.join(opts.rootDir, relativeDir);
    await mkdir(dir, { recursive: true });
    const safeTool = opts.toolName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${safeTool}-${opts.nodeId}-${randomUUID()}.txt`;
    const relativePath = path.join(relativeDir, fileName);
    const absPath = path.join(opts.rootDir, relativePath);
    await writeFile(absPath, opts.content, "utf8");
    return relativePath;
};

const maybeEvictToolResult = async (opts: {
    rootDir: string;
    runId: string;
    nodeId: string;
    toolName: string;
    rawResult: unknown;
}) => {
    const content = stringifyToolResult(opts.rawResult);
    if (!content || content.length <= TOOL_RESULT_EVICT_CHARS) {
        return content;
    }
    const relativePath = await writeEvictedToolResult({
        rootDir: opts.rootDir,
        runId: opts.runId,
        nodeId: opts.nodeId,
        toolName: opts.toolName,
        content,
    });
    const preview = content.slice(0, TOOL_RESULT_PREVIEW_CHARS);
    return [
        `Tool result exceeded ${TOOL_RESULT_EVICT_CHARS} chars and was evicted.`,
        `Saved to: ${relativePath}`,
        `Preview (first ${TOOL_RESULT_PREVIEW_CHARS} chars):`,
        preview,
    ].join("\n");
};

const describeMessageContent = (message: BaseMessage) => {
    if (typeof message.content === "string") {
        return message.content;
    }
    if ((message as any).text && typeof (message as any).text === "string" && (message as any).text.trim()) {
        return (message as any).text;
    }
    if (message.content) {
        try {
            return JSON.stringify(message.content, null, 2);
        } catch {
            return String(message.content);
        }
    }
    return "";
};

const guessToolName = (message: BaseMessage) => {
    const extra = message as BaseMessage & {
        additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[] };
        tool_calls?: Record<string, unknown>[];
        name?: string;
    };
    const functionCall = extra.additional_kwargs?.function_call as any;
    if (functionCall?.name) {
        return String(functionCall.name);
    }
    const toolCalls = (extra as any).tool_calls ?? extra.additional_kwargs?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length) {
        const first = toolCalls[0] as { name?: unknown; function?: { name?: unknown } };
        if (typeof first?.name === "string") return first.name;
        if (typeof first?.function?.name === "string") return first.function.name;
        return undefined;
    }
    if (message.type === "tool" && typeof extra.name === "string" && extra.name) {
        return extra.name;
    }
    return undefined;
};

const extractToolArgs = (message: BaseMessage): string | undefined => {
    const extra = message as BaseMessage & {
        additional_kwargs?: {
            function_call?: { arguments?: unknown };
            tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
        };
        tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
    };
    const functionCall = extra.additional_kwargs?.function_call;
    if (functionCall?.arguments !== undefined) {
        return typeof functionCall.arguments === "string"
            ? functionCall.arguments
            : JSON.stringify(functionCall.arguments);
    }
    const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
    const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
    if (first?.args !== undefined) {
        return typeof first.args === "string" ? first.args : JSON.stringify(first.args);
    }
    if (first?.arguments !== undefined) {
        return typeof first.arguments === "string" ? first.arguments : JSON.stringify(first.arguments);
    }
    if (first?.function?.arguments !== undefined) {
        return typeof first.function.arguments === "string"
            ? first.function.arguments
            : JSON.stringify(first.function.arguments);
    }
    return undefined;
};

const extractToolCallId = (message: BaseMessage): string | undefined => {
    const direct = (message as BaseMessage & { tool_call_id?: string }).tool_call_id;
    if (direct) return String(direct);
    const extra = message as BaseMessage & {
        additional_kwargs?: { tool_call_id?: string; tool_calls?: Array<{ id?: string }> };
        tool_calls?: Array<{ id?: string }>;
    };
    if (extra.additional_kwargs?.tool_call_id) {
        return String(extra.additional_kwargs.tool_call_id);
    }
    const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
    const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
    if (first?.id) return String(first.id);
    return undefined;
};

function createAgentEvent(
    message: BaseMessage,
    phaseId: string,
    phaseLabel: string,
    eventId: string
): AgentEvent {
    const extra = message as BaseMessage & {
        additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[] };
        tool_calls?: Record<string, unknown>[];
    };
    const role = typeof (message as any).role === "string" ? (message as any).role : message.type ?? "assistant";
    const normalizedRole = role.toLowerCase();
    const messageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
    const hasToolCall =
        messageType === "tool" ||
        Boolean(extra.additional_kwargs?.function_call) ||
        Boolean(extra.additional_kwargs?.tool_calls?.length) ||
        Boolean(extra.tool_calls?.length);
    const isSystemRole = normalizedRole === "system" || messageType === "system";
    const isUserRole =
        normalizedRole === "user" || normalizedRole === "human" || messageType === "user" || messageType === "human";
    const kind: AgentEventKind = hasToolCall ? "tool" : isSystemRole ? "system" : isUserRole ? "user" : "assistant";
    const toolArgs = extractToolArgs(message);
    const messageContent = describeMessageContent(message);
    const isToolResult = messageType === "tool";
    let content = messageContent;
    let toolNote: string | undefined;
    if (hasToolCall && !isToolResult) {
        toolNote = messageContent;
        content = "";
    } else if (!isToolResult) {
        toolNote = undefined;
    }

    return {
        id: eventId,
        phaseId,
        phaseLabel,
        kind,
        role,
        name: guessToolName(message),
        toolCallId: extractToolCallId(message),
        content,
        toolNote,
        toolArgs,
        timestamp: new Date().toISOString(),
    };
}

function createSessionTimeline(node: AgentGraphNode): TimelineEvent[] {
    return [
        {
            id: node.id,
            label: node.label,
            status: "running",
            summary: "Node execution (running)",
            details: "ReAct node execution stream",
            systemPrompt: node.react.systemPrompt,
            thoughtLog: [],
            startedAt: new Date().toISOString(),
        },
    ];
}

function createPlaceholderOutputs(opts: { mission: string; report: string; meta?: Record<string, unknown> }) {
    return {
        context: { mission: opts.mission ?? "", languages: [], frameworks: [], hotspots: [] },
        target_files: [],
        raw_claims: [],
        verified_findings: [],
        findings: [],
        tasks: [],
        report: opts.report ?? "",
        meta: opts.meta ?? {},
    } satisfies AgentWorkflowResult["outputs"];
}

function selectToolsByName(toolNames: string[], extraTools: any[] = []) {
    const allow = new Set(toolNames ?? []);
    const merged = [...allMcpTools, ...extraTools];
    return merged.filter((tool: any) => allow.has(String(tool?.name ?? "")));
}

async function maybeExecuteJsonActionTool(opts: {
    schemaId: string;
    parsed: unknown;
    allowedToolNames: string[];
    phaseId: string;
    phaseLabel: string;
    makeEventId: () => string;
    pushEvent: (event: AgentEvent) => void;
    invokeToolByName: (name: string, args: Record<string, unknown>) => Promise<string>;
    ensureActive?: () => Promise<void>;
}) {
    // Only support this compatibility shim for generic JSON nodes.
    if (opts.schemaId !== "generic_json") return opts.parsed;
    if (!opts.parsed || typeof opts.parsed !== "object") return opts.parsed;
    const record = opts.parsed as Record<string, unknown>;
    const action = typeof record.action === "string" ? record.action : undefined;
    const args = record.arguments && typeof record.arguments === "object" ? (record.arguments as Record<string, unknown>) : undefined;
    if (!action || !args) return opts.parsed;

    // Only execute actions that are explicitly allowed on the node.
    if (!opts.allowedToolNames.includes(action)) return opts.parsed;

    // For safety, only allow write_file via this shim (LM Studio often "prints" tool calls).
    if (action !== "write_file") return opts.parsed;
    if (typeof args.filePath !== "string" || typeof args.content !== "string") return opts.parsed;

    if (opts.ensureActive) {
        await opts.ensureActive();
    }

    const toolResult = await opts.invokeToolByName(action, args);

    opts.pushEvent({
        id: opts.makeEventId(),
        phaseId: opts.phaseId,
        phaseLabel: opts.phaseLabel,
        kind: "tool",
        role: "tool",
        name: action,
        toolArgs: JSON.stringify(args),
        content: toolResult,
        timestamp: new Date().toISOString(),
    });

    return {
        action,
        arguments: args,
        toolResult,
    };
}

// Helper to ensure graph is ready
async function ensureContextGraphReady(workspaceId: string, rootPath: string) {
    const store = getContextGraphStore(workspaceId, rootPath);
    if (store.getAllNodes().length > 0) return store;

    console.log("[AgentGraph] Context graph is empty, attempting load...");
    await store.load();

    if (store.getAllNodes().length === 0) {
        console.log("[AgentGraph] Context graph still empty, triggering fresh workspace scan...");

        const scanner = new ContextScanner();
        await scanner.scanWorkspace(rootPath, store);
        await store.save();
        console.log(`[AgentGraph] Scan complete. Graph now has ${store.getAllNodes().length} nodes.`);
    }
    return store;
}

export class AgentGraphExecutor {
    async executeRun(runId: string): Promise<void> {
        await this.executeRunStreaming(runId);
    }

    async executeRunStreaming(
        runId: string,
        opts?: {
            onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
            llmSelectionOverride?: { provider: LlmProviderType; model?: string };
            shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;
        }
    ): Promise<AgentWorkflowResult> {
        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        const workspaceId = run.workspaceId?.toString() ?? null;
        const workspace = workspaceId
            ? await getWorkspaceByIdUnsafe(workspaceId)
            : (await listAllWorkspaces())[0];
        if (!workspace || !workspace._id) {
            throw new Error("Workspace not found for run execution.");
        }

        return await runWithWorkspaceContext(workspace, async () => {
        // Ensure context is ready before we start
        const contextGraphStore = await ensureContextGraphReady(
            workspace._id!.toString(),
            workspace.rootPath
        );

        const shouldAbort = opts?.shouldAbort;
        const abortController = new AbortController();
        let abortReason: AgentWorkflowAbortReason | null = null;
        let lastAbortCheck = 0;
        const ABORT_CHECK_INTERVAL_MS = 500;

        const checkAbortReason = async () => {
            if (abortReason) return abortReason;
            if (!shouldAbort) return null;
            const now = Date.now();
            if (now - lastAbortCheck < ABORT_CHECK_INTERVAL_MS) return null;
            lastAbortCheck = now;
            const reason = await shouldAbort();
            if (reason) {
                abortReason = reason;
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
            }
            return abortReason;
        };

        const ensureNotAborted = async () => {
            const reason = await checkAbortReason();
            if (reason) {
                throw new AgentWorkflowAbortError(reason);
            }
        };

        let auditContextConfig: { enabled: boolean; context: AuditContext | null } | null = null;
        try {
            auditContextConfig = await getAuditContextConfig(workspace._id!.toString());
        } catch (err) {
            console.warn("[AgentGraph] Failed to load audit context config:", err);
        }
        const contextInjectionEnabled = auditContextConfig?.enabled !== false;
        const auditContext = contextInjectionEnabled ? auditContextConfig?.context ?? null : null;

        const graph = await agentGraphService.getGraph(run.graphId.toString());
        if (!graph) throw new Error(`Graph ${run.graphId.toString()} not found`);

        const executionMode = resolveExecutionMode(graph);
        const timelineNodeIds = (run.nodeOrder?.length ? run.nodeOrder : getGraphNodeOrder(graph)).slice();
        if (!run.nodeOrder?.length) {
            await agentGraphRunService.setNodeOrder(runId, timelineNodeIds);
        }

        const state = cloneValue(run.state ?? { nodes: {} });
        if (!state.nodes) state.nodes = {};
        const workspaceObjectId =
            workspace._id && ObjectId.isValid(workspace._id.toString()) ? new ObjectId(workspace._id.toString()) : undefined;
        const rootDir = workspace.rootPath;

        const persistState = async () => {
            await agentGraphRunService.updateRunState(runId, cloneValue(state));
        };

        const normalizeTaskStatus = (value: string) => {
            if (value === "todo" || value === "done" || value === "in_progress") return value;
            return "todo";
        };

        const applyTodosUpdate = (tasks: Array<Record<string, unknown>>, currentTaskId?: string) => {
            const normalized = tasks.map((task, index) => {
                const id = typeof task.id === "string" && task.id ? task.id : `task-${index + 1}`;
                const title = typeof task.title === "string" ? task.title : `Task ${index + 1}`;
                const status = normalizeTaskStatus(typeof task.status === "string" ? task.status : "todo");
                return { id, title, status };
            });
            (state as any).taskQueue = normalized;
            const nextId =
                typeof currentTaskId === "string" && currentTaskId
                    ? currentTaskId
                    : normalized.find((t) => t.status !== "done")?.id ?? "";
            (state as any).currentTaskId = nextId;
        };

        const stableStringify = (value: unknown): string => {
            if (value === null || typeof value !== "object") return JSON.stringify(value);
            if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
            const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
            return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
        };

        const buildApprovalKey = (toolName: string, args: Record<string, unknown>) => {
            return `${toolName}:${stableStringify(args)}`;
        };

        const findApprovalByKey = (items: Array<Record<string, unknown>>, key: string) => {
            return items.find((item) => {
                const existingKey =
                    typeof item.key === "string"
                        ? String(item.key)
                        : buildApprovalKey(String(item.toolName ?? ""), (item.args as Record<string, unknown>) ?? {});
                return existingKey === key;
            });
        };

        const ensurePlannerOutput = (value: unknown, missionText: string) => {
            if (!value || typeof value !== "object") return value;
            const output = value as Record<string, any>;
            const rawTasks = Array.isArray(output.taskQueue) ? output.taskQueue : [];
            const normalized = rawTasks.map((task: any, index: number) => {
                const id = typeof task?.id === "string" && task.id ? task.id : `task-${index + 1}`;
                const title = typeof task?.title === "string" && task.title ? task.title : `Task ${index + 1}`;
                const status = normalizeTaskStatus(typeof task?.status === "string" ? task.status : "todo");
                return { id, title, status };
            });
            const minTasks = 3;
            if (normalized.length < minTasks) {
                const safeMission = missionText?.trim() || "the request";
                const fallbackTasks = [
                    { id: `task-${normalized.length + 1}`, title: `Locate relevant files and entry points for ${safeMission}.`, status: "todo" },
                    { id: `task-${normalized.length + 2}`, title: "Inspect implementation details and gather evidence.", status: "todo" },
                    { id: `task-${normalized.length + 3}`, title: "Summarize findings and propose improvements.", status: "todo" },
                ];
                const needed = Math.max(0, minTasks - normalized.length);
                normalized.push(...fallbackTasks.slice(0, needed));
            }
            output.taskQueue = normalized;
            if (!output.currentTaskId || typeof output.currentTaskId !== "string") {
                output.currentTaskId = normalized.find((t) => t.status !== "done")?.id ?? "";
            }
            const planIsEmpty =
                !output.plan ||
                (typeof output.plan === "object" &&
                    !Array.isArray(output.plan) &&
                    Object.keys(output.plan as Record<string, unknown>).length === 0);
            if (planIsEmpty) {
                output.plan = {
                    summary: "Auto-generated plan (planner output was empty).",
                    steps: normalized.map((task) => task.title),
                };
            }
            return output;
        };

        const writeTodosTool = createTool(
            async (input: { tasks: Array<{ id?: string; title?: string; status?: string }>; currentTaskId?: string }) => {
                const tasks = Array.isArray(input.tasks) ? input.tasks : [];
                applyTodosUpdate(tasks as Array<Record<string, unknown>>, input.currentTaskId);
                await persistState();
                return JSON.stringify(
                    {
                        updated: true,
                        currentTaskId: (state as any).currentTaskId ?? "",
                        taskCount: Array.isArray((state as any).taskQueue) ? (state as any).taskQueue.length : 0,
                    },
                    null,
                    2
                );
            },
            {
                name: "write_todos",
                description: "Update the task queue and current task pointer for this agent run.",
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

        const localTools = [writeTodosTool];

        const runSubGraph = async (message: string, graphId: string) => {
            const subGraph = await agentGraphService.getGraph(graphId);
            if (!subGraph) {
                throw new Error(`Subgraph ${graphId} not found`);
            }
            if (run.graphId?.toString?.() === graphId) {
                throw new Error("Subgraph cannot reference the current graph");
            }
            const nodeOrder = getGraphNodeOrder(subGraph);
            const subRunId = await agentGraphRunService.createRun(graphId, workspace._id?.toString());
            const initialNodeStatuses: Record<string, any> = {};
            for (const node of subGraph.nodes) {
                initialNodeStatuses[node.id] = "PENDING";
            }
            await agentGraphRunService.updateRunStatus(subRunId, "RUNNING", {
                nodeOrder,
                nodeStatuses: initialNodeStatuses,
                state: buildInitialState(subGraph, message),
            } as any);

            return await this.executeRunStreaming(subRunId, {
                llmSelectionOverride: opts?.llmSelectionOverride,
            });
        };
        if (auditContext) {
            const existingContext = (state as any).context;
            if (existingContext && typeof existingContext === "object" && !Array.isArray(existingContext)) {
                (state as any).context = { ...(existingContext as Record<string, unknown>), audit: auditContext };
            } else {
                (state as any).context = auditContext;
            }
        }
        const nodeRunCounts: Record<string, number> = {
            ...(state.execution?.runsByNode ?? {}),
        };
        let totalSteps = typeof state.execution?.step === "number" ? state.execution.step : 0;
        const executionHistory = Array.isArray(state.execution?.history) ? [...state.execution!.history!] : [];
        state.execution = {
            ...(state.execution ?? {}),
            mode: executionMode,
            step: totalSteps,
            runsByNode: nodeRunCounts,
            history: executionHistory,
        };

        await agentGraphRunService.updateRunStatus(runId, "RUNNING", {});

        // Initialize token usage tracking for this run
        tokenUsageService.startRunTracking(runId);

        const globalTimeline: TimelineEvent[] = timelineNodeIds.map((id) => {
            const node = graph.nodes.find((n) => n.id === id);
            return {
                id,
                label: node?.label ?? id,
                status: "pending",
                summary: "Pending",
                details: graph.description ?? "",
                systemPrompt: node?.react?.systemPrompt ?? "",
                thoughtLog: [],
            };
        });

        const globalEventStream: AgentEvent[] = [];
        let globalEventCounter = 0;
        const nextGlobalEventId = () => `event-${globalEventCounter++}`;
        const initialUserEvent: AgentEvent = {
            id: nextGlobalEventId(),
            phaseId: "user",
            phaseLabel: "User input",
            kind: "user",
            role: "user",
            content: typeof state.mission === "string" ? state.mission : "",
            timestamp: new Date().toISOString(),
        };
        globalEventStream.push(initialUserEvent);

        const emitUpdate = async () => {
            if (!opts?.onUpdate) return;
            // Include running token usage in meta
            const runningTokenUsage = tokenUsageService.getRunAccumulatedUsage(runId);
            const outputs = createPlaceholderOutputs({
                mission: typeof state.mission === "string" ? state.mission : "",
                report: JSON.stringify(state.nodes ?? {}, null, 2),
                meta: {
                    runId,
                    graphId: run.graphId.toString(),
                    state: cloneValue(state),
                    tokenUsage: runningTokenUsage,
                },
            });
            await opts.onUpdate({
                timeline: cloneValue(globalTimeline),
                eventStream: cloneValue(globalEventStream),
                outputs,
            });
        };

        await emitUpdate();

        const pendingNodeIds =
            executionMode === "dag" ? timelineNodeIds.slice() : getEntryNodeIds(graph);
        const maxIterations = graph.execution?.maxIterations ?? 200;
        const maxNodeRuns = graph.execution?.maxNodeRuns ?? 20;

        const selectNextNodes = (currentId: string) => {
            if (executionMode !== "state_machine") return [];
            const matched: string[] = [];
            const seen = new Set<string>();
            const outgoing = graph.edges.filter((e) => e.source === currentId);
            for (const edge of outgoing) {
                if (evaluateCondition(edge.condition, state)) {
                    if (!seen.has(edge.target)) {
                        matched.push(edge.target);
                        seen.add(edge.target);
                    }
                }
            }
            return matched;
        };

        while (pendingNodeIds.length) {
            await ensureNotAborted();
            const nodeId = pendingNodeIds.shift()!;
            const node = graph.nodes.find((n) => n.id === nodeId);
            if (!node) {
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: `Missing node ${nodeId} in graph definition`,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (missing node).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: Missing node ${nodeId} in graph definition`,
                        meta: { runId, graphId: run.graphId.toString() },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }

            totalSteps += 1;
            nodeRunCounts[nodeId] = (nodeRunCounts[nodeId] ?? 0) + 1;
            state.execution = {
                ...(state.execution ?? {}),
                mode: executionMode,
                step: totalSteps,
                runsByNode: nodeRunCounts,
                history: [...executionHistory, nodeId],
                lastNodeId: nodeId,
            };
            executionHistory.push(nodeId);
            if (totalSteps > maxIterations) {
                const message = `Max iterations exceeded (${maxIterations}).`;
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: message,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (max iterations).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${message}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }
            if (nodeRunCounts[nodeId] > maxNodeRuns) {
                const message = `Max node executions exceeded for ${nodeId} (${maxNodeRuns}).`;
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: message,
                } as any);
                const failureResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed (max node runs).",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${message}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
                await emitUpdate();
                return failureResult;
            }

            await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "RUNNING");
            const timelineEntry = globalTimeline.find((t) => t.id === nodeId);
            if (timelineEntry) {
                timelineEntry.status = "running";
                timelineEntry.summary = "Running";
                timelineEntry.startedAt = new Date().toISOString();
            }
            await emitUpdate();

            const timeline = createSessionTimeline(node);
            const eventStream: AgentEvent[] = [];
            // Use globalEventCounter to ensure unique IDs across all events in globalEventStream
            const nextEventId = () => nextGlobalEventId();

            const userPrompt = renderUserPrompt(node.react.userPromptTemplate, state);
            const systemEvent: AgentEvent = {
                id: nextEventId(),
                phaseId: node.id,
                phaseLabel: node.label,
                kind: "system",
                role: "system",
                content: node.react.systemPrompt,
                timestamp: new Date().toISOString(),
            };
            const userEvent: AgentEvent = {
                id: nextEventId(),
                phaseId: node.id,
                phaseLabel: node.label,
                kind: "user",
                role: "user",
                content: userPrompt,
                timestamp: new Date().toISOString(),
            };
            eventStream.push(systemEvent, userEvent);

            const flushUpdate = async () => {
                await emitUpdate();
            };

            await flushUpdate();

            try {
                const nodeKind = node.kind ?? "react";

                // ---------------------------------------------------------
                // 2.5. Skills Injection (NEW)
                // ---------------------------------------------------------
                const skillIds = node.react.skillIds ?? [];
                let skillPromptPrefix = "";
                let skillTools: string[] = [];
                if (skillIds.length > 0) {
                    try {
                        const resolvedSkills = await skillRegistry.getSkills(skillIds);
                        skillPromptPrefix = resolvedSkills
                            .map((s) => s.resolvedSystemPrompt)
                            .filter(Boolean)
                            .join("\n\n---\n\n");
                        skillTools = [...new Set(resolvedSkills.flatMap((s) => s.resolvedTools))];
                    } catch (err) {
                        console.warn(`[AgentGraph] Failed to load skills ${skillIds.join(", ")}:`, err);
                    }
                }
                // Merge skill tools with node-defined tools
                const mergedToolNames = [...new Set([...(node.react.toolNames ?? []), ...skillTools, "write_todos"])];
                const selectedTools = selectToolsByName(mergedToolNames, localTools);
                const toolInvokerMap = new Map<string, (input: Record<string, unknown>) => Promise<string>>();

                const invokeBaseTool = async (baseTool: any, input: unknown) => {
                    if (typeof baseTool?.invoke === "function") {
                        return await baseTool.invoke(input);
                    }
                    if (typeof baseTool?.call === "function") {
                        return await baseTool.call(input);
                    }
                    if (typeof baseTool?.func === "function") {
                        return await baseTool.func(input);
                    }
                    throw new Error(`Tool ${String(baseTool?.name ?? "unknown")} is not callable`);
                };

                const handleMemoryTool = async (toolName: string, input: Record<string, unknown>) => {
                    if (!workspaceObjectId) return null;
                    const memoryPath = extractMemoryPath(toolName, input);
                    if (!memoryPath) return null;
                    try {
                        if (toolName === "list_files") {
                            const items = await agentMemoryService.list(memoryPath, workspaceObjectId);
                            if (!items.length) return `No memory entries found under ${memoryPath}`;
                            return items
                                .map((item) => `${item.path} (size: ${item.size}, updated: ${item.updatedAt.toISOString()})`)
                                .join("\n");
                        }
                        if (toolName === "read_file") {
                            return await agentMemoryService.read(memoryPath, workspaceObjectId);
                        }
                        if (toolName === "read_file_range") {
                            const content = await agentMemoryService.read(memoryPath, workspaceObjectId);
                            const start = Math.max(1, Number(input.startLine ?? 1));
                            const end = Math.max(start, Number(input.endLine ?? start));
                            const lines = content.split("\n");
                            const slice = lines.slice(start - 1, end);
                            return slice.map((line, idx) => `${start + idx}: ${line}`).join("\n");
                        }
                        if (toolName === "write_file") {
                            const content = typeof input.content === "string" ? input.content : "";
                            await agentMemoryService.write(memoryPath, content, workspaceObjectId);
                            return `Memory updated at ${memoryPath} (${content.length} chars).`;
                        }
                        return null;
                    } catch (err) {
                        return `Memory error: ${(err as Error)?.message ?? String(err)}`;
                    }
                };

                const wrapTool = (baseTool: any) => {
                    const name = String(baseTool?.name ?? "unknown");
                    const description = baseTool?.description ?? "";
                    const schema = baseTool?.schema ?? z.any();
                    const returnDirect = (baseTool as any)?.returnDirect;
                    const wrapped = createTool(
                        async (input: Record<string, unknown>) => {
                            await ensureNotAborted();

                            const memoryResult = await handleMemoryTool(name, input);
                            if (memoryResult !== null) {
                                return await maybeEvictToolResult({
                                    rootDir,
                                    runId,
                                    nodeId: node.id,
                                    toolName: name,
                                    rawResult: memoryResult,
                                });
                            }

                            if (name === "write_file" || name === "execute_bash" || name === "str_replace_editor") {
                                const descriptionText =
                                    name === "write_file"
                                        ? `Write file ${String(input?.filePath ?? "")}`
                                        : name === "str_replace_editor"
                                        ? `Edit file ${String((input as any)?.filePath ?? (input as any)?.path ?? "")}`
                                        : `Execute command ${String(input?.command ?? "")}`;
                                const approvals = (state as any).approvals ?? {};
                                const pending = Array.isArray(approvals.pending) ? approvals.pending.slice() : [];
                                const granted = Array.isArray(approvals.granted) ? approvals.granted.slice() : [];
                                const approvalKey = buildApprovalKey(name, input);

                                const existingPending = findApprovalByKey(pending, approvalKey);
                                if (existingPending) {
                                    return `Approval already pending (ID: ${existingPending.id}).`;
                                }
                                const existingGranted = findApprovalByKey(granted, approvalKey);
                                if (existingGranted) {
                                    const result = typeof existingGranted.result === "string" ? existingGranted.result : "";
                                    if (result) return result;
                                    if (typeof existingGranted.evictedPath === "string" && existingGranted.evictedPath) {
                                        return `Result already available at ${existingGranted.evictedPath}`;
                                    }
                                    return `Approval already granted (ID: ${existingGranted.id}).`;
                                }

                                const edit = safeEditGate.proposeEdit(
                                    runId,
                                    name,
                                    input,
                                    descriptionText,
                                    workspaceObjectId?.toString()
                                );
                                pending.push({
                                    id: edit.id,
                                    toolName: edit.toolName,
                                    args: edit.args,
                                    status: edit.status,
                                    createdAt: edit.createdAt,
                                    description: edit.description,
                                    key: approvalKey,
                                });
                                (state as any).approvals = { ...approvals, pending };
                                await persistState();
                                return `Approval required. Proposed ${name} with ID ${edit.id}.`;
                            }

                            const result = await invokeBaseTool(baseTool, input);
                            return await maybeEvictToolResult({
                                rootDir,
                                runId,
                                nodeId: node.id,
                                toolName: name,
                                rawResult: result,
                            });
                        },
                        { name, description, schema, returnDirect }
                    );
                    toolInvokerMap.set(name, async (input: Record<string, unknown>) => {
                        return await wrapped.invoke(input);
                    });
                    return wrapped;
                };

                const tools = selectedTools.map(wrapTool);

                const builtMessageEvents: AgentEvent[] = [];
                const handleStreamingMessage = async (message: BaseMessage) => {
                    await ensureNotAborted();
                    const event = createAgentEvent(message, node.id, node.label, nextEventId());
                    builtMessageEvents.push(event);
                    eventStream.push(event);
                    globalEventStream.push(event);
                    await flushUpdate();
                };

                // ---------------------------------------------------------
                // 3. Smart Context Injection (New Architecture)
                // ---------------------------------------------------------
                let contextBlock = "";
                if (contextInjectionEnabled) {
                    // We rank context based on the rendered user prompt + editor state
                    const editorState = getEditorStateManager(workspace._id!.toString()).getCurrentState();
                    const ranker = new ContextRanker(contextGraphStore);
                    const rankedContext = await ranker.rank({
                        userPrompt: userPrompt, // Using existing `userPrompt`
                        editorState,
                        limit: 15, // Retrieve top 15 most relevant
                        tokenBudget: 30000 // Reserve budget
                    });

                    // Format the context for the System Prompt
                    contextBlock = `\n\n## ACTIVE CONTEXT (Auto-Detected)\n`;
                    if (editorState.activeFile) {
                        contextBlock += `- Current File: ${editorState.activeFile}\n`;
                    }

                    if (rankedContext.length > 0) {
                        contextBlock += `\nThe following files are likely relevant to your task:\n`;
                        for (const item of rankedContext) {
                            const rel = (item.score * 100).toFixed(0);
                            const reasons = item.reasons.join(", ");
                            contextBlock += `- ${item.node.id} (Relevance: ${rel}% - ${reasons})\n`;
                            // Future: Inject snippets here if budget allows
                        }
                    } else {
                        contextBlock += `No specific relevant files detected in context graph.\n`;
                    }
                }

                // Compose final system prompt: skills prefix + base prompt + context
                const renderedSystemPrompt = renderUserPrompt(node.react.systemPrompt, state);
                const baseSystemPrompt = skillPromptPrefix
                    ? `${skillPromptPrefix}\n\n---\n\n${renderedSystemPrompt}`
                    : renderedSystemPrompt;
                const auditContextPrompt = auditContext ? formatAuditContextPrompt(auditContext) : null;
                const taskQueue = Array.isArray((state as any).taskQueue) ? (state as any).taskQueue : [];
                const currentTaskId = typeof (state as any).currentTaskId === "string" ? (state as any).currentTaskId : "";
                const taskContextBlock = [
                    "\n\n## PLAN & TASK QUEUE",
                    `Current task id: ${currentTaskId || "(none)"}`,
                    `Task queue: ${JSON.stringify(taskQueue, null, 2)}`,
                    "Use write_todos to create or update the task queue when the mission requires multiple steps.",
                ].join("\n");
                const enhancedSystemPrompt = `${baseSystemPrompt}${contextBlock}${taskContextBlock}${auditContextPrompt ? `\n\n${auditContextPrompt}` : ""}`;

                // Update timeline with the ACTUAL prompt used (including context)
                if (timeline[0]) {
                    timeline[0].systemPrompt = enhancedSystemPrompt;
                }

                // ---------------------------------------------------------
                // 4. Execution
                // ---------------------------------------------------------
                // this.ensureActiveEvent("assistant"); // Commented out as `this` context is `AgentGraphExecutor` not a React component.

                // We'll capture the *new* messages from this turn
                let validated: unknown;
                if (nodeKind === "router") {
                    const routerNote: AgentEvent = {
                        id: nextEventId(),
                        phaseId: node.id,
                        phaseLabel: node.label,
                        kind: "assistant",
                        role: "assistant",
                        content: "Router node executed. Evaluating outgoing conditions.",
                        timestamp: new Date().toISOString(),
                    };
                    eventStream.push(routerNote);
                    globalEventStream.push(routerNote);
                    await flushUpdate();
                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }
                    validated = schema.parse({
                        route: "conditional_edges",
                        timestamp: new Date().toISOString(),
                    });
                } else if (nodeKind === "delegate") {
                    const delegateConfig = node.delegate ?? { mode: "react" };
                    const delegateInput = userPrompt;
                    let rawResult = "";

                    if (delegateConfig.mode === "graph") {
                        if (!delegateConfig.graphId) {
                            throw new Error(`Delegate node ${node.id} requires delegate.graphId`);
                        }
                        const delegateRun = await runSubGraph(delegateInput, delegateConfig.graphId);
                        rawResult = typeof delegateRun.outputs?.report === "string"
                            ? delegateRun.outputs.report
                            : JSON.stringify(delegateRun.outputs ?? {}, null, 2);
                    } else {
                        const delegateResult = await streamReactAgentMessages({
                            name: `Delegate:${node.id}`,
                            systemPrompt: enhancedSystemPrompt,
                            userPrompt: delegateInput,
                            tools,
                            llmSelection: opts?.llmSelectionOverride ?? node.react.llmSelection,
                            abortSignal: abortController.signal,
                            getAbortReason: () => abortReason,
                            shouldAbort: checkAbortReason,
                            onTokenUsage: async (usage, model) => {
                                await tokenUsageService.logUsage({
                                    timestamp: new Date(),
                                    provider: (opts?.llmSelectionOverride?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                    model,
                                    usage,
                                    ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                    runId: new ObjectId(runId),
                                    nodeId: node.id,
                                    callType: "delegate_agent",
                                });
                            },
                        });
                        const delegateMessages = delegateResult.messages ?? [];
                        const delegateFinal =
                            delegateMessages
                                .slice()
                                .reverse()
                                .find((message) => {
                                    const role = typeof (message as any).role === "string" ? String((message as any).role).toLowerCase() : "";
                                    const type = typeof message.type === "string" ? message.type.toLowerCase() : "";
                                    return role === "assistant" || type === "ai" || type === "assistant";
                                }) ?? delegateMessages.at(-1);
                        rawResult = delegateFinal ? describeMessageContent(delegateFinal) : "";
                    }

                    if (rawResult.length > TOOL_RESULT_EVICT_CHARS) {
                        const relativePath = await writeEvictedToolResult({
                            rootDir,
                            runId,
                            nodeId: node.id,
                            toolName: "delegate_result",
                            content: rawResult,
                        });
                        rawResult = `Delegate result evicted to ${relativePath}. Use read_file to inspect.`;
                    }

                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }

                    let parsed: unknown;
                    if (delegateConfig.summaryPrompt && delegateConfig.summaryPrompt.trim().length > 0) {
                        const summaryPrompt = renderUserPrompt(delegateConfig.summaryPrompt, state);
                        const summaryResult = await streamReactAgentMessages({
                            name: `DelegateSummary:${node.id}`,
                            systemPrompt: summaryPrompt,
                            userPrompt: rawResult,
                            tools: [],
                            llmSelection: delegateConfig.summaryLlmSelection ?? node.react.llmSelection,
                            abortSignal: abortController.signal,
                            getAbortReason: () => abortReason,
                            shouldAbort: checkAbortReason,
                            onTokenUsage: async (usage, model) => {
                                await tokenUsageService.logUsage({
                                    timestamp: new Date(),
                                    provider: (delegateConfig.summaryLlmSelection?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                    model,
                                    usage,
                                    ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                    runId: new ObjectId(runId),
                                    nodeId: node.id,
                                    callType: "delegate_summary",
                                });
                            },
                        });
                        const summaryMessages = summaryResult.messages ?? [];
                        const summaryFinal =
                            summaryMessages
                                .slice()
                                .reverse()
                                .find((message) => {
                                    const role = typeof (message as any).role === "string" ? String((message as any).role).toLowerCase() : "";
                                    const type = typeof message.type === "string" ? message.type.toLowerCase() : "";
                                    return role === "assistant" || type === "ai" || type === "assistant";
                                }) ?? summaryMessages.at(-1);
                        const summaryContent = summaryFinal ? describeMessageContent(summaryFinal) : "";
                        const summaryEvent: AgentEvent = {
                            id: nextEventId(),
                            phaseId: node.id,
                            phaseLabel: node.label,
                            kind: "assistant",
                            role: "assistant",
                            content: summaryContent,
                            timestamp: new Date().toISOString(),
                        };
                        eventStream.push(summaryEvent);
                        globalEventStream.push(summaryEvent);
                        await flushUpdate();
                        parsed = parseJsonOutput(summaryContent);
                    } else {
                        parsed = {
                            summary: rawResult.slice(0, 4000),
                            raw: rawResult,
                        };
                        const summaryEvent: AgentEvent = {
                            id: nextEventId(),
                            phaseId: node.id,
                            phaseLabel: node.label,
                            kind: "assistant",
                            role: "assistant",
                            content: JSON.stringify(parsed, null, 2),
                            timestamp: new Date().toISOString(),
                        };
                        eventStream.push(summaryEvent);
                        globalEventStream.push(summaryEvent);
                        await flushUpdate();
                    }

                    validated = schema.parse(parsed);
                } else {
                    const result = await streamReactAgentMessages({
                        name: `GraphNode:${node.id}`, // Using existing `node.id`
                        systemPrompt: enhancedSystemPrompt, // Use enhanced prompt
                        userPrompt: userPrompt, // Using existing `userPrompt`
                        tools,
                        llmSelection: opts?.llmSelectionOverride ?? node.react.llmSelection,
                        // extraMessages: messageHistory, // Commented out as `messageHistory` is not defined.
                        onMessage: handleStreamingMessage, // Using existing `handleStreamingMessage`
                        abortSignal: abortController.signal,
                        getAbortReason: () => abortReason,
                        shouldAbort: checkAbortReason,
                        onTokenUsage: async (usage, model) => {
                            // Log individual usage to MongoDB and accumulate in-memory
                            await tokenUsageService.logUsage({
                                timestamp: new Date(),
                                provider: (opts?.llmSelectionOverride?.provider ?? node.react.llmSelection?.provider ?? "unknown") as any,
                                model,
                                usage,
                                ...(workspaceObjectId ? { workspaceId: workspaceObjectId } : {}),
                                runId: new ObjectId(runId),
                                nodeId: node.id,
                                callType: "react_agent",
                            });
                        },
                    });
                    const finalAgentEvent =
                        builtMessageEvents.slice().reverse().find((event) => event.kind === "assistant") ??
                        builtMessageEvents.at(-1);
                    const finalContent = finalAgentEvent?.content ?? "";

                    let parsed: unknown = parseJsonOutput(finalContent);
                    const schemaId = node.output.schemaId as keyof typeof nodeOutputSchemaRegistry;
                    const schema = nodeOutputSchemaRegistry[schemaId];
                    if (!schema) {
                        throw new Error(`Unknown schemaId: ${node.output.schemaId}`);
                    }
                    parsed = await maybeExecuteJsonActionTool({
                        schemaId: String(schemaId),
                        parsed,
                        allowedToolNames: node.react.toolNames ?? [],
                        phaseId: node.id,
                        phaseLabel: node.label,
                        makeEventId: nextGlobalEventId,
                        pushEvent: (event) => {
                            globalEventStream.push(event);
                            eventStream.push(event);
                        },
                        invokeToolByName: async (name, args) => {
                            const invoker = toolInvokerMap.get(name);
                            if (!invoker) {
                                return `Tool ${name} is not available in this node.`;
                            }
                            return await invoker(args);
                        },
                        ensureActive: ensureNotAborted,
                    });
                    validated = schema.parse(parsed);
                    if (node.output?.schemaId === "cursor_planner_output") {
                        const missionText =
                            (typeof (state as any).mission === "string" && (state as any).mission) ||
                            (typeof (state as any).userInput === "string" && (state as any).userInput) ||
                            "";
                        validated = ensurePlannerOutput(validated, missionText) as typeof validated;
                    }
                }

                state.nodes[node.id] = validated as any;
                if (node.output?.statePath) {
                    setNestedValue(state as any, node.output.statePath, validated, {
                        merge: node.output?.stateMerge,
                    });
                }
                await agentGraphRunService.updateRunState(runId, cloneValue(state));
                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "COMPLETED");

                // Persist node-level token usage
                const nodeTokenUsage = tokenUsageService.getNodeUsage(runId, nodeId);
                await agentGraphRunService.updateNodeTokenUsage(runId, nodeId, nodeTokenUsage);

                timeline[0].status = "success";
                timeline[0].summary = "Node execution (done)";
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate();

                if (timelineEntry) {
                    timelineEntry.status = "success";
                    timelineEntry.summary = "Done";
                    timelineEntry.endedAt = new Date().toISOString();
                    timelineEntry.tokenUsage = nodeTokenUsage.totalTokens > 0 ? {
                        inputTokens: nodeTokenUsage.inputTokens,
                        outputTokens: nodeTokenUsage.outputTokens,
                        totalTokens: nodeTokenUsage.totalTokens,
                    } : undefined;
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline,
                    conclusion: "Node completed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: JSON.stringify(validated, null, 2),
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };

                if (executionMode === "state_machine") {
                    const nextNodes = selectNextNodes(nodeId);
                    if (nextNodes.length) {
                        pendingNodeIds.push(...nextNodes);
                    }
                }
            } catch (err: any) {
                if (err instanceof AgentWorkflowAbortError || err?.name === "AgentWorkflowAbortError") {
                    const reason: AgentWorkflowAbortReason = err.reason ?? "PAUSED";
                    const status = reason === "CANCELLED" ? "CANCELLED" : "PAUSED";
                    const { summary: runTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
                    await agentGraphRunService.updateRunTokenUsage(runId, runTokenUsage);
                    await agentGraphRunService.updateRunStatus(runId, status as any, {
                        endedAt: new Date(),
                        error: err?.message ?? String(err),
                    } as any);

                    if (timelineEntry) {
                        timelineEntry.status = "error";
                        timelineEntry.summary = reason === "PAUSED" ? "Paused" : "Cancelled";
                        timelineEntry.endedAt = new Date().toISOString();
                    }
                    await emitUpdate();
                    throw err;
                }

                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "FAILED");
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: err?.message ?? String(err),
                } as any);

                timeline[0].status = "error";
                timeline[0].summary = `Failed: ${err?.message ?? "unknown error"}`;
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate();

                if (timelineEntry) {
                    timelineEntry.status = "error";
                    timelineEntry.summary = `Failed: ${err?.message ?? "unknown error"}`;
                    timelineEntry.endedAt = new Date().toISOString();
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId: runId,
                    timeline,
                    conclusion: "Node failed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${err?.message ?? String(err)}`,
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };
                return {
                    sessionId: runId,
                    timeline: globalTimeline,
                    conclusion: "Run failed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${err?.message ?? String(err)}`,
                        meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
                    }),
                    eventStream: globalEventStream,
                };
            }
        }

        // Finalize token usage tracking and persist run-level summary
        const { summary: runTokenUsage } = tokenUsageService.finalizeRunTracking(runId);
        await agentGraphRunService.updateRunTokenUsage(runId, runTokenUsage);

        await agentGraphRunService.updateRunStatus(runId, "COMPLETED", {
            endedAt: new Date(),
        } as any);

        const successResult: AgentWorkflowResult = {
            sessionId: runId,
            timeline: globalTimeline,
            conclusion: "Run completed.",
            outputs: createPlaceholderOutputs({
                mission: typeof state.mission === "string" ? state.mission : "",
                report: JSON.stringify(state.nodes ?? {}, null, 2),
                meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
            }),
            eventStream: globalEventStream,
        };
        await emitUpdate();
        return successResult;
        });
    }
}

export const agentGraphExecutor = new AgentGraphExecutor();
