import { BaseMessage } from "@langchain/core/messages";

import type {
  AgentEvent,
  AgentEventKind,
  AgentWorkflowOptions,
  AgentWorkflowResult,
  TimelineEvent,
} from "./agentRunner";
import { streamReactAgentMessages } from "./reactAgentRunner";
import {
  simpleReactPhaseDescription,
  simpleReactPhaseId,
  simpleReactPhaseLabel,
  simpleReactPhaseSummary,
  simpleReactSystemPrompt,
} from "./shared/reactAgentConfig";
import { allMcpTools } from "./tools/mcpTools";

const simpleReactTools = allMcpTools;

const cloneValue = <T>(value: T): T => {
  if (
    typeof (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone })?.structuredClone ===
    "function"
  ) {
    return (globalThis as typeof globalThis & { structuredClone: typeof structuredClone }).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const describeMessageContent = (message: BaseMessage) => {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (message.text && typeof message.text === "string" && message.text.trim()) {
    return message.text;
  }
  if (message.content) {
    try {
      return JSON.stringify(message.content, null, 2);
    } catch {
      return String(message.content);
    }
  }
  return "";
};

const guessToolName = (message: BaseMessage) => {
  const extra = message as BaseMessage & {
    additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[] };
    tool_calls?: Record<string, unknown>[];
    name?: string;
  };
  const functionCall = extra.additional_kwargs?.function_call;
  if (functionCall?.name) {
    return String(functionCall.name);
  }
  const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length) {
    const first = toolCalls[0] as { name?: unknown; function?: { name?: unknown } };
    if (typeof first?.name === "string") return first.name;
    if (typeof first?.function?.name === "string") return first.function.name;
    return undefined;
  }
  if (message.type === "tool" && typeof extra.name === "string" && extra.name) {
    return extra.name;
  }
  return undefined;
};

const extractToolArgs = (message: BaseMessage): string | undefined => {
  const extra = message as BaseMessage & {
    additional_kwargs?: {
      function_call?: { arguments?: unknown };
      tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
    };
    tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
  };
  const functionCall = extra.additional_kwargs?.function_call;
  if (functionCall?.arguments !== undefined) {
    return typeof functionCall.arguments === "string"
      ? functionCall.arguments
      : JSON.stringify(functionCall.arguments);
  }
  const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
  const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
  if (first?.args !== undefined) {
    return typeof first.args === "string" ? first.args : JSON.stringify(first.args);
  }
  if (first?.arguments !== undefined) {
    return typeof first.arguments === "string"
      ? first.arguments
      : JSON.stringify(first.arguments);
  }
  if (first?.function?.arguments !== undefined) {
    return typeof first.function.arguments === "string"
      ? first.function.arguments
      : JSON.stringify(first.function.arguments);
  }
  return undefined;
};

const extractToolCallId = (message: BaseMessage): string | undefined => {
  const direct = (message as BaseMessage & { tool_call_id?: string }).tool_call_id;
  if (direct) return String(direct);
  const extra = message as BaseMessage & {
    additional_kwargs?: { tool_call_id?: string; tool_calls?: Array<{ id?: string }> };
    tool_calls?: Array<{ id?: string }>;
  };
  if (extra.additional_kwargs?.tool_call_id) {
    return String(extra.additional_kwargs.tool_call_id);
  }
  const toolCalls = extra.tool_calls ?? extra.additional_kwargs?.tool_calls;
  const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
  if (first?.id) return String(first.id);
  return undefined;
};

