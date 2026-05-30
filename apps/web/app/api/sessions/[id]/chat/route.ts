export const dynamic = "force-dynamic";
import { resolveLlmSelection } from "@kletron/server/llm";
import type { AgentWorkflowResult, AgentWorkflowUpdate } from "@kletron/shared/types";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { agentGraphRunService } from "@kletron/server/services/agentGraphRunService";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";
import { categoryService } from "@kletron/server/services/categoryService";
import { agentGraphExecutor } from "@kletron/server/services/agentGraphExecutor";
import type { AgentStreamKpiV1 } from "@kletron/shared/chatTypes";
import { buildThreadSkillState } from "@kletron/server/services/workspaceSkillStateService";
import { applySkillSlashPreflight, mergeLoadedSkillIds } from "@kletron/server/services/skillSlashPreflight";
import { codexExecutionService, type CodexSandboxMode } from "@kletron/server/services/codexExecutionService";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";

const textEncoder = new TextEncoder();
const CODEX_BACKEND = "codex";

type StreamChunk =
  | {
      type: "init";
      payload: {
        runId: string;
        graphId: string;
        skills?: Awaited<ReturnType<typeof buildThreadSkillState>>;
        turnAnchorMessage?: string;
      };
    }
  | { type: "update"; payload: AgentWorkflowUpdate }
  | { type: "text_delta"; payload: { content: string } }
  | { type: "reasoning_delta"; payload: { content: string } }
  | { type: "stream_metrics"; payload: AgentStreamKpiV1 }
  | { type: "final"; payload: AgentWorkflowResult }
  | { type: "error"; payload: { message: string } };

function parseExecutionBackend(input: unknown, provider?: string): "langgraph" | "codex" {
  if (typeof provider === "string" && provider.trim().toLowerCase() === CODEX_BACKEND) return CODEX_BACKEND;
  return input === CODEX_BACKEND ? CODEX_BACKEND : "langgraph";
}

function parseCodexModel(payload: Record<string, unknown>, fallback?: string): string | undefined {
  const fromBody = typeof payload.codexModel === "string" ? payload.codexModel.trim() : "";
  if (fromBody) return fromBody;
  const fromModel = typeof payload.model === "string" ? payload.model.trim() : "";
  if (fromModel) return fromModel;
  return fallback?.trim() || undefined;
}

function parseCodexSandboxMode(input: unknown, fallback: CodexSandboxMode = "read-only"): CodexSandboxMode {
  if (input === "workspace-write") return "workspace-write";
  if (input === "danger-full-access") return "danger-full-access";
  if (input === "read-only") return "read-only";
  return fallback;
}

function buildCodexPlaceholderOutputs(mission: string, report: string): AgentWorkflowResult["outputs"] {
  return {
    context: { mission, languages: [], frameworks: [], hotspots: [] },
    target_files: [],
    raw_claims: [],
    verified_findings: [],
    findings: [],
    tasks: [],
    report,
    meta: {},
  };
}

function resolveCodexRunStatus(input: string, hasError: boolean): "COMPLETED" | "FAILED" | "CANCELLED" {
  const normalized = input.toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("interrupt")) return "CANCELLED";
  if (hasError || normalized.includes("fail") || normalized.includes("error")) return "FAILED";
  return "COMPLETED";
}

