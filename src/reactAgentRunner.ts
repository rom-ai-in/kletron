import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getChatModel, type LlmSelection } from "./llm";

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
  const model = getChatModel(opts.llmSelection);
  const agent = createReactAgent({
    llm: model,
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  });

  const inputMessages = [...(opts.extraMessages ?? []), { role: "user", content: opts.userPrompt }];
  const stream = await agent.stream({ messages: inputMessages }, { streamMode: "values" });

  const seenMessageIds = new Set<string>();
  const accumulatedMessages: BaseMessage[] = [];
  let lastState: { messages?: BaseMessage[] } | undefined;

  for await (const state of stream) {
    if (!state || typeof state !== "object") continue;
    lastState = state as { messages?: BaseMessage[] };
    if (!Array.isArray(lastState.messages)) continue;
    for (const message of lastState.messages) {
      const idKey =
        typeof message.id === "string"
          ? message.id
          : `${message.role ?? "unknown"}-${typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "")}-${accumulatedMessages.length}`;
      if (seenMessageIds.has(idKey)) continue;
      seenMessageIds.add(idKey);
      accumulatedMessages.push(message);
      if (opts.onMessage) {
        await opts.onMessage(message);
      }
    }
  }

  const finalMessages = lastState?.messages ?? accumulatedMessages;
  return finalMessages;
}
