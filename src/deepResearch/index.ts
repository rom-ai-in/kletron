import {
  Annotation,
  END,
  MessagesAnnotation,
  SingleReducer,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { getChatModel, type LlmSelection } from "../llm";
import { allMcpTools } from "../tools/mcpTools";
import {
  actionReportPrompt,
  clarifyWithUserInstructions,
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  findingsSummaryPrompt,
  leadResearcherPrompt,
  researchPlanningPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "./prompts";
import type {
  AgentEvent,
  AgentEventKind,
  AgentWorkflowOptions,
  AgentWorkflowResult,
  AgentWorkflowUpdate,
  TimelineEvent,
} from "../types";
import {
  deepResearchPhaseConfig,
  deepResearchPhaseOrder,
  type DeepResearchPhaseKey,
} from "../shared/graphCatalog";
import { auditService } from "../services/auditService.js";

const defaultDeepResearchConfig = {
  allowClarification: true,
  maxStructuredOutputRetries: 3,
  maxResearcherIterations: 4,
  maxReactToolCalls: 6,
  maxConcurrentResearchUnits: 3,
};

type DeepResearchConfig = typeof defaultDeepResearchConfig;

type OverrideValue<T> = { type: "override"; value: T };

const lastValueReducer = <ValueType>(
  defaultValue?: () => ValueType
): SingleReducer<ValueType, ValueType | OverrideValue<ValueType>> => ({
  reducer: (_: ValueType, value: ValueType | OverrideValue<ValueType>) => {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      (value as OverrideValue<ValueType>).type === "override"
    ) {
      return (value as OverrideValue<ValueType>).value;
    }
    return value as ValueType;
  },
  default: defaultValue,
});

const appendReducer = <ValueType>(
  defaultValue?: () => ValueType[]
): SingleReducer<ValueType[], ValueType[] | OverrideValue<ValueType[]>> => ({
  reducer: (
    current: ValueType[],
    value: ValueType[] | OverrideValue<ValueType[]>
  ) => {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      (value as OverrideValue<ValueType[]>).type === "override"
    ) {
      return (value as OverrideValue<ValueType[]>).value;
    }
    return current.concat(value as ValueType[]);
  },
  default: defaultValue,
});

const DeepResearchAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  userRequest: Annotation<string>(lastValueReducer<string>(() => "")),
  researchBrief: Annotation<string>(lastValueReducer<string>(() => "")),
  researchPlan: Annotation<string>(lastValueReducer<string>(() => "")),
  supervisorMessages: Annotation<BaseMessage[]>(
    appendReducer<BaseMessage>(() => [])
  ),
  researchIterations: Annotation<number>(lastValueReducer<number>(() => 0)),
  notes: Annotation<string[]>(appendReducer<string>(() => [])),
  rawNotes: Annotation<string[]>(appendReducer<string>(() => [])),
  findingsSummary: Annotation<string>(lastValueReducer<string>(() => "")),
  finalReport: Annotation<string>(lastValueReducer<string>(() => "")),
  finalAnswer: Annotation<string>(lastValueReducer<string>(() => "")),
  nextStep: Annotation<string>(lastValueReducer<string>(() => "")),
});

const SupervisorAnnotation = Annotation.Root({
  supervisorMessages: Annotation<BaseMessage[]>(
    appendReducer<BaseMessage>(() => [])
  ),
  researchBrief: Annotation<string>(lastValueReducer<string>(() => "")),
  researchIterations: Annotation<number>(lastValueReducer<number>(() => 0)),
  notes: Annotation<string[]>(appendReducer<string>(() => [])),
  rawNotes: Annotation<string[]>(appendReducer<string>(() => [])),
  nextStep: Annotation<string>(lastValueReducer<string>(() => "")),
});

const ResearcherAnnotation = Annotation.Root({
  researcherMessages: Annotation<BaseMessage[]>(
    appendReducer<BaseMessage>(() => [])
  ),
  toolCallIterations: Annotation<number>(lastValueReducer<number>(() => 0)),
  researchTopic: Annotation<string>(lastValueReducer<string>(() => "")),
  compressedResearch: Annotation<string>(lastValueReducer<string>(() => "")),
  rawNotes: Annotation<string[]>(appendReducer<string>(() => [])),
  nextStep: Annotation<string>(lastValueReducer<string>(() => "")),
});