/**
 * POST /api/sessions/[id]/chat - Continue a session with a follow-up message.
 * Streams NDJSON updates using the multi-turn continueRun method.
 * Body: { message: string, provider?: string, model?: string }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  console.log(`[sessions/chat] ▶ POST /api/sessions/${params.id}/chat`);
  const serverRequestReceivedAtMs = Date.now();

  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    console.log(`[sessions/chat] ✗ Unauthorized`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const provider = typeof payload?.provider === "string" ? payload.provider.trim() : undefined;
  const model = typeof payload?.model === "string" ? payload.model.trim() : undefined;
  const requestedExecutionBackend = parseExecutionBackend(payload?.executionBackend, provider);
  const clientSentAtMs =
    typeof payload?.clientSentAtMs === "number" && Number.isFinite(payload.clientSentAtMs)
      ? payload.clientSentAtMs
      : undefined;
  const llmSelection = provider ? resolveLlmSelection({ provider, model }) : undefined;

  console.log(`[sessions/chat] message="${message.slice(0, 40)}", provider=${provider}, model=${model}`);

  if (!message) {
    return new Response(JSON.stringify({ error: "Please provide a message." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const run = await agentGraphRunService.getRun(params.id);
  if (!run) {
    console.log(`[sessions/chat] ✗ Session not found: ${params.id}`);
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[sessions/chat] Run status="${run.status}", startedAt=${run.startedAt}, endedAt=${run.endedAt}, graphId=${run.graphId}`);

  // Allow continuing completed, failed, paused, or cancelled runs directly.
  // For any other status (RUNNING, PENDING): if they've been in that state for
  // > 5 seconds, consider them stale and force-complete them so the user can
  // continue the conversation.
  const STALE_RUN_MS = 5 * 1000; // 5 seconds (reduced from 30s for better UX)
  const allowedStatuses = ["COMPLETED", "FAILED", "PAUSED", "CANCELLED"];

  if (!allowedStatuses.includes(run.status)) {
    const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    const runAge = Date.now() - startedAt;
    console.log(`[sessions/chat] Non-allowed status "${run.status}", age=${Math.round(runAge / 1000)}s, stale threshold=${STALE_RUN_MS / 1000}s`);

    if (runAge > STALE_RUN_MS) {
      // Force-complete the stale run so the user can continue
      console.warn(`[sessions/chat] ⚠ Force-completing stale run ${params.id} (status="${run.status}", running for ${Math.round(runAge / 1000)}s)`);
      try {
        await agentGraphRunService.updateRunStatus(params.id, "COMPLETED", {
          endedAt: new Date(),
        } as any);
        console.log(`[sessions/chat] ✓ Force-completed run ${params.id}`);
      } catch (err) {
        console.error(`[sessions/chat] ✗ Failed to force-complete run ${params.id}:`, err);
        return new Response(JSON.stringify({ error: "Failed to recover stale session. Try creating a new one." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`[sessions/chat] ✗ Returning 409 — session is actively running (age ${Math.round(runAge / 1000)}s < ${STALE_RUN_MS / 1000}s)`);
      return new Response(JSON.stringify({ error: "Session is still running. Wait for it to complete." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.log(`[sessions/chat] ✓ Status "${run.status}" is allowed, proceeding with continuation`);
  }

  const graphId = run.graphId?.toString() ?? "";
  const executionBackend =
    requestedExecutionBackend === "codex" ? "codex" : run.executionBackend === "codex" ? "codex" : "langgraph";
  const workspaceId = run.workspaceId?.toString() ?? "";
  const graph = graphId ? await agentGraphService.getGraph(graphId) : null;
  const slashPreflight = workspaceId
    ? await applySkillSlashPreflight(message, workspaceId)
    : { mission: message, loadedSkillIdsToAppend: [] };
  const predictedSlashLoads = slashPreflight.loadedSkillIdsToAppend.filter(
    (skillId) => !(((run.state?.loadedSkillIds as string[] | undefined) ?? []).includes(skillId)),
  );
  const threadSkills = workspaceId
    ? await buildThreadSkillState({
        workspaceId,
        graph,
        state: {
          loadedSkillIds: mergeLoadedSkillIds(run.state?.loadedSkillIds, predictedSlashLoads),
          skillLoads: [
            ...((run.state?.skillLoads as Array<{ slug: string; at: string; reason?: string }> | undefined) ?? []),
            ...predictedSlashLoads.map((slug) => ({
              slug,
              at: new Date().toISOString(),
              reason: "slash_preflight",
            })),
          ],
        },
      }).catch(() => ({
        availableSkills: [],
        loadedSkills: [],
        pinnedSkills: [],
      }))
    : { availableSkills: [], loadedSkills: [], pinnedSkills: [] };

  /**
   * Do not retag an existing run's work mode from every chat continuation — that blurred Code vs Work.
   * Only patch run + workspace current category when the client explicitly opts in (`alignWorkMode: true`).
   * New sessions set workMode via POST /api/sessions.
   */
  const alignWorkMode = payload.alignWorkMode === true;
  const modePayload =
    typeof payload.workMode === "string"
      ? payload.workMode
      : typeof payload.category === "string"
        ? payload.category
        : null;
  if (alignWorkMode && modePayload !== null) {
    const wm = normalizeToWorkModeId(modePayload);
    await agentGraphRunService.patchRun(params.id, { workMode: wm });
    if (auth.userId && run.workspaceId) {
      await categoryService.setCurrentCategory(auth.userId, wm, run.workspaceId.toString());
    }
  }

  // Track client disconnect via the request abort signal
  let clientDisconnected = false;
  request.signal?.addEventListener("abort", () => {
    clientDisconnected = true;
  });

  if (executionBackend === "codex") {
    let workspace;
    try {
      workspace = await resolveWorkspaceFromRequestStrict(
        request,
        auth.userId,
        workspaceId ? ({ workspaceId } as Record<string, unknown>) : (payload as Record<string, unknown>),
      );
    } catch (error) {
      const workspaceError = workspaceErrorToHttp(error);
      if (workspaceError) {
        return new Response(JSON.stringify(workspaceError.body), {
          status: workspaceError.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }
    if (!workspace || !workspace._id || !workspace.rootPath) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const codexWorkspaceId = workspace._id.toString();
    const codexModel = parseCodexModel(payload as Record<string, unknown>, run.codexModel);
    const codexSandboxMode = parseCodexSandboxMode(payload?.codexSandboxMode, run.codexSandboxMode ?? "read-only");
    const mergedLoadedSkillIds = mergeLoadedSkillIds(run.state?.loadedSkillIds, predictedSlashLoads);
    const mergedSkillLoads = [
      ...((run.state?.skillLoads as Array<{ slug: string; at: string; reason?: string }> | undefined) ?? []),
      ...predictedSlashLoads.map((slug) => ({
        slug,
        at: new Date().toISOString(),
        reason: "slash_preflight",
      })),
    ];
    const preparedState = {
      ...(run.state ?? {}),
      loadedSkillIds: mergedLoadedSkillIds,
      skillLoads: mergedSkillLoads,
    };

    await agentGraphRunService.updateRunStatus(params.id, "RUNNING", {
      state: preparedState,
      executionBackend: "codex",
      codexApprovalState: run.codexApprovalState ?? { hasPending: false, pendingCount: 0, updatedAt: new Date().toISOString() },
      ...(codexModel ? { codexModel } : {}),
      codexSandboxMode,
    } as any);

    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (chunk: StreamChunk) => {
          if (clientDisconnected) return;
          try {
            controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
          } catch {
            clientDisconnected = true;
          }
        };
        sendChunk({
          type: "init",
          payload: {
            runId: params.id,
            graphId,
            skills: threadSkills,
            turnAnchorMessage: slashPreflight.mission,
          },
        });

        try {
          const turn = await codexExecutionService.startTurnStream({
            runId: params.id,
            userId: auth.userId,
            message: slashPreflight.mission,
            cwd: workspace.rootPath,
            workspaceId: codexWorkspaceId,
            ...(codexModel ? { model: codexModel } : {}),
            threadId: run.codexThreadId ?? null,
            sandboxMode: codexSandboxMode,
          });
          await codexExecutionService.registerRunMetadata(params.id, {
            executionBackend: "codex",
            codexThreadId: turn.threadId,
            codexTurnId: turn.turnId,
            ...(codexModel ? { codexModel } : {}),
            codexSandboxMode,
          });

          for await (const event of turn.events) {
            if (event.kind === "event_snapshot") {
              sendChunk({
                type: "update",
                payload: {
                  timeline: [],
                  eventStream: event.events,
                },
              });
              continue;
            }
            if (event.kind === "notification") {
              if (event.method === "item/agentMessage/delta") {
                const delta = typeof event.params?.delta === "string" ? event.params.delta : "";
                if (delta) sendChunk({ type: "text_delta", payload: { content: delta } });
                continue;
              }
              if (event.method === "item/reasoning/textDelta" || event.method === "item/reasoning/summaryTextDelta") {
                const delta = typeof event.params?.delta === "string" ? event.params.delta : "";
                if (delta) sendChunk({ type: "reasoning_delta", payload: { content: delta } });
                continue;
              }
            } else if (event.kind === "error") {
              sendChunk({ type: "error", payload: { message: event.message } });
            }
          }

          const completed = await turn.completed;
          const latestRun = await agentGraphRunService.getRun(params.id);
          const previousHistory = Array.isArray(latestRun?.state?.conversationHistory)
            ? (latestRun?.state?.conversationHistory as any[])
            : [];
          const status = resolveCodexRunStatus(completed.status, Boolean(completed.error));
          const nextState = {
            ...(latestRun?.state ?? preparedState),
            conversationHistory: [...previousHistory, ...completed.events],
            loadedSkillIds: mergedLoadedSkillIds,
            skillLoads: mergedSkillLoads,
          };
          await agentGraphRunService.updateRunStatus(params.id, status, {
            endedAt: new Date(),
            state: nextState,
            executionBackend: "codex",
            conversationTurns: (latestRun?.conversationTurns ?? run.conversationTurns ?? 1) + 1,
            codexThreadId: completed.threadId,
            codexTurnId: completed.turnId,
            ...(completed.error ? { error: completed.error } : {}),
          } as any);

          const result: AgentWorkflowResult = {
            sessionId: params.id,
            timeline: [],
            conclusion: completed.agentText || completed.error || "Codex turn completed.",
            outputs: buildCodexPlaceholderOutputs(slashPreflight.mission, completed.agentText || completed.error || ""),
            eventStream: completed.events,
          };
          sendChunk({ type: "final", payload: result });
        } catch (error: unknown) {
          const message = (error as Error)?.message ?? "Codex execution failed";
          sendChunk({ type: "error", payload: { message } });
          if (!clientDisconnected) {
            await agentGraphRunService.updateRunStatus(params.id, "FAILED", {
              endedAt: new Date(),
              error: message,
            } as any).catch(() => {});
          }
        } finally {
          if (clientDisconnected) {
            await codexExecutionService.stopRun(params.id).catch(() => undefined);
          }
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (chunk: StreamChunk) => {
        if (clientDisconnected) return;
        try {
          controller.enqueue(textEncoder.encode(`${JSON.stringify(chunk)}\n`));
        } catch {
          clientDisconnected = true;
        }
      };
      sendChunk({
        type: "init",
        payload: {
          runId: params.id,
          graphId,
          skills: threadSkills,
          turnAnchorMessage: slashPreflight.mission,
        },
      });
      console.log(`[sessions/chat] Stream started for run ${params.id}`);

      try {
        console.log(`[sessions/chat] Calling continueRun for ${params.id}...`);
        const result = await agentGraphExecutor.continueRun(params.id, message, {
          workspaceContextUserId: auth.userId,
          onUpdate: async (update) => {
            sendChunk({ type: "update", payload: update });
          },
          onTextDelta: (content) => {
            sendChunk({ type: "text_delta", payload: { content } });
          },
          onReasoningDelta: (content) => {
            sendChunk({ type: "reasoning_delta", payload: { content } });
          },
          onLlmStreamKpi: (kpi) => {
            sendChunk({ type: "stream_metrics", payload: kpi });
          },
          clientSentAtMs,
          serverRequestReceivedAtMs,
          ...(llmSelection ? { llmSelectionOverride: llmSelection } : {}),
        });
        console.log(`[sessions/chat] ✓ continueRun completed for ${params.id}`);
        sendChunk({ type: "final", payload: result });
      } catch (error: unknown) {
        console.error(`[sessions/chat] ✗ continueRun error for ${params.id}:`, (error as Error)?.message);
        sendChunk({
          type: "error",
          payload: { message: (error as Error)?.message ?? "Internal agent failure." },
        });
        if (!clientDisconnected) {
          await agentGraphRunService.updateRunStatus(params.id, "FAILED", {
            endedAt: new Date(),
            error: (error as Error)?.message ?? "Internal failure",
          } as any).catch(() => {});
        }
      } finally {
        console.log(`[sessions/chat] Stream ended for ${params.id} (clientDisconnected=${clientDisconnected})`);
        if (clientDisconnected) {
          const currentRun = await agentGraphRunService.getRun(params.id);
          if (currentRun && currentRun.status === "RUNNING") {
            console.warn(`[sessions/chat] Client disconnected, force-completing run ${params.id}`);
            await agentGraphRunService.updateRunStatus(params.id, "COMPLETED", {
              endedAt: new Date(),
            } as any).catch(() => {});
          }
        }
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
