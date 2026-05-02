import type { AgentWorkflowResult } from "@kletron/shared/types";
import type { NormalizedInboundEvent } from "@kletron/shared/channelTypes";
import { channelRunSource } from "@kletron/shared/channelTypes";
import { parseThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { agentGraphExecutor } from "./agentGraphExecutor";
import { agentGraphRunService } from "./agentGraphRunService";
import { agentGraphService } from "./agentGraphService";
import { buildInitialState, getGraphNodeOrder } from "./agentGraphRuntime";
import { channelChatContextService } from "./channelChatContextService";
import { resolveChannelRouting } from "./channelResolverService";
import { buildChannelSessionKey, channelStoreService } from "./channelStoreService";
import { getWorkspaceByIdUnsafe } from "./workspaceService";

/** @deprecated Use resolveTelegramBotCredentials + DB; kept for type re-exports. */
export type TelegramChannelEnvConfig = {
    botToken: string;
    workspaceId: string;
    graphId: string;
    webhookSecret?: string;
};

export function getTelegramChannelEnvConfig(): TelegramChannelEnvConfig | null {
    const botToken = process.env.CHANNEL_TELEGRAM_BOT_TOKEN?.trim();
    const workspaceId = process.env.CHANNEL_TELEGRAM_WORKSPACE_ID?.trim();
    const graphId = process.env.CHANNEL_TELEGRAM_GRAPH_ID?.trim();
    const webhookSecret = process.env.CHANNEL_TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!botToken || !workspaceId || !graphId) return null;
    return { botToken, workspaceId, graphId, ...(webhookSecret ? { webhookSecret } : {}) };
}

function defaultChannelThreadApprovalMode() {
    return parseThreadApprovalMode("confirm_everything");
}

export function formatWorkflowReply(result: AgentWorkflowResult): string {
    const conclusion = typeof result.conclusion === "string" ? result.conclusion.trim() : "";
    const report = result.outputs?.report;
    let reportText = "";
    if (typeof report === "string") {
        reportText = report.trim();
    } else if (report && typeof report === "object") {
        const r = report as { markdown?: string; summary?: string; json?: string };
        reportText = (r.markdown ?? r.summary ?? r.json ?? "").trim();
    }
    const text = reportText || conclusion;
    if (text.length > 4000) {
        return `${text.slice(0, 3997)}...`;
    }
    return text || "(No response text.)";
}

export type ChannelProcessResult =
    | { ok: true; replyText: string; runId: string }
    | {
          ok: false;
          reason:
              | "duplicate"
              | "not_configured"
              | "invalid_workspace"
              | "no_graph"
              | "not_linked"
              | "no_workspace"
              | "channel_disabled"
              | "error";
          message?: string;
      };

/**
 * Idempotent entry: claims inbound message id, then runs the agent turn.
 */
export async function processChannelInbound(event: NormalizedInboundEvent): Promise<ChannelProcessResult> {
    const claimed = await channelStoreService.tryClaimInboundMessage(event.channel, event.inboundMessageId);
    if (!claimed) {
        return { ok: false, reason: "duplicate" };
    }
    return runChannelAgentTurn(event);
}

/**
 * Runs the agent after dedup has been applied (or skipped by caller).
 */
export async function runChannelAgentTurn(event: NormalizedInboundEvent): Promise<ChannelProcessResult> {
    if (event.channel !== "telegram") {
        return { ok: false, reason: "not_configured", message: `Channel ${event.channel} not wired yet.` };
    }

    const routing = await resolveChannelRouting({
        channel: event.channel,
        externalChatKey: event.externalChatKey,
        externalUserId: event.externalUserId,
    });

    if (!routing.ok) {
        return {
            ok: false,
            reason: routing.reason,
            message: routing.message,
        };
    }

    const { workspaceId, graphId, actingUserId } = routing.data;

    const workspace = await getWorkspaceByIdUnsafe(workspaceId);
    if (!workspace || !workspace._id) {
        return { ok: false, reason: "invalid_workspace" };
    }

    let graph = await agentGraphService.getGraph(graphId);
    if (!graph) {
        const all = await agentGraphService.listGraphs();
        graph = all[0] ?? null;
        if (!graph) {
            return { ok: false, reason: "no_graph", message: "No agent graph available." };
        }
    }
    const resolvedGraphId = graph._id!.toString();

    await channelChatContextService.upsertContext({
        channel: event.channel,
        externalChatKey: event.externalChatKey,
        externalUserId: event.externalUserId,
        kletronUserId: routing.data.kletronUserId,
        activeWorkspaceId: workspaceId,
    });

    const sessionKey = buildChannelSessionKey(workspaceId, event.channel, event.externalChatKey);
    const existingRunId = await channelStoreService.getRunIdForSession(sessionKey);

    const threadMode = defaultChannelThreadApprovalMode();
    const source = channelRunSource(event.channel);

    let accumulated = "";
    const onTextDelta = (d: string) => {
        accumulated += d;
    };

    try {
        if (!existingRunId) {
            const nodeOrder = getGraphNodeOrder(graph as any);
            const runId = await agentGraphRunService.createRun(resolvedGraphId, workspaceId, source, {
                threadApprovalMode: threadMode,
            });
            const initialNodeStatuses: Record<string, any> = {};
            for (const node of graph.nodes) {
                initialNodeStatuses[node.id] = "PENDING";
            }
            const title = event.text.trim().slice(0, 80);
            await agentGraphRunService.updateRunStatus(runId, "RUNNING", {
                nodeOrder,
                nodeStatuses: initialNodeStatuses,
                state: buildInitialState(graph as any, event.text),
                title,
                conversationTurns: 1,
            } as any);

            await channelStoreService.upsertSession({
                sessionKey,
                runId,
                workspaceId,
                channel: event.channel,
                externalChatKey: event.externalChatKey,
            });

            const result = await agentGraphExecutor.executeRunStreaming(runId, {
                workspaceContextUserId: actingUserId,
                onTextDelta,
            });

            const replyText = accumulated.trim() || formatWorkflowReply(result);
            return { ok: true, replyText, runId };
        }

        accumulated = "";
        const result = await agentGraphExecutor.continueRun(existingRunId, event.text, {
            workspaceContextUserId: actingUserId,
            onTextDelta,
        });

        const replyText = accumulated.trim() || formatWorkflowReply(result);
        return { ok: true, replyText, runId: existingRunId };
    } catch (e) {
        console.error("[ChannelGateway] processChannelInbound:", (e as Error)?.message ?? e);
        return {
            ok: false,
            reason: "error",
            message: (e as Error)?.message ?? String(e),
        };
    }
}

