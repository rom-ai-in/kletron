import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getChatModel, type LlmSelection } from "@numezis/server/llm";
import { config } from "@numezis/server/config";
import type { TokenUsage } from "@numezis/server/services/tokenUsageTypes";
import type { AgentWorkflowAbortReason } from "@numezis/shared/types";

export type StreamReactAgentOptions = {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
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
};

export type StreamReactAgentResult = {
  messages: BaseMessage[];
  tokenUsage: TokenUsage;
  model: string;
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

  const agent = createReactAgent({
    llm: model,
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  });

  const inputMessages = [...(opts.extraMessages ?? []), { role: "user", content: opts.userPrompt }];

  // Use multi-mode streaming when onTextDelta is provided to get token-by-token output.
  // With ["values", "messages"], the stream yields [mode, data] tuples:
  //   ["values", { messages: BaseMessage[] }]   — complete state snapshots
  //   ["messages", [AIMessageChunk, metadata]]  — token-level LLM chunks
  const useMultiMode = !!opts.onTextDelta;
  const streamMode = useMultiMode ? (["values", "messages"] as any) : "values";

  const stream = await agent.stream(
    { messages: inputMessages },
    {
      streamMode,
      recursionLimit: config.graphRecursionLimit,
      signal: opts.abortSignal,
    }
  );

  const seenMessageIds = new Set<string>();
  const seenUsageIds = new Set<string>(); // Track which messages we've extracted usage from
  const accumulatedMessages: BaseMessage[] = [];
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

      // Process message for event stream
      if (!seenMessageIds.has(idKey)) {
        seenMessageIds.add(idKey);
        accumulatedMessages.push(message);
        if (opts.onMessage) {
          if (shouldEmitToCallback(message)) {
            await opts.onMessage(message);
          }
        }
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
        const [mode, data] = rawEvent as [string, any];

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

  return {
    messages: finalMessages,
    tokenUsage: totalUsage,
    model: modelName,
  };
}
