import {
  Annotation,
  END,
  MessagesAnnotation,
  SingleReducer,
  START,
  StateGraph,
} from "@langchain/langgraph";

import { streamReactAgentMessages } from "./reactAgentRunner";
const simpleReactPhaseId = "simple_react";
const simpleReactSystemPrompt = "You are a helpful AI assistant.";
import { allMcpTools } from "./tools/mcpTools";

const simpleReactTools = allMcpTools;

const lastValueReducer = <ValueType>(defaultValue?: () => ValueType): SingleReducer<ValueType, ValueType> => ({
  reducer: (_: ValueType, value: ValueType) => value,
  default: defaultValue,
});

const SimpleReactAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  userRequest: Annotation<string>(lastValueReducer<string>(() => "")),
  finalAnswer: Annotation<string>(lastValueReducer<string>(() => "")),
});

async function simpleReactNode(state: typeof SimpleReactAnnotation.State) {
  const agentMessages = await streamReactAgentMessages({
    name: "SimpleReactGraphAgent",
    systemPrompt: simpleReactSystemPrompt,
    userPrompt: state.userRequest ?? "",
    tools: simpleReactTools,
  });

  const finalMessage = agentMessages.messages.at(-1);
  const finalAnswer =
    typeof finalMessage?.content === "string"
      ? finalMessage.content
      : typeof finalMessage?.text === "string"
        ? finalMessage.text
        : JSON.stringify(finalMessage?.content ?? "", null, 2);

  return {
    messages: agentMessages,
    finalAnswer,
  };
}

const simpleReactBuilder = new StateGraph(SimpleReactAnnotation)
  .addNode(simpleReactPhaseId, simpleReactNode)
  .addEdge(START, simpleReactPhaseId)
  .addEdge(simpleReactPhaseId, END);

export const graph = simpleReactBuilder.compile();
