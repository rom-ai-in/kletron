import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getChatModel, type LlmSelection } from "./llm";
import { config } from "./config";

export type StreamReactAgentOptions = {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  llmSelection?: LlmSelection;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
};

export async function streamReactAgentMessages(opts: StreamReactAgentOptions) {
  const model = await getChatModel(opts.llmSelection);
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
  const accumulatedMessages: BaseMessage[] = [];
  let lastState: { messages?: BaseMessage[] } | undefined;

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
      if (seenMessageIds.has(idKey)) continue;
      seenMessageIds.add(idKey);
      accumulatedMessages.push(message);
      if (opts.onMessage) {
        if (shouldEmitToCallback(message)) {
          await opts.onMessage(message);
        }
      }
    }
  }

  const finalMessages = lastState?.messages ?? accumulatedMessages;
  return finalMessages;
}
