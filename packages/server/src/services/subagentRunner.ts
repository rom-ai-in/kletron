import { ObjectId } from "mongodb";

import { streamReactAgentMessages } from "@kletron/agent-core/reactAgentRunner";
import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";

import { config } from "../config";
import type { LlmSelection } from "../llm";
import { agentGraphRunService } from "./agentGraphRunService";
import { buildInitialState, getGraphNodeOrder } from "./agentGraphRuntime";
import { agentGraphService } from "./agentGraphService";
import { effectiveToolNames } from "./effectiveToolNames";
import type { ResolvedSubagent } from "./subagentRegistry";
import { EXECUTION_TOOLS, WRITE_REPO_TOOLS, isSafeCommand } from "./toolApprovalPolicy";
import { tokenUsageService } from "./tokenUsageService";
import { addTokenUsage, createEmptyTokenUsage, type TokenUsage } from "./tokenUsageTypes";
import { resolveWorkspaceCapabilities } from "./workspaceCapabilityResolver";

/**
 * Injected into every subagent. A subagent cannot ask questions and its final
 * message is consumed by another agent, not a human — both facts change how it
 * should behave, so we state them explicitly rather than hoping it infers them.
 */
export const SUBAGENT_CONTRACT = `## SUBAGENT CONTRACT

You are running as a subagent. You cannot see the calling agent's conversation.

- **You cannot ask questions.** The caller will not read anything before your final message.
  If the instruction is ambiguous, take the most reasonable interpretation, act on it, and say which one you took.
- **Your final message is your only deliverable.** It is read by another agent, not a human.
  No preamble, no "here's what I found". Lead with the answer. Cite \`path:line\` for every factual claim.
- **You are read-only.** Do not propose to write files. Report what should change and where.
- **Every claim must come from a tool call.** If you did not open it, you do not know it — say so instead of guessing.`;

export type SubagentProgressEvent =
    | { phase: "started"; key: string; subRunId: string }
    | { phase: "completed"; key: string; subRunId: string; steps: number; tokenUsage: TokenUsage }
    | { phase: "failed"; key: string; subRunId: string; error: string };

export type RunSubagentResult = {
    text: string;
    subRunId: string;
    steps: number;
    tokenUsage: TokenUsage;
};

/**
 * Tool names a subagent may never hold.
 *
 * `task` is excluded to enforce depth-1 delegation (a subagent spawning
 * subagents is a fork bomb with no upper bound). Write tools are excluded
 * because a subagent has no checkpoint thread, so `interruptBeforeTools` can
 * never fire for it — allowing writes would silently bypass tool approval.
 */
function forbiddenToolsFor(subagent: ResolvedSubagent): Set<string> {
    const forbidden = new Set<string>([...WRITE_REPO_TOOLS, "task"]);
    // `edit_file` is not in WRITE_REPO_TOOLS today but may be added later.
    forbidden.add("edit_file");
    if (!subagent.allowExec) {
        for (const name of EXECUTION_TOOLS) forbidden.add(name);
    }
    return forbidden;
}

/**
 * Wraps `execute_bash` for `allowExec` subagents so it only accepts read-only
 * commands.
 *
 * A subagent's tools are invoked directly, without the executor's approval
 * wrapper — it has no checkpoint thread, so `ToolApprovalPauseError` has nowhere
 * to pause to. Rather than let `allowExec` silently bypass tool approval, the
 * subagent gets the auto-approvable subset and must hand anything else back to
 * the caller, which *does* have an approval path.
 */
function restrictExecTool(tool: any): any {
    const name = String(tool?.name ?? "");
    if (!EXECUTION_TOOLS.has(name)) return tool;

    const original = tool.invoke?.bind(tool);
    if (typeof original !== "function") return tool;

    return Object.assign(Object.create(Object.getPrototypeOf(tool)), tool, {
        invoke: async (input: any, ...rest: any[]) => {
            const command = typeof input?.command === "string" ? input.command : "";
            if (!isSafeCommand(command)) {
                return (
                    `Refused: subagents may only run read-only commands, and \`${command}\` is not one. ` +
                    `Report the command you need back to the calling agent — it can run it with human approval.`
                );
            }
            return original(input, ...rest);
        },
    });
}

function lastAssistantText(messages: any[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const type = String(message?.getType?.() ?? message?.type ?? "").toLowerCase();
        const role = String(message?.role ?? "").toLowerCase();
        if (type === "ai" || type === "assistant" || role === "assistant") {
            const content = message?.content;
            if (typeof content === "string") return content;
            if (Array.isArray(content)) {
                return content
                    .map((block: any) => (typeof block === "string" ? block : block?.text ?? ""))
                    .filter(Boolean)
                    .join("\n");
            }
        }
    }
    return "";
}

/**
 * Runs one subagent to completion in an isolated context window and returns its
 * final text.
 *
 * Isolation is literal: we pass no `extraMessages`, so the subagent's context is
 * exactly `systemPrompt + prompt` — none of the caller's history. That is the
 * whole point of delegating (the caller's context stays small) and it is why the
 * `prompt` must be self-contained.
 */
