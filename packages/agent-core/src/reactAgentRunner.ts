import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

import { getChatModel, resolveResolvedLlmInfo, type LlmSelection } from "@kletron/server/llm";
import { config } from "@kletron/server/config";
import type { TokenUsage } from "@kletron/server/services/tokenUsageTypes";
import type { AgentWorkflowAbortReason } from "@kletron/shared/types";
import type { AgentStreamKpiV1 } from "@kletron/shared/chatTypes";

export type StreamReactAgentOptions = {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  workspaceRoot?: string;
  llmSelection?: LlmSelection;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  /** Callback for each token usage update from LLM responses */
  onTokenUsage?: (usage: TokenUsage, model: string) => Promise<void> | void;
  /** Callback for progressive text streaming (token-by-token) */
  onTextDelta?: (delta: string) => void;
  /** Callback for reasoning / extended-thinking deltas when the provider exposes them on chunks */
  onReasoningDelta?: (delta: string) => void;
  /** Abort signal to stop streaming mid-run */
  abortSignal?: AbortSignal;
  /** Optional abort reason getter (used when abortSignal triggers) */
  getAbortReason?: () => AgentWorkflowAbortReason | null;
  /** Optional check hook for cooperative aborts */
  shouldAbort?: () => Promise<AgentWorkflowAbortReason | null> | AgentWorkflowAbortReason | null;

  // ── Checkpoint / Persistence ─────────────────────────────────────────
  /** LangGraph checkpoint saver for state persistence & resume. */
  checkpointer?: BaseCheckpointSaver;
  /** Unique thread ID for this execution (required when checkpointer is set). */
  threadId?: string;
  /**
   * If true, interrupt the agent *before* the tools node so the caller
   * can implement human-in-the-loop approval.  Requires a checkpointer.
   */
  interruptBeforeTools?: boolean;
  /**
   * If true, this is a *resume* invocation — the agent will continue from
   * the last checkpoint instead of starting fresh.
   */
  resumeFromCheckpoint?: boolean;
  /** Wall ms already spent in executor before this LLM call (KPI / diagnostics only). */
  upstreamPrepMs?: number;
  /** Client wall clock when the send action was initiated. */
  clientSentAtMs?: number;
  /** Server wall clock when the HTTP request was received. */
  serverRequestReceivedAtMs?: number;
  /** Run id for KPI correlation (optional). */
  runId?: string;
  /** LangGraph recursion limit (tool/model steps). Defaults to server `config.graphRecursionLimit`. */
  recursionLimit?: number;
};

export type StreamReactAgentResult = {
  messages: BaseMessage[];
  tokenUsage: TokenUsage;
  model: string;
  /**
   * True when the stream ended because of a LangGraph interrupt
   * (e.g. `interruptBeforeTools`).  The caller should persist the
   * "INTERRUPTED" status and wait for human approval before resuming.
   */
  interrupted?: boolean;
  /** Timing and throughput for this `streamReactAgentMessages` invocation */
  kpi?: AgentStreamKpiV1;
};

export class AgentWorkflowAbortError extends Error {
  reason: AgentWorkflowAbortReason;

  constructor(reason: AgentWorkflowAbortReason) {
    super(`Agent workflow aborted: ${reason}`);
    this.name = "AgentWorkflowAbortError";
    this.reason = reason;
  }
}

function isAssistantLikeMessage(message: BaseMessage): boolean {
  const t = (message.getType?.() ?? (message as any).type ?? "").toString().toLowerCase();
  const role = String((message as any).role ?? "").toLowerCase();
  return t === "ai" || t === "assistant" || role === "assistant";
}

/** One-line `[AgentStreamKPI]` JSON logs per LLM stream; flip to false to silence. */
const AGENT_STREAM_KPI_CONSOLE = true;

function isAgentStreamKpiLogEnabled(): boolean {
  return AGENT_STREAM_KPI_CONSOLE;
}

function logAgentStreamKpiLine(kpi: AgentStreamKpiV1) {
  if (!isAgentStreamKpiLogEnabled()) return;
  console.info("[AgentStreamKPI]", JSON.stringify(kpi));
}

/**
 * Extract token usage from a LangChain message's usage_metadata.
 * LangChain messages from most providers include this metadata.
 */