const createAgentEvent = (
  message: BaseMessage,
  phaseId: string,
  phaseLabel: string,
  eventId: string
): AgentEvent => {
  const extra = message as BaseMessage & {
    additional_kwargs?: { function_call?: Record<string, unknown>; tool_calls?: Record<string, unknown>[] };
    tool_calls?: Record<string, unknown>[];
  };
  const role = typeof (message as any).role === "string" ? (message as any).role : message.type ?? "assistant";
  const normalizedRole = role.toLowerCase();
  const messageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
  const hasToolCall =
    messageType === "tool" ||
    Boolean(extra.additional_kwargs?.function_call) ||
    Boolean(extra.additional_kwargs?.tool_calls?.length) ||
    Boolean(extra.tool_calls?.length);
  const isSystemRole = normalizedRole === "system" || messageType === "system";
  const isUserRole =
    normalizedRole === "user" || normalizedRole === "human" || messageType === "user" || messageType === "human";
  const kind: AgentEventKind = hasToolCall
    ? "tool"
    : isSystemRole
      ? "system"
      : isUserRole
        ? "user"
        : "assistant";
  const toolArgs = extractToolArgs(message);
  const messageContent = describeMessageContent(message);
  const isToolResult = messageType === "tool";
  let content = messageContent;
  let toolNote: string | undefined;
  if (hasToolCall && !isToolResult) {
    toolNote = messageContent;
    content = "";
  } else if (!isToolResult) {
    toolNote = undefined;
  }

  return {
    id: eventId,
    phaseId,
    phaseLabel,
    kind,
    role,
    name: guessToolName(message),
    toolCallId: extractToolCallId(message),
    content,
    toolNote,
    toolArgs,
    timestamp: new Date().toISOString(),
  };
};

export async function runSimpleReactWorkflow(
  userRequest: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const timeline: TimelineEvent[] = [
    {
      id: simpleReactPhaseId,
      label: simpleReactPhaseLabel,
      status: "pending",
      summary: simpleReactPhaseSummary,
      details: simpleReactPhaseDescription,
      systemPrompt: simpleReactSystemPrompt,
      thoughtLog: [],
    },
  ];
  const eventStream: AgentEvent[] = [];
  let eventCounter = 0;
  const nextEventId = () => `event-${eventCounter++}`;

  const flushUpdate = async (outputs?: AgentWorkflowResult["outputs"]) => {
    if (!options?.onUpdate) return;
    const payload = {
      timeline: cloneValue(timeline),
      eventStream: cloneValue(eventStream),
    } as { timeline: TimelineEvent[]; eventStream: AgentEvent[]; outputs?: AgentWorkflowResult["outputs"] };
    if (outputs) {
      payload.outputs = cloneValue(outputs);
    }
    await options.onUpdate(payload);
  };

  const userEvent: AgentEvent = {
    id: nextEventId(),
    phaseId: "user",
    phaseLabel: "User request",
    kind: "user",
    role: "user",
    content: userRequest,
    timestamp: new Date().toISOString(),
  };
  eventStream.push(userEvent);
  await flushUpdate();

  const phaseEntry = timeline[0];
  phaseEntry.status = "running";
  phaseEntry.summary = `${simpleReactPhaseSummary} (running)`;
  phaseEntry.startedAt = new Date().toISOString();
  await flushUpdate();

  const builtMessageEvents: AgentEvent[] = [];
  const handleStreamingMessage = async (message: BaseMessage) => {
    const event = createAgentEvent(message, phaseEntry.id, phaseEntry.label, nextEventId());
    builtMessageEvents.push(event);
    eventStream.push(event);
    await flushUpdate();
  };

  const messages = await streamReactAgentMessages({
    name: "SimpleReAct",
    systemPrompt: simpleReactSystemPrompt,
    userPrompt: userRequest,
    tools: simpleReactTools,
    onMessage: handleStreamingMessage,
    llmSelection: options?.llmSelection,
  });

  const finalAgentEvent =
    builtMessageEvents.slice().reverse().find((event) => event.kind === "assistant") ??
    builtMessageEvents.at(-1);
  const finalContent = finalAgentEvent?.content ?? "";

  phaseEntry.status = "success";
  phaseEntry.summary = `${simpleReactPhaseSummary} (done)`;
  phaseEntry.endedAt = new Date().toISOString();
  const assistantEvents = builtMessageEvents.filter((event) => event.kind === "assistant");
  phaseEntry.thoughtLog = assistantEvents.length
    ? assistantEvents.map((event) => `${event.role}: ${event.content}`)
    : ["No assistant messages emitted."];
  await flushUpdate();

  const outputs: AgentWorkflowResult["outputs"] = {
    context: { mission: userRequest, languages: [], frameworks: [], hotspots: [] },
    target_files: [],
    raw_claims: [],
    verified_findings: [],
    tasks: [],
    report: finalContent,
    meta: {},
    findings: [],
  };

  await flushUpdate(outputs);

  return {
    timeline,
    conclusion: finalContent || "Agent completed without a response.",
    outputs,
    eventStream,
  };
}