const ClarifySchema = z.object({
  need_clarification: z.boolean(),
  question: z.string(),
  verification: z.string(),
});

const ResearchBriefSchema = z.object({
  research_brief: z.string(),
});

const ConductResearchSchema = z.object({
  research_topic: z.string().describe("A detailed research topic for the repo."),
});

const ResearchCompleteSchema = z.object({});

const thinkTool = tool(
  async ({ reflection }: { reflection: string }) => {
    return `Reflection recorded: ${reflection}`;
  },
  {
    name: "think_tool",
    description: "Strategic reflection tool for research planning.",
    schema: z.object({
      reflection: z.string(),
    }),
  }
);

const conductResearchTool = tool(
  async (_input: { research_topic: string }) => {
    return "Delegated research request queued.";
  },
  {
    name: "ConductResearch",
    description: "Delegate a research task to a sub-agent.",
    schema: ConductResearchSchema,
  }
);

const researchCompleteTool = tool(
  async () => {
    return "Research marked complete.";
  },
  {
    name: "ResearchComplete",
    description: "Signal that the research task is complete.",
    schema: ResearchCompleteSchema,
  }
);

type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown> | string | undefined;
};

const getConfig = (): DeepResearchConfig => ({
  ...defaultDeepResearchConfig,
});

const formatDate = () => {
  const now = new Date();
  return `${now.toDateString()}`;
};

const formatMessageContent = (message: BaseMessage) => {
  if (typeof message.content === "string") return message.content;
  if (message.content) return JSON.stringify(message.content, null, 2);
  return "";
};

const getMessageRole = (message: BaseMessage) => {
  const role =
    (message as BaseMessage & { role?: string }).role ??
    (message as BaseMessage & { type?: string }).type ??
    "assistant";
  return typeof role === "string" ? role : "assistant";
};

const formatMessagesForPrompt = (messages: BaseMessage[]) =>
  messages
    .map((message) => `${getMessageRole(message)}: ${formatMessageContent(message)}`)
    .join("\n");

const fillPrompt = (template: string, values: Record<string, string>) => {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output;
};

const extractToolCalls = (message: BaseMessage): ToolCall[] => {
  const rawToolCalls =
    (message as BaseMessage & { tool_calls?: ToolCall[] }).tool_calls ??
    (message as BaseMessage & { additional_kwargs?: { tool_calls?: ToolCall[] } }).additional_kwargs?.tool_calls ??
    [];

  const calls = Array.isArray(rawToolCalls) ? rawToolCalls : [];
  const normalized = calls
    .filter((call) => call && typeof call === "object")
    .map((call, index) => ({
      id: call.id ?? `${call.name ?? "tool"}-${index}`,
      name: call.name ?? "tool",
      args: call.args ?? call,
    }));

  const functionCall = (message as BaseMessage & { additional_kwargs?: { function_call?: { name?: string; arguments?: string } } })
    .additional_kwargs?.function_call;
  if (functionCall?.name) {
    normalized.push({
      id: functionCall.name,
      name: functionCall.name,
      args: functionCall.arguments,
    });
  }

  return normalized;
};

const parseToolArgs = (args: ToolCall["args"]) => {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return { input: args };
    }
  }
  return args;
};

const getToolList = () => allMcpTools;

const getResearcherTools = () => [
  ...getToolList(),
  thinkTool,
  researchCompleteTool,
];

const summarizeToolList = (tools: { name: string; description?: string }[]) =>
  tools
    .map((toolEntry) => `- ${toolEntry.name}${toolEntry.description ? `: ${toolEntry.description}` : ""}`)
    .join("\n");

const maybeEmitMessage = async (config: RunnableConfig | undefined, message: BaseMessage) => {
  const onMessage =
    (config?.configurable as { onMessage?: (message: BaseMessage) => Promise<void> | void })?.onMessage;
  if (typeof onMessage === "function") {
    await onMessage(message);
  }
};

const sanitizeForLog = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