/** Best-effort extraction of streamed reasoning text from an AIMessageChunk (provider-dependent). */
function extractReasoningDeltaFromChunk(chunk: any): string {
  if (!chunk || typeof chunk !== "object") return "";
  const ak = chunk.additional_kwargs ?? {};
  const direct =
    chunk.reasoning_content ??
    ak.reasoning_content ??
    ak.reasoning ??
    chunk.reasoning;
  if (typeof direct === "string" && direct.trim()) return direct;

  const content = chunk.content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const t = (block as any).type;
    if (t === "reasoning" || t === "thinking" || t === "redacted_thinking") {
      const text =
        typeof (block as any).text === "string"
          ? (block as any).text
          : typeof (block as any).reasoning === "string"
            ? (block as any).reasoning
            : "";
      if (text) out += text;
    }
  }
  return out;
}

function extractTokenUsage(message: BaseMessage): TokenUsage | null {
  const usageMetadata = (message as any).usage_metadata;
  if (!usageMetadata) return null;

  return {
    inputTokens: usageMetadata.input_tokens ?? usageMetadata.prompt_tokens ?? 0,
    outputTokens: usageMetadata.output_tokens ?? usageMetadata.completion_tokens ?? 0,
    totalTokens: usageMetadata.total_tokens ?? 0,
  };
}

