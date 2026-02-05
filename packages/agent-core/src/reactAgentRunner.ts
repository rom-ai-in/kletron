import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getChatModel, type LlmSelection } from "@numezis/server/llm";
import { config } from "@numezis/server/config";
import type { TokenUsage } from "@numezis/server/services/tokenUsageTypes";

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
};

export type StreamReactAgentResult = {
  messages: BaseMessage[];
  tokenUsage: TokenUsage;
  model: string;
};

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
  const stream = await agent.stream(
    { messages: inputMessages },
    { streamMode: "values", recursionLimit: config.graphRecursionLimit }
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

  for await (const state of stream) {
    if (!state || typeof state !== "object") continue;
    lastState = state as { messages?: BaseMessage[] };
    if (!Array.isArray(lastState.messages)) continue;

    for (const message of lastState.messages) {
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
  }

  const finalMessages = lastState?.messages ?? accumulatedMessages;

  return {
    messages: finalMessages,
    tokenUsage: totalUsage,
    model: modelName,
  };
}