function logAgentEvent(event: AgentEvent) {
  const phase = event.phaseLabel ?? event.phaseId;
  const snippet = sanitizeForLog(event.content);
  const toolInfo = event.name ? ` tool=${event.name}` : "";
  console.info(
    `[DeepResearch] event ${event.id} kind=${event.kind} phase=${phase} role=${event.role}${toolInfo} content="${snippet}${event.content.length > 120 ? "…" : ""}"`
  );
}

const getLlmSelectionFromConfig = (config?: RunnableConfig) =>
  (config?.configurable as { llmSelection?: LlmSelection } | undefined)?.llmSelection;

const getConfiguredChatModel = (config?: RunnableConfig) => getChatModel(getLlmSelectionFromConfig(config));

const executeToolSafely = async (
  toolEntry: {
    name: string;
    invoke: (
      input: Record<string, unknown>,
      config?: RunnableConfig
    ) => Promise<unknown>;
  },
  args: Record<string, unknown>,
  config?: RunnableConfig
) => {
  try {
    return await toolEntry.invoke(args, config);
  } catch (error: unknown) {
    return `Error executing ${toolEntry.name}: ${(error as Error).message ?? "unknown error"}`;
  }
};

export async function clarifyWithUser(
  state: typeof DeepResearchAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  if (!settings.allowClarification) {
    return { nextStep: "write_research_brief" };
  }

  const messages = state.messages ?? [];
  const prompt = fillPrompt(clarifyWithUserInstructions, {
    messages: formatMessagesForPrompt(messages),
    date: formatDate(),
  });
  const model = (await getConfiguredChatModel(config))
    .withStructuredOutput(ClarifySchema)
    .withRetry({ stopAfterAttempt: settings.maxStructuredOutputRetries });
  const response = await model.invoke([new HumanMessage(prompt)]);

  const reply = response.need_clarification ? response.question : response.verification;
  const message = new AIMessage(reply);
  await maybeEmitMessage(config, message);

  return {
    nextStep: response.need_clarification ? "end" : "write_research_brief",
    messages: [message],
    finalAnswer: response.need_clarification ? reply : state.finalAnswer,
  };
}

export async function writeResearchBrief(
  state: typeof DeepResearchAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const prompt = fillPrompt(transformMessagesIntoResearchTopicPrompt, {
    messages: formatMessagesForPrompt(state.messages ?? []),
    date: formatDate(),
  });

  const model = (await getConfiguredChatModel(config))
    .withStructuredOutput(ResearchBriefSchema)
    .withRetry({ stopAfterAttempt: settings.maxStructuredOutputRetries });
  const response = await model.invoke([new HumanMessage(prompt)]);

  const researchBrief = response.research_brief;
  const systemPrompt = fillPrompt(leadResearcherPrompt, {
    date: formatDate(),
    max_concurrent_research_units: String(settings.maxConcurrentResearchUnits),
    max_researcher_iterations: String(settings.maxResearcherIterations),
  });
  const supervisorMessages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(researchBrief),
  ];

  const briefMessage = new AIMessage(`Research brief:\n${researchBrief}`);
  await maybeEmitMessage(config, briefMessage);

  return {
    researchBrief,
    supervisorMessages: { type: "override", value: supervisorMessages },
    messages: [briefMessage],
  };
}

export async function planResearch(
  state: typeof DeepResearchAnnotation.State,
  config?: RunnableConfig
) {
  const prompt = fillPrompt(researchPlanningPrompt, {
    research_brief: state.researchBrief ?? "",
    date: formatDate(),
  });
  const model = (await getConfiguredChatModel(config)).withRetry({
    stopAfterAttempt: getConfig().maxStructuredOutputRetries,
  });
  const response = await model.invoke([new HumanMessage(prompt)]);
  await maybeEmitMessage(config, response);

  const researchPlan =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return {
    researchPlan,
    messages: [response],
  };
}

export async function supervisor(
  state: typeof SupervisorAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const model = (await getConfiguredChatModel(config))
    .bindTools([conductResearchTool, researchCompleteTool, thinkTool])
    .withRetry({ stopAfterAttempt: settings.maxStructuredOutputRetries });

  const messages = state.supervisorMessages ?? [];
  const response = await model.invoke(messages);
  await maybeEmitMessage(config, response);

  return {
    supervisorMessages: [response],
    researchIterations: state.researchIterations + 1,
  };
}