export async function streamReactAgentMessages(
  opts: StreamReactAgentOptions
): Promise<StreamReactAgentResult> {
  const t0 = performance.now();
  const resolvedLlm = await resolveResolvedLlmInfo(opts.llmSelection);
  const model = await getChatModel(opts.llmSelection);
  const modelName = (model as any).modelName ?? (model as any).model ?? "unknown";
  const llmResolveAndModelMs = performance.now() - t0;

  // ── Build createReactAgent params ──────────────────────────────────
  // `@langchain/google-vertexai` ships its own nested @langchain/core; cast the
  // model to break the structural-typing mismatch across that boundary.
  const agentParams: Parameters<typeof createReactAgent>[0] = {
    llm: model as Parameters<typeof createReactAgent>[0]["llm"],
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  };

  // Wire in checkpointer if provided
  if (opts.checkpointer) {
    agentParams.checkpointSaver = opts.checkpointer;
  }
  // Interrupt before the "tools" node for human-in-the-loop
  if (opts.interruptBeforeTools && opts.checkpointer) {
    agentParams.interruptBefore = ["tools"];
  }

  const agent = createReactAgent(agentParams);
  const agentBuildMs = performance.now() - t0;

  // ── Determine input ────────────────────────────────────────────────
  // When resuming from a checkpoint, pass `null` as input so LangGraph
  // continues from the saved state.  Otherwise, construct the message list.
  const isResume = opts.resumeFromCheckpoint && opts.checkpointer && opts.threadId;
  const input = isResume
    ? null
    : { messages: [...(opts.extraMessages ?? []), { role: "user", content: opts.userPrompt }] };

  // Dual-stream LangGraph: ["values","messages"] yields token chunks + state snapshots.
  // We force dual-stream whenever token/reasoning streaming is requested.
  const wantTokenStream = !!(opts.onTextDelta || opts.onReasoningDelta);
  const useMultiMode = wantTokenStream;
  const streamMode = useMultiMode ? (["values", "messages"] as any) : "values";

  // ── Build stream config ────────────────────────────────────────────
  const streamConfig: Record<string, any> = {
    streamMode,
    recursionLimit: opts.recursionLimit ?? config.graphRecursionLimit,
    signal: opts.abortSignal,
  };
  // Thread configuration for checkpoint persistence
  if (opts.threadId) {
    streamConfig.configurable = {
      ...(streamConfig.configurable || {}),
      thread_id: opts.threadId,
      checkpoint_ns: "",
    };
  }
  
  if (opts.workspaceRoot) {
    streamConfig.configurable = {
      ...(streamConfig.configurable || {}),
      workspaceRoot: opts.workspaceRoot,
    };
  }

  // Diagnostic logging for multi-turn debugging
  if (input && (input as any).messages) {
    const msgs = (input as any).messages as any[];
    console.log(`[ReactAgentRunner] Sending ${msgs.length} messages to LLM (name=${opts.name}):`);
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const type = m.getType?.() ?? m.type ?? m.role ?? 'unknown';
      const content = typeof m.content === 'string' ? m.content.slice(0, 80) : JSON.stringify(m.content ?? '').slice(0, 80);
      const tc = m.tool_calls?.length ?? 0;
      const tcId = m.tool_call_id ?? '';
      console.log(`  [${i}] ${type}: "${content}"${tc ? ` (tool_calls=${tc})` : ''}${tcId ? ` (tool_call_id=${tcId})` : ''}`);
    }
  } else {
    console.log(`[ReactAgentRunner] Input is ${input === null ? 'null (resume)' : 'empty'} (name=${opts.name})`);
  }

  const llmDispatchWallClockMs = Date.now();
  const clientSendToLlmDispatchMs =
    typeof opts.clientSentAtMs === "number" ? Math.max(0, llmDispatchWallClockMs - opts.clientSentAtMs) : undefined;
  const serverRequestToLlmDispatchMs =
    typeof opts.serverRequestReceivedAtMs === "number"
      ? Math.max(0, llmDispatchWallClockMs - opts.serverRequestReceivedAtMs)
      : undefined;
  const stream = await agent.stream(
    input as any,
    streamConfig,
  );
  const streamOpenMs = performance.now() - t0;

  let firstStreamEventMs: number | null = null;
  let firstTextDeltaMs: number | null = null;
  let firstReasoningDeltaMs: number | null = null;
  let firstAssistantOnMessageMs: number | null = null;
  let outputDeltaChars = 0;
  let firstStreamWallClock: number | null = null;
  const streamLoopWallStart = performance.now();

  /** Last plain text seen per LangGraph message id — used for values-only streaming deltas. */
  const lastStreamedAssistantTextByIdKey = new Map<string, string>();

  const assistantPlainText = (message: BaseMessage): string => {
    const c = message.content as unknown;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      return c
        .map((b: { text?: string }) => (typeof b?.text === "string" ? b.text : ""))
        .join("");
    }
    return "";
  };

  const seenMessageIds = new Set<string>();
  const seenUsageIds = new Set<string>(); // Track which messages we've extracted usage from
  const accumulatedMessages: BaseMessage[] = [];

  // Content-based fingerprint dedup — catches duplicates even when
  // LangGraph reassigns or transforms message IDs internally.
  const seenContentFingerprints = new Set<string>();
  const contentFingerprint = (message: BaseMessage): string => {
    const type = message.getType?.() ?? (message as any).role ?? "unknown";
    const content = typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "");
    const toolCalls = (message as any).tool_calls;
    const toolCallId = (message as any).tool_call_id ?? "";
    // Include tool_call info to distinguish tool-call AI messages from pure text ones
    const tcSuffix = toolCalls?.length ? `:tc=${toolCalls.map((t: any) => t.name).join(",")}` : "";
    const tcIdSuffix = toolCallId ? `:tcid=${toolCallId}` : "";
    return `${type}:${content.slice(0, 500)}${tcSuffix}${tcIdSuffix}`;
  };

  // Seed with extra messages to perform correct deduplication of historical multi-turn data
  if (opts.extraMessages && opts.extraMessages.length > 0) {
    for (const msg of opts.extraMessages) {
      if (typeof msg.id === "string") {
        seenMessageIds.add(msg.id);
        seenUsageIds.add(msg.id);
      }
      seenContentFingerprints.add(contentFingerprint(msg));
      accumulatedMessages.push(msg);
    }
  }

  let lastState: { messages?: BaseMessage[] } | undefined;

  // Accumulated token usage across all messages
  const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  const shouldEmitToCallback = (message: BaseMessage) => {
    const messageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
    const role = typeof (message as any).role === "string" ? String((message as any).role).toLowerCase() : "";
    // UI already knows the user prompt; emitting it again causes duplicates.
    if (messageType === "human" || role === "user" || role === "human") return false;
    // System prompt is configured out-of-band; avoid duplicating it in event streams.
    if (messageType === "system" || role === "system") return false;
    return true;
  };

  const checkAbort = async () => {
    if (opts.abortSignal?.aborted) {
      const reason = opts.getAbortReason?.() ?? "PAUSED";
      throw new AgentWorkflowAbortError(reason);
    }
    if (opts.shouldAbort) {
      const reason = await opts.shouldAbort();
      if (reason) {
        throw new AgentWorkflowAbortError(reason);
      }
    }
  };

  /** Process a complete state snapshot (from "values" mode). */
  const processValuesState = async (stateData: { messages?: BaseMessage[] }) => {
    if (!Array.isArray(stateData.messages)) return;
    lastState = stateData;

    for (const message of stateData.messages) {
      await checkAbort();
      const idKey =
        typeof message.id === "string"
          ? message.id
          : `${(message as any).role ?? "unknown"}-${typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "")}-${accumulatedMessages.length}`;

      // Check content fingerprint as a secondary dedup (catches ID reassignment)
      const fp = contentFingerprint(message);
      const isKnownByContent = seenContentFingerprints.has(fp);

      // Process message for event stream
      if (!seenMessageIds.has(idKey) && !isKnownByContent) {
        seenMessageIds.add(idKey);
        seenContentFingerprints.add(fp);
        accumulatedMessages.push(message);
        if (opts.onMessage) {
          if (shouldEmitToCallback(message)) {
            if (firstAssistantOnMessageMs === null && isAssistantLikeMessage(message)) {
              firstAssistantOnMessageMs = performance.now() - t0;
            }
            await opts.onMessage(message);
          }
        }
        // Values-only / dual-stream off: track assistant text so growing snapshots emit onTextDelta.
        // Emit the full plaintext on the first snapshot too: previously we only seeded the map, so if
        // the first values event already contained visible text (or only one snapshot arrived), the
        // client never saw text_delta and the bubble stayed empty until a later growing snapshot.
        if (!useMultiMode && opts.onTextDelta && isAssistantLikeMessage(message)) {
          const tc = (message as any).tool_calls?.length ?? 0;
          if (!tc) {
            const full = assistantPlainText(message);
            lastStreamedAssistantTextByIdKey.set(idKey, full);
            if (full) {
              opts.onTextDelta(full);
              outputDeltaChars += full.length;
            }
          }
        }
      } else if (
        seenMessageIds.has(idKey) &&
        !useMultiMode &&
        opts.onMessage &&
        shouldEmitToCallback(message) &&
        isAssistantLikeMessage(message)
      ) {
        const tc = (message as any).tool_calls?.length ?? 0;
        if (!tc) {
          const nextText = assistantPlainText(message);
          const prevText = lastStreamedAssistantTextByIdKey.get(idKey) ?? "";
          if (nextText.length > prevText.length && nextText.startsWith(prevText)) {
            const delta = nextText.slice(prevText.length);
            if (delta && opts.onTextDelta) {
              opts.onTextDelta(delta);
              outputDeltaChars += delta.length;
            }
            lastStreamedAssistantTextByIdKey.set(idKey, nextText);
            await opts.onMessage(message);
          }
        }
      } else if (!seenMessageIds.has(idKey)) {
        // Content was already seen but ID is new — still track the ID
        // to avoid redundant checks on next snapshot
        seenMessageIds.add(idKey);
      }

      // Extract token usage (only once per message)
      if (!seenUsageIds.has(idKey)) {
        const usage = extractTokenUsage(message);
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0 || usage.totalTokens > 0)) {
          seenUsageIds.add(idKey);

          totalUsage.inputTokens += usage.inputTokens;
          totalUsage.outputTokens += usage.outputTokens;
          totalUsage.totalTokens += usage.totalTokens;

          if (opts.onTokenUsage) {
            await opts.onTokenUsage(usage, modelName);
          }
        }
      }
    }
  };

  try {
    for await (const rawEvent of stream) {
      await checkAbort();
      if (!rawEvent || typeof rawEvent !== "object") continue;
      if (firstStreamWallClock === null) {
        firstStreamWallClock = performance.now();
        firstStreamEventMs = firstStreamWallClock - t0;
      }

      if (useMultiMode && Array.isArray(rawEvent)) {
        // Multi-mode: [mode, data] tuple
        const [mode, data] = rawEvent as unknown as [string, any];

        if (mode === "messages") {
          // Token-level chunk: data is [AIMessageChunk, metadata]
          const chunk = Array.isArray(data) ? data[0] : data;
          const content = typeof chunk?.content === "string" ? chunk.content : "";
          const reasoning = extractReasoningDeltaFromChunk(chunk);
          if (reasoning && opts.onReasoningDelta) {
            if (firstReasoningDeltaMs === null) {
              firstReasoningDeltaMs = performance.now() - t0;
            }
            opts.onReasoningDelta(reasoning);
          }
          // Only emit text deltas for non-tool-call assistant chunks
          if (
            content &&
            opts.onTextDelta &&
            !chunk?.tool_calls?.length &&
            !chunk?.tool_call_chunks?.length
          ) {
            if (firstTextDeltaMs === null) {
              firstTextDeltaMs = performance.now() - t0;
            }
            outputDeltaChars += content.length;
            opts.onTextDelta(content);
          }
        } else if (mode === "values") {
          await processValuesState(data as { messages?: BaseMessage[] });
        }
      } else {
        // Single-mode ("values"): rawEvent is the state directly
        await processValuesState(rawEvent as { messages?: BaseMessage[] });
      }
    }
  } catch (error) {
    if (opts.abortSignal?.aborted) {
      const reason = opts.getAbortReason?.() ?? "PAUSED";
      throw new AgentWorkflowAbortError(reason);
    }
    throw error;
  }

  const streamLoopMs = performance.now() - streamLoopWallStart;
  const approxOutputTokensFromChars = Math.max(0, Math.round(outputDeltaChars / 4));
  const outTok = totalUsage.outputTokens;
  const genWindowMs = firstStreamWallClock !== null ? performance.now() - firstStreamWallClock : null;
  const secLoop = streamLoopMs > 0 ? streamLoopMs / 1000 : 0;
  const secGen = genWindowMs !== null && genWindowMs > 0 ? genWindowMs / 1000 : 0;
  const effectiveOutputTps = outTok > 0 && secLoop > 0 ? outTok / secLoop : null;
  const effectiveOutputTpm = effectiveOutputTps !== null ? effectiveOutputTps * 60 : null;
  const generationTps =
    outTok > 0 && secGen > 0 ? outTok / secGen : approxOutputTokensFromChars > 0 && secGen > 0 ? approxOutputTokensFromChars / secGen : null;
  const generationTpm = generationTps !== null ? generationTps * 60 : null;

  const candidates = [firstTextDeltaMs, firstReasoningDeltaMs, firstAssistantOnMessageMs].filter(
    (x): x is number => typeof x === "number"
  );
  const timeToFirstVisibleMs = candidates.length ? Math.min(...candidates) : null;

  const finalMessages = lastState?.messages ?? accumulatedMessages;

  const toolCallCount = finalMessages.filter((m) => {
    const t = (m.getType?.() ?? (m as any).type ?? "").toString().toLowerCase();
    return t === "tool";
  }).length;

  const kpi: AgentStreamKpiV1 = {
    v: 1,
    runId: opts.runId,
    agentName: opts.name,
    provider: resolvedLlm.provider,
    model: modelName,
    streamMode: useMultiMode ? "values_messages" : "values",
    llmResolveAndModelMs,
    agentBuildMs,
    streamOpenMs,
    firstStreamEventMs,
    firstTextDeltaMs,
    firstReasoningDeltaMs,
    firstAssistantOnMessageMs,
    timeToFirstVisibleMs,
    streamLoopMs,
    generationWindowMs: genWindowMs,
    outputDeltaChars,
    outputTokensFromUsage: outTok,
    approxOutputTokensFromChars,
    effectiveOutputTps,
    effectiveOutputTpm,
    generationTps,
    generationTpm,
    upstreamPrepMs: opts.upstreamPrepMs,
    clientSendToLlmDispatchMs,
    serverRequestToLlmDispatchMs,
    toolCallCount,
  };

  logAgentStreamKpiLine(kpi);

  // ── Detect interrupt ─────────────────────────────────────────────
  // When `interruptBeforeTools` is active, the stream ends normally but
  // the last AI message has pending tool_calls that were never executed.
  // We surface this as `interrupted: true` so the caller can handle it.
  let interrupted = false;
  if (opts.interruptBeforeTools && opts.checkpointer && opts.threadId) {
    const lastMsg = finalMessages.at(-1);
    const hasPendingToolCalls =
      lastMsg &&
      (lastMsg as any).tool_calls?.length > 0 &&
      !finalMessages.some(
        (m) =>
          m.getType?.() === "tool" &&
          (lastMsg as any).tool_calls?.some(
            (tc: any) => tc.id && (m as any).tool_call_id === tc.id
          )
      );
    if (hasPendingToolCalls) {
      interrupted = true;
    }
  }

  return {
    messages: finalMessages,
    tokenUsage: totalUsage,
    model: modelName,
    interrupted,
    kpi,
  };
}