export async function runSubagent(opts: {
    parentRunId: string;
    subagent: ResolvedSubagent;
    prompt: string;
    description: string;
    index: number;
    workspaceId?: string;
    workspaceRoot: string;
    llmSelection?: Partial<LlmSelection>;
    createdByUserId?: string;
    /** Extra system-prompt block from the resolved harness profile, if any. */
    harnessSuffix?: string;
    abortSignal?: AbortSignal;
    onProgress?: (event: SubagentProgressEvent) => void;
}): Promise<RunSubagentResult> {
    const { subagent, parentRunId } = opts;

    const graph = await agentGraphService.getGraph(subagent.graphId);
    if (!graph?._id) {
        throw new Error(`Subagent "${subagent.key}" points at missing graph ${subagent.graphId}`);
    }

    // Persist as a sub-run: `parentRunId` keeps it out of the session list
    // (agentGraphRunService filters on `parentRunId: { $exists: false }`) while
    // still making it inspectable via `listSubRuns`.
    const subRunId = await agentGraphRunService.createRun(
        subagent.graphId,
        opts.workspaceId,
        "subagent",
        {
            parentRunId,
            stageIndex: opts.index,
            title: opts.description || subagent.label,
            ...(opts.createdByUserId ? { createdByUserId: opts.createdByUserId } : {}),
        }
    );

    const nodeStatuses: Record<string, "PENDING"> = {};
    for (const node of graph.nodes) nodeStatuses[node.id] = "PENDING";
    await agentGraphRunService.updateRunStatus(subRunId, "RUNNING", {
        nodeOrder: getGraphNodeOrder(graph),
        nodeStatuses,
        state: buildInitialState(graph, opts.prompt),
    } as any);

    opts.onProgress?.({ phase: "started", key: subagent.key, subRunId });

    let accumulated: TokenUsage = createEmptyTokenUsage();

    try {
        // Resolve tools through the same workspace gate as the main agent, then
        // subtract everything a subagent must not hold.
        let capabilityToolSet = new Set<string>(subagent.toolNames);
        let externalNamespacedTools: string[] = [];
        if (opts.workspaceId) {
            try {
                const caps = await resolveWorkspaceCapabilities(opts.workspaceId);
                capabilityToolSet = caps.enabledToolSet;
                externalNamespacedTools = [];
            } catch {
                // Fall back to the graph's own allowlist (legacy behaviour).
            }
        }

        const effective = effectiveToolNames({
            nodeToolNames: subagent.toolNames,
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet,
            externalNamespacedTools,
            alwaysOn: [],
        });

        const forbidden = forbiddenToolsFor(subagent);
        const allowedNames = effective.names.filter((name) => !forbidden.has(name));
        const allowed = new Set(allowedNames);
        const tools = allMcpTools
            .filter((tool: any) => allowed.has(String(tool?.name ?? "")))
            .map((tool: any) => (subagent.allowExec ? restrictExecTool(tool) : tool));

        const systemPrompt = [subagent.systemPrompt, opts.harnessSuffix, SUBAGENT_CONTRACT]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join("\n\n");

        const result = await streamReactAgentMessages({
            name: `Subagent:${subagent.key}`,
            systemPrompt,
            userPrompt: opts.prompt,
            tools,
            recursionLimit: subagent.maxSteps,
            llmSelection: opts.llmSelection as LlmSelection | undefined,
            workspaceRoot: opts.workspaceRoot,
            // Context isolation: no caller history is forwarded.
            extraMessages: undefined,
            abortSignal: opts.abortSignal,
            runId: subRunId,
            onTokenUsage: async (usage, model) => {
                accumulated = addTokenUsage(accumulated, usage);
                // Attribute cost to the PARENT run so the thread's token total is
                // honest — a fan-out that costs 400k must not read as 40k.
                await tokenUsageService.logUsage({
                    timestamp: new Date(),
                    provider: (opts.llmSelection?.provider ?? "default") as any,
                    model,
                    usage,
                    runId: new ObjectId(parentRunId),
                    nodeId: `subagent:${subagent.key}:${opts.index}`,
                    callType: "subagent",
                });
            },
        });

        const messages = result.messages ?? [];
        const text = lastAssistantText(messages);
        const steps = messages.length;

        await agentGraphRunService.updateRunStatus(subRunId, "COMPLETED", {
            endedAt: new Date(),
        } as any);
        opts.onProgress?.({
            phase: "completed",
            key: subagent.key,
            subRunId,
            steps,
            tokenUsage: accumulated,
        });

        return { text, subRunId, steps, tokenUsage: accumulated };
    } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        await agentGraphRunService
            .updateRunStatus(subRunId, "FAILED", { endedAt: new Date(), error: message } as any)
            .catch(() => undefined);
        opts.onProgress?.({ phase: "failed", key: subagent.key, subRunId, error: message });
        throw error;
    }
}

/**
 * Bounds how many subagents run at once within a single parent run.
 *
 * LangGraph's ToolNode already dispatches parallel tool calls with `Promise.all`,
 * so without this a model emitting ten `task` calls would open ten concurrent
 * LLM streams.
 */
export class SubagentSemaphore {
    private active = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly limit: number = config.subagents.maxConcurrency) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.limit) {
            await new Promise<void>((resolve) => this.queue.push(resolve));
        }
        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            const next = this.queue.shift();
            if (next) next();
        }
    }
}