async function runResearcherSubgraph(
  researchTopic: string,
  config?: RunnableConfig
) {
  const settings = getConfig();
  let localState: typeof ResearcherAnnotation.State = {
    researcherMessages: [new HumanMessage(researchTopic)],
    toolCallIterations: 0,
    researchTopic,
    compressedResearch: "",
    rawNotes: [],
    nextStep: "researcher",
  };

  await maybeEmitMessage(config, localState.researcherMessages[0]);

  while (true) {
    const researcherUpdate = await researcher(localState, config);
    localState = applyUpdate(localState, researcherUpdate);

    const toolsUpdate = await researcherTools(localState, config);
    localState = applyUpdate(localState, toolsUpdate);

    if (localState.nextStep === "compress_research") {
      const compressUpdate = await compressResearch(localState, config);
      localState = applyUpdate(localState, compressUpdate);
      break;
    }
  }

  return {
    compressedResearch: localState.compressedResearch,
    rawNotes: localState.rawNotes,
  };
}

export async function supervisorTools(
  state: typeof SupervisorAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const supervisorMessages = state.supervisorMessages ?? [];
  const mostRecent = supervisorMessages[supervisorMessages.length - 1];
  const toolCalls = mostRecent ? extractToolCalls(mostRecent) : [];

  const exceeded = state.researchIterations > settings.maxResearcherIterations;
  const researchCompleteCalled = toolCalls.some(
    (call) => call.name === researchCompleteTool.name
  );

  if (exceeded || toolCalls.length === 0 || researchCompleteCalled) {
    return {
      nextStep: "end",
    };
  }

  const toolMessages: ToolMessage[] = [];
  const notes: string[] = [];
  const rawNotes: string[] = [];

  const thinkCalls = toolCalls.filter((call) => call.name === thinkTool.name);
  for (const call of thinkCalls) {
    const args = parseToolArgs(call.args);
    const reflection = typeof args.reflection === "string" ? args.reflection : "";
    const toolMessage = new ToolMessage({
      content: `Reflection recorded: ${reflection}`,
      name: thinkTool.name,
      tool_call_id: call.id,
    });
    toolMessages.push(toolMessage);
    await maybeEmitMessage(config, toolMessage);
  }

  const researchCalls = toolCalls.filter((call) => call.name === conductResearchTool.name);
  if (researchCalls.length) {
    const allowedCalls = researchCalls.slice(0, settings.maxConcurrentResearchUnits);
    const overflowCalls = researchCalls.slice(settings.maxConcurrentResearchUnits);

    const tasks = allowedCalls.map(async (call) => {
      const args = parseToolArgs(call.args);
      const topic = typeof args.research_topic === "string" ? args.research_topic : "";
      if (!topic) {
        return {
          toolMessage: new ToolMessage({
            content: "Error: research_topic was empty or invalid.",
            name: conductResearchTool.name,
            tool_call_id: call.id,
          }),
          rawNotes: [],
        };
      }
      const observation = await runResearcherSubgraph(topic, config);
      return {
        toolMessage: new ToolMessage({
          content: observation.compressedResearch,
          name: conductResearchTool.name,
          tool_call_id: call.id,
        }),
        rawNotes: observation.rawNotes ?? [],
      };
    });

    const results = await Promise.all(tasks);
    for (const result of results) {
      toolMessages.push(result.toolMessage);
      notes.push(typeof result.toolMessage.content === "string" ? result.toolMessage.content : JSON.stringify(result.toolMessage.content));
      rawNotes.push(...result.rawNotes);
      await maybeEmitMessage(config, result.toolMessage);
    }

    for (const overflow of overflowCalls) {
      const toolMessage = new ToolMessage({
        content: `Error: exceeded max concurrent research units (${settings.maxConcurrentResearchUnits}).`,
        name: conductResearchTool.name,
        tool_call_id: overflow.id,
      });
      toolMessages.push(toolMessage);
      await maybeEmitMessage(config, toolMessage);
    }
  }

  return {
    supervisorMessages: toolMessages,
    notes,
    rawNotes,
    nextStep: "supervisor",
  };
}

