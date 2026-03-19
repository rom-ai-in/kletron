import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

import { getChatModel, type LlmSelection } from "@kletron/server/llm";
import { config } from "@kletron/server/config";
import type { TokenUsage } from "@kletron/server/services/tokenUsageTypes";
import type { AgentWorkflowAbortReason } from "@kletron/shared/types";

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
};

export class AgentWorkflowAbortError extends Error {
  reason: AgentWorkflowAbortReason;

  constructor(reason: AgentWorkflowAbortReason) {
    super(`Agent workflow aborted: ${reason}`);
    this.name = "AgentWorkflowAbortError";
    this.reason = reason;
  }
}

/**
 * Extract token usage from a LangChain message's usage_metadata.
 * LangChain messages from most providers include this metadata.
 */
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
  const model = await getChatModel(opts.llmSelection);
  const modelName = (model as any).modelName ?? (model as any).model ?? "unknown";

  // ── Build createReactAgent params ──────────────────────────────────
  const agentParams: Parameters<typeof createReactAgent>[0] = {
    llm: model,
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

  // ── Determine input ────────────────────────────────────────────────
  // When resuming from a checkpoint, pass `null` as input so LangGraph
  // continues from the saved state.  Otherwise, construct the message list.
  const isResume = opts.resumeFromCheckpoint && opts.checkpointer && opts.threadId;
  const input = isResume
    ? null
    : { messages: [...(opts.extraMessages ?? []), { role: "user", content: opts.userPrompt }] };

  // Use multi-mode streaming when onTextDelta is provided to get token-by-token output.
  // With ["values", "messages"], the stream yields [mode, data] tuples:
  //   ["values", { messages: BaseMessage[] }]   — complete state snapshots
  //   ["messages", [AIMessageChunk, metadata]]  — token-level LLM chunks
  const useMultiMode = !!opts.onTextDelta;
  const streamMode = useMultiMode ? (["values", "messages"] as any) : "values";

  // ── Build stream config ────────────────────────────────────────────
  const streamConfig: Record<string, any> = {
    streamMode,
    recursionLimit: config.graphRecursionLimit,
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

  const stream = await agent.stream(
    input as any,
    streamConfig,
  );

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

      if (useMultiMode && Array.isArray(rawEvent)) {
        // Multi-mode: [mode, data] tuple
        const [mode, data] = rawEvent as unknown as [string, any];

        if (mode === "messages") {
          // Token-level chunk: data is [AIMessageChunk, metadata]
          const chunk = Array.isArray(data) ? data[0] : data;
          const content = typeof chunk?.content === "string" ? chunk.content : "";
          // Only emit text deltas for non-tool-call assistant chunks
          if (content && !chunk?.tool_calls?.length && !chunk?.tool_call_chunks?.length) {
            opts.onTextDelta!(content);
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

  const finalMessages = lastState?.messages ?? accumulatedMessages;

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
  };
}
