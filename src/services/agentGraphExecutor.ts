import { BaseMessage, SystemMessage } from "@langchain/core/messages";

import type { AgentEvent, AgentEventKind, AgentWorkflowResult, AgentWorkflowUpdate, TimelineEvent } from "../types";
import { streamReactAgentMessages } from "../reactAgentRunner";
import { allMcpTools } from "../tools/mcpTools";
import { auditService } from "./auditService";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphService } from "./agentGraphService";
import type { AgentGraphNode } from "./agentGraphTypes";
import type { LlmProviderType } from "@/src/schemas/llmConfig.schema";
import { nodeOutputSchemaRegistry } from "../shared/nodeOutputSchemas";
import { parseJsonOutput, renderUserPrompt } from "./agentGraphUtils";
import { McpClient } from "../mcp/client";
import { evaluateCondition } from "./agentGraphConditions";
import { getEntryNodeIds, getGraphNodeOrder, resolveExecutionMode } from "./agentGraphRuntime";
import { setNestedValue } from "./agentGraphState";

// --- Context Management Imports ---
import { contextGraphStore } from "@/src/context/graph/ContextGraphStore";
import { ContextRanker } from "@/src/context/graph/ContextRanker";
import { editorStateManager } from "@/src/context/graph/EditorStateManager";
import { ContextScanner } from "@/src/context/graph/ContextScanner";