export async function researcher(
  state: typeof ResearcherAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const tools = getResearcherTools();
  if (!tools.length) {
    throw new Error("No MCP tools available for code research.");
  }

  const prompt = fillPrompt(researchSystemPrompt, {
    date: formatDate(),
    tool_list: summarizeToolList(tools),
  });
  const model = (await getConfiguredChatModel(config))
    .bindTools(tools)
    .withRetry({ stopAfterAttempt: settings.maxStructuredOutputRetries });
  const messages = [new SystemMessage(prompt), ...(state.researcherMessages ?? [])];
  const response = await model.invoke(messages);
  await maybeEmitMessage(config, response);

  return {
    researcherMessages: [response],
    toolCallIterations: state.toolCallIterations + 1,
  };
}

export async function researcherTools(
  state: typeof ResearcherAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const messages = state.researcherMessages ?? [];
  const mostRecent = messages[messages.length - 1];
  if (!mostRecent) {
    return { nextStep: "compress_research" };
  }

  const toolCalls = extractToolCalls(mostRecent);
  if (!toolCalls.length) {
    return { nextStep: "compress_research" };
  }

  const toolMap = new Map(
    getResearcherTools().map((toolEntry) => [toolEntry.name, toolEntry])
  );
  const toolMessages: ToolMessage[] = [];
  const rawNotes: string[] = [];
  let researchCompleteCalled = false;

  for (const call of toolCalls) {
    const toolEntry = toolMap.get(call.name as any);
    if (!toolEntry) {
      const toolMessage = new ToolMessage({
        content: `Error: unknown tool ${call.name}.`,
        name: call.name,
        tool_call_id: call.id,
      });
      toolMessages.push(toolMessage);
      await maybeEmitMessage(config, toolMessage);
      continue;
    }

    if (call.name === researchCompleteTool.name) {
      researchCompleteCalled = true;
    }

    const args = parseToolArgs(call.args);
    const output = await executeToolSafely(toolEntry as any, args, config);
    const toolMessage = new ToolMessage({
      content: typeof output === "string" ? output : JSON.stringify(output, null, 2),
      name: call.name,
      tool_call_id: call.id,
    });
    toolMessages.push(toolMessage);
    rawNotes.push(typeof toolMessage.content === "string" ? toolMessage.content : JSON.stringify(toolMessage.content));
    await maybeEmitMessage(config, toolMessage);
  }

  if (state.toolCallIterations >= settings.maxReactToolCalls || researchCompleteCalled) {
    return {
      researcherMessages: toolMessages,
      rawNotes,
      nextStep: "compress_research",
    };
  }

  return {
    researcherMessages: toolMessages,
    rawNotes,
    nextStep: "researcher",
  };
}

export async function compressResearch(
  state: typeof ResearcherAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const prompt = fillPrompt(compressResearchSystemPrompt, {
    date: formatDate(),
  });
  const model = (await getConfiguredChatModel(config)).withRetry({
    stopAfterAttempt: settings.maxStructuredOutputRetries,
  });
  const researcherMessages = [...(state.researcherMessages ?? [])];
  researcherMessages.push(new HumanMessage(compressResearchSimpleHumanMessage));
  const response = await model.invoke([new SystemMessage(prompt), ...researcherMessages]);
  await maybeEmitMessage(config, response);

  const rawNotes = [
    ...state.rawNotes,
    ...researcherMessages
      .filter((message) => {
        const messageType =
          (message as BaseMessage & { type?: string }).type ?? "";
        return messageType.toLowerCase() === "tool" || messageType.toLowerCase() === "ai";
      })
      .map(formatMessageContent),
  ];

  return {
    compressedResearch: typeof response.content === "string" ? response.content : JSON.stringify(response.content),
    rawNotes,
  };
}

export async function summarizeFindings(
  state: typeof DeepResearchAnnotation.State,
  config?: RunnableConfig
) {
  const prompt = fillPrompt(findingsSummaryPrompt, {
    research_brief: state.researchBrief ?? "",
    research_plan: state.researchPlan ?? "",
    findings: (state.notes ?? []).join("\n"),
    raw_notes: (state.rawNotes ?? []).join("\n"),
    date: formatDate(),
  });
  const model = (await getConfiguredChatModel(config)).withRetry({
    stopAfterAttempt: getConfig().maxStructuredOutputRetries,
  });
  const response = await model.invoke([new HumanMessage(prompt)]);
  await maybeEmitMessage(config, response);

  const findingsSummary =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return {
    findingsSummary,
    messages: [response],
  };
}

export async function generateActionReport(
  state: typeof DeepResearchAnnotation.State,
  config?: RunnableConfig
) {
  const settings = getConfig();
  const prompt = fillPrompt(actionReportPrompt, {
    research_brief: state.researchBrief ?? "",
    research_plan: state.researchPlan ?? "",
    findings_summary: state.findingsSummary ?? "",
    date: formatDate(),
  });
  const model = (await getConfiguredChatModel(config)).withRetry({
    stopAfterAttempt: settings.maxStructuredOutputRetries,
  });
  const response = await model.invoke([new HumanMessage(prompt)]);
  await maybeEmitMessage(config, response);

  const report =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  return {
    finalReport: report,
    finalAnswer: report,
    messages: [response],
  };
}

const applyUpdate = <State extends Record<string, unknown>>(
  state: State,
  update: Record<string, unknown>
) => {
  const nextState = { ...state };
  for (const [key, value] of Object.entries(update)) {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      (value as OverrideValue<unknown>).type === "override"
    ) {
      nextState[key as keyof State] = (value as OverrideValue<unknown>).value as State[keyof State];
      continue;
    }
    const current = nextState[key as keyof State];
    if (Array.isArray(current) && Array.isArray(value)) {
      (nextState as Record<string, unknown>)[key] = [...current, ...value];
    } else {
      (nextState as Record<string, unknown>)[key] = value;
    }
  }
  return nextState;
};