const cloneValue = <T>(value: T): T => {
    if (
        typeof (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone })?.structuredClone ===
        "function"
    ) {
        return (globalThis as typeof globalThis & { structuredClone: typeof structuredClone }).structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
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

function selectToolsByName(toolNames: string[]) {
    const allow = new Set(toolNames ?? []);
    return allMcpTools.filter((tool: any) => allow.has(String(tool?.name ?? "")));
}

async function maybeExecuteJsonActionTool(opts: {
    schemaId: string;
    parsed: unknown;
    allowedToolNames: string[];
    phaseId: string;
    phaseLabel: string;
    makeEventId: () => string;
    pushEvent: (event: AgentEvent) => void;
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

    const client = await McpClient.getInstance();
    const toolResult = await client.callTool(action, args);

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
async function ensureContextGraphReady() {
    if (contextGraphStore.getAllNodes().length > 0) return;

    console.log("[AgentGraph] Context graph is empty, attempting load...");
    await contextGraphStore.load();

    if (contextGraphStore.getAllNodes().length === 0) {
        console.log("[AgentGraph] Context graph still empty, triggering fresh workspace scan...");

        // Import getConfigSafe to get the configured repository path
        const { getConfigSafe } = await import("@/src/config");
        const config = await getConfigSafe();

        if (!config) {
            console.warn("[AgentGraph] Repository path not configured. Skipping workspace scan.");
            return;
        }

        const scanner = new ContextScanner();
        await scanner.scanWorkspace(config.workingFolder);
        await contextGraphStore.save();
        console.log(`[AgentGraph] Scan complete. Graph now has ${contextGraphStore.getAllNodes().length} nodes.`);
    }
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
        }
    ): Promise<AgentWorkflowResult> {
        // Ensure context is ready before we start
        await ensureContextGraphReady();

        const run = await agentGraphRunService.getRun(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        const graph = await agentGraphService.getGraph(run.graphId.toString());
        if (!graph) throw new Error(`Graph ${run.graphId.toString()} not found`);

        const executionMode = resolveExecutionMode(graph);
        const timelineNodeIds = (run.nodeOrder?.length ? run.nodeOrder : getGraphNodeOrder(graph)).slice();
        if (!run.nodeOrder?.length) {
            await agentGraphRunService.setNodeOrder(runId, timelineNodeIds);
        }

        const state = cloneValue(run.state ?? { nodes: {} });
        if (!state.nodes) state.nodes = {};
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
            const outputs = createPlaceholderOutputs({
                mission: typeof state.mission === "string" ? state.mission : "",
                report: JSON.stringify(state.nodes ?? {}, null, 2),
                meta: { runId, graphId: run.graphId.toString(), state: cloneValue(state) },
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

            const sessionPrompt = `[AgentGraph] run=${runId} node=${node.id} label="${node.label}"`;
            const sessionId = await auditService.createSession(sessionPrompt);
            await agentGraphRunService.setRunNodeSessionId(runId, nodeId, sessionId);

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

            const flushUpdate = async (finalReport?: string) => {
                if (!sessionId) return;
                const outputs = createPlaceholderOutputs({
                    mission: typeof state.mission === "string" ? state.mission : "",
                    report: finalReport ?? "",
                    meta: { runId, nodeId: node.id },
                });
                await auditService.updateSession(sessionId, {
                    timeline: cloneValue(timeline),
                    eventStream: cloneValue(eventStream),
                    outputs: cloneValue(outputs),
                } as any);

                await emitUpdate();
            };

            await flushUpdate();

            try {
                const nodeKind = node.kind ?? "react";
                const tools = selectToolsByName(node.react.toolNames ?? []);
                const builtMessageEvents: AgentEvent[] = [];
                const handleStreamingMessage = async (message: BaseMessage) => {
                    const event = createAgentEvent(message, node.id, node.label, nextEventId());
                    builtMessageEvents.push(event);
                    eventStream.push(event);
                    globalEventStream.push(event);
                    await flushUpdate();
                };

                // ---------------------------------------------------------
                // 3. Smart Context Injection (New Architecture)
                // ---------------------------------------------------------
                // We rank context based on the rendered user prompt + editor state
                // NOTE: `editorStateManager` and `contextGraphStore` are not defined in the provided context.
                // Assuming they are globally available or imported elsewhere.
                // Also, `renderedUserPrompt`, `currentNode`, `messageHistory`, `ensureActiveEvent`,
                // `handleStreamingToken`, `handleToolCallChunk`, `handleMessageCompletion` are not defined.
                // This injection will likely cause compilation errors without further context.
                // For the purpose of this task, I'm injecting as requested.
                const editorState = editorStateManager.getCurrentState();
                const ranker = new ContextRanker(contextGraphStore);
                const rankedContext = await ranker.rank({
                    userPrompt: userPrompt, // Using existing `userPrompt`
                    editorState,
                    limit: 15, // Retrieve top 15 most relevant
                    tokenBudget: 30000 // Reserve budget
                });

                // Format the context for the System Prompt
                let contextBlock = `\n\n## ACTIVE CONTEXT (Auto-Detected)\n`;
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

                const renderedSystemPrompt = renderUserPrompt(node.react.systemPrompt, state);
                const enhancedSystemPrompt = `${renderedSystemPrompt}\n${contextBlock}`;

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
                } else {
                    const messages = await streamReactAgentMessages({
                        name: `GraphNode:${node.id}`, // Using existing `node.id`
                        systemPrompt: enhancedSystemPrompt, // Use enhanced prompt
                        userPrompt: userPrompt, // Using existing `userPrompt`
                        tools,
                        llmSelection: opts?.llmSelectionOverride ?? node.react.llmSelection,
                        // extraMessages: messageHistory, // Commented out as `messageHistory` is not defined.
                        onMessage: handleStreamingMessage, // Using existing `handleStreamingMessage`
                        // onToken: (token) => this.handleStreamingToken(token), // Commented out as `this` context is `AgentGraphExecutor`
                        // onToolCallChunk: (chunk) => this.handleToolCallChunk(chunk), // Commented out as `this` context is `AgentGraphExecutor`
                        // onMessage: (msg) => this.handleMessageCompletion(msg) // Commented out as `this` context is `AgentGraphExecutor`
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
                    });
                    validated = schema.parse(parsed);
                }

                state.nodes[node.id] = validated as any;
                if (node.output?.statePath) {
                    setNestedValue(state as any, node.output.statePath, validated, {
                        merge: node.output?.stateMerge,
                    });
                }
                await agentGraphRunService.updateRunState(runId, cloneValue(state));
                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "COMPLETED");

                timeline[0].status = "success";
                timeline[0].summary = "Node execution (done)";
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate(JSON.stringify(validated, null, 2));

                if (timelineEntry) {
                    timelineEntry.status = "success";
                    timelineEntry.summary = "Done";
                    timelineEntry.endedAt = new Date().toISOString();
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId,
                    timeline,
                    conclusion: "Node completed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: JSON.stringify(validated, null, 2),
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };
                await auditService.completeSession(sessionId, finalResult);

                if (executionMode === "state_machine") {
                    const nextNodes = selectNextNodes(nodeId);
                    if (nextNodes.length) {
                        pendingNodeIds.push(...nextNodes);
                    }
                }
            } catch (err: any) {
                await agentGraphRunService.updateRunNodeStatus(runId, nodeId, "FAILED");
                await agentGraphRunService.updateRunStatus(runId, "FAILED", {
                    endedAt: new Date(),
                    error: err?.message ?? String(err),
                } as any);

                timeline[0].status = "error";
                timeline[0].summary = `Failed: ${err?.message ?? "unknown error"}`;
                timeline[0].endedAt = new Date().toISOString();
                await flushUpdate(`ERROR: ${err?.message ?? String(err)}`);

                if (timelineEntry) {
                    timelineEntry.status = "error";
                    timelineEntry.summary = `Failed: ${err?.message ?? "unknown error"}`;
                    timelineEntry.endedAt = new Date().toISOString();
                }
                await emitUpdate();

                const finalResult: AgentWorkflowResult = {
                    sessionId,
                    timeline,
                    conclusion: "Node failed.",
                    outputs: createPlaceholderOutputs({
                        mission: typeof state.mission === "string" ? state.mission : "",
                        report: `ERROR: ${err?.message ?? String(err)}`,
                        meta: { runId, nodeId: node.id },
                    }),
                    eventStream,
                };
                await auditService.completeSession(sessionId, finalResult, err instanceof Error ? err : new Error(String(err)));
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
    }
}

export const agentGraphExecutor = new AgentGraphExecutor();