export async function runDeepResearchWorkflow(
  userRequest: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const timeline: TimelineEvent[] = deepResearchPhaseOrder.map((phaseId) => ({
    id: phaseId,
    label: deepResearchPhaseConfig[phaseId].label,
    status: "pending",
    summary: deepResearchPhaseConfig[phaseId].summary,
    details: deepResearchPhaseConfig[phaseId].description,
    systemPrompt: deepResearchPhaseConfig[phaseId].systemPrompt,
    thoughtLog: [],
  }));
  const eventStream: AgentEvent[] = [];
  let eventCounter = 0;

  const nextEventId = () => `event-${eventCounter++}`;

  // 1. Create Session
  const sessionId = await auditService.createSession(userRequest);
  console.info(`[DeepResearch] Started MongoDB session: ${sessionId}`);

  const flushUpdate = async (outputs?: AgentWorkflowResult["outputs"]) => {
    if (!options?.onUpdate) return;
    const payload: AgentWorkflowUpdate = {
      timeline: JSON.parse(JSON.stringify(timeline)),
      eventStream: JSON.parse(JSON.stringify(eventStream)),
    };
    if (outputs) payload.outputs = JSON.parse(JSON.stringify(outputs));
    await options.onUpdate(payload);

    // 2. Update Session (Background)
    if (sessionId) {
      auditService
        .updateSession(sessionId, {
          timeline: payload.timeline,
          eventStream: payload.eventStream,
          outputs: payload.outputs as any,
        })
        .catch((err: any) => console.error("Background update failed", err));
    }
  };

  const createAgentEvent = (
    message: BaseMessage,
    phaseId: DeepResearchPhaseKey,
    phaseLabel: string
  ): AgentEvent => {
    const role = getMessageRole(message).toLowerCase();
    const messageType = (message as BaseMessage & { type?: string }).type ?? "";
    const hasToolCall =
      messageType.toLowerCase() === "tool" ||
      Boolean((message as any).additional_kwargs?.function_call) ||
      Boolean((message as any).additional_kwargs?.tool_calls?.length) ||
      Boolean((message as BaseMessage & { tool_calls?: unknown[] }).tool_calls?.length);
    const kind: AgentEventKind = hasToolCall
      ? "tool"
      : role === "system"
        ? "system"
        : role === "user" || role === "human"
          ? "user"
          : "assistant";
    const messageContent = formatMessageContent(message);
    const isToolResult = messageType.toLowerCase() === "tool";
    let content = messageContent;
    let toolNote: string | undefined;
    if (hasToolCall && !isToolResult) {
      toolNote = messageContent;
      content = "";
    } else if (!isToolResult) {
      toolNote = undefined;
    }
    return {
      id: nextEventId(),
      phaseId,
      phaseLabel,
      kind,
      role,
      name: (message as BaseMessage & { name?: string }).name,
      content,
      toolNote,
      toolArgs: (() => {
        const extra = message as any;
        const functionArgs = extra.additional_kwargs?.function_call?.arguments;
        if (functionArgs !== undefined) {
          return typeof functionArgs === "string" ? functionArgs : JSON.stringify(functionArgs);
        }
        const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
        const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
        const args = first?.args ?? first?.arguments ?? first?.function?.arguments;
        if (args === undefined) return undefined;
        return typeof args === "string" ? args : JSON.stringify(args);
      })(),
      timestamp: new Date().toISOString(),
    };
  };

  const formatThought = (message: BaseMessage) => {
    const role = getMessageRole(message);
    const content = formatMessageContent(message);
    return `${role}: ${content}`;
  };

  const appendMessage = async (message: BaseMessage, phaseId: DeepResearchPhaseKey) => {
    const phaseLabel = deepResearchPhaseConfig[phaseId].label;
    const event = createAgentEvent(message, phaseId, phaseLabel);
    eventStream.push(event);
    const timelineEntry = timeline.find((item) => item.id === phaseId);
    if (timelineEntry && event.kind === "assistant") {
      timelineEntry.thoughtLog = timelineEntry.thoughtLog ?? [];
      timelineEntry.thoughtLog.push(formatThought(message));
    }
    logAgentEvent(event);
    await flushUpdate();
  };

  const onMessage = (phaseId: DeepResearchPhaseKey) => async (message: BaseMessage) =>
    appendMessage(message, phaseId);

  const initialEvent: AgentEvent = {
    id: nextEventId(),
    phaseId: "user",
    phaseLabel: "User request",
    kind: "user",
    role: "user",
    content: userRequest,
    timestamp: new Date().toISOString(),
  };
  eventStream.push(initialEvent);
  await flushUpdate();

  let state: typeof DeepResearchAnnotation.State = {
    messages: [new HumanMessage(userRequest)],
    userRequest,
    researchBrief: "",
    researchPlan: "",
    supervisorMessages: [],
    researchIterations: 0,
    notes: [],
    rawNotes: [],
    findingsSummary: "",
    finalReport: "",
    finalAnswer: "",
    nextStep: "",
  };

  const runPhase = async <T>(
    phaseId: DeepResearchPhaseKey,
    callback: () => Promise<T>
  ) => {
    const entry = timeline.find((item) => item.id === phaseId);
    if (!entry) throw new Error(`Missing timeline entry for ${phaseId}`);
    entry.status = "running";
    entry.summary = `${deepResearchPhaseConfig[phaseId].summary} (running)`;
    entry.startedAt = new Date().toISOString();
    await flushUpdate();

    try {
      const result = await callback();
      entry.status = "success";
      entry.summary = `${deepResearchPhaseConfig[phaseId].summary} (done)`;
      entry.endedAt = new Date().toISOString();
      await flushUpdate();
      return result;
    } catch (error: unknown) {
      entry.status = "error";
      entry.summary = `Failed: ${(error as Error).message ?? "unknown error"}`;
      entry.endedAt = new Date().toISOString();
      await flushUpdate();
      throw error;
    }
  };

  const llmSelection = options?.llmSelection;

  try {
    await runPhase("clarify", async () => {
      const update = await clarifyWithUser(state, {
        configurable: { onMessage: onMessage("clarify"), llmSelection },
      });
      state = applyUpdate(state, update);
      return update;
    });

    if (state.nextStep === "end") {
      const outputs: AgentWorkflowResult["outputs"] = {
        context: { mission: state.userRequest ?? "", languages: [], frameworks: [], hotspots: [] },
        target_files: [],
        raw_claims: [],
        verified_findings: [],
        tasks: [],
        report: state.finalAnswer ?? "",
        meta: {},
        findings: [],
      };
      const finalResult: AgentWorkflowResult = {
        sessionId,
        timeline,
        conclusion: state.finalAnswer ?? "Clarification requested.",
        outputs,
        eventStream,
      };
      await flushUpdate(outputs);
      if (sessionId) await auditService.completeSession(sessionId, finalResult);
      return finalResult;
    }

    await runPhase("brief", async () => {
      const update = await writeResearchBrief(state, {
        configurable: { onMessage: onMessage("brief"), llmSelection },
      });
      state = applyUpdate(state, update);
      return update;
    });

    await runPhase("plan", async () => {
      const update = await planResearch(state, {
        configurable: { onMessage: onMessage("plan"), llmSelection },
      });
      state = applyUpdate(state, update);
      return update;
    });

    await runPhase("research", async () => {
      const update = await supervisorGraph.invoke(state, {
        configurable: { onMessage: onMessage("research"), llmSelection },
      });
      // Supervisor subgraph returns a partial state
      state = applyUpdate(state, update as any);
      return update;
    });

    await runPhase("summary", async () => {
      const update = await summarizeFindings(state, {
        configurable: { onMessage: onMessage("summary"), llmSelection },
      });
      state = applyUpdate(state, update);
      return update;
    });

    await runPhase("report", async () => {
      const update = await generateActionReport(state, {
        configurable: { onMessage: onMessage("report"), llmSelection },
      });
      state = applyUpdate(state, update);
      return update;
    });

    const report = state.finalReport ?? "";
    const conclusion = report.split("\n").slice(0, 4).join(" ").trim() || "Report generated.";

    const outputs: AgentWorkflowResult["outputs"] = {
      context: { mission: state.userRequest ?? "", languages: [], frameworks: [], hotspots: [] },
      target_files: [],
      raw_claims: [],
      verified_findings: [],
      tasks: [],
      report,
      meta: {},
      findings: [],
    };

    const finalResult: AgentWorkflowResult = {
      sessionId,
      timeline,
      conclusion,
      outputs,
      eventStream,
    };
    await flushUpdate(outputs);

    if (sessionId) {
      await auditService.completeSession(sessionId, finalResult);
    }
    return finalResult;
  } catch (error) {
    if (sessionId) {
      await auditService.completeSession(sessionId, {} as any, error as Error);
    }
    throw error;
  }
}


const supervisorBuilder = new StateGraph(SupervisorAnnotation)
  .addNode("supervisor", supervisor)
  .addNode("supervisor_tools", supervisorTools)
  .addEdge(START, "supervisor")
  .addEdge("supervisor", "supervisor_tools")
  .addConditionalEdges("supervisor_tools", (state) => state.nextStep, {
    supervisor: "supervisor",
    end: END,
  });

const supervisorSubgraph = supervisorBuilder.compile();

const researcherBuilder = new StateGraph(ResearcherAnnotation)
  .addNode("researcher", researcher)
  .addNode("researcher_tools", researcherTools)
  .addNode("compress_research", compressResearch)
  .addEdge(START, "researcher")
  .addEdge("researcher", "researcher_tools")
  .addConditionalEdges("researcher_tools", (state) => state.nextStep, {
    researcher: "researcher",
    compress_research: "compress_research",
  })
  .addEdge("compress_research", END);

const researcherSubgraph = researcherBuilder.compile();

const deepResearchBuilder = new StateGraph(DeepResearchAnnotation)
  .addNode("clarify_with_user", clarifyWithUser)
  .addNode("write_research_brief", writeResearchBrief)
  .addNode("plan_research", planResearch)
  .addNode("research_supervisor", supervisorSubgraph)
  .addNode("summarize_findings", summarizeFindings)
  .addNode("final_action_report", generateActionReport)
  .addEdge(START, "clarify_with_user")
  .addConditionalEdges("clarify_with_user", (state) => state.nextStep, {
    write_research_brief: "write_research_brief",
    end: END,
  })
  .addEdge("write_research_brief", "plan_research")
  .addEdge("plan_research", "research_supervisor")
  .addEdge("research_supervisor", "summarize_findings")
  .addEdge("summarize_findings", "final_action_report")
  .addEdge("final_action_report", END);

export const deepResearchGraph = deepResearchBuilder.compile();

export const researcherGraph = researcherSubgraph;
export const supervisorGraph = supervisorSubgraph;
