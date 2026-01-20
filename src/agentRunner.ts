import { BaseMessage } from "@langchain/core/messages";

import {
  phaseDefinitions,
  phaseOrder,
  runPhase1MapperAgent,
  runPhase2AuditorAgent,
  runPhase3PlannerAgent,
  runPhase4ReporterAgent,
  type PhaseKey,
} from "./agents/phases.ts";

type TimelineStatus = "pending" | "running" | "success" | "error";

export type TimelineEvent = {
  id: string;
  label: string;
  status: TimelineStatus;
  summary: string;
  details?: string;
  systemPrompt?: string;
  thoughtLog?: string[];
  startedAt?: string;
  endedAt?: string;
};

export type AgentWorkflowResult = {
  timeline: TimelineEvent[];
  conclusion: string;
  outputs: {
    meta: Record<string, unknown>;
    findings: unknown[];
    tasks: unknown[];
    report: string;
  };
  eventStream: AgentEvent[];
};

export type AgentEventKind = "system" | "user" | "assistant" | "tool";

export type AgentEvent = {
  id: string;
  phaseId: string;
  phaseLabel?: string;
  kind: AgentEventKind;
  role: string;
  name?: string;
  content: string;
  toolArgs?: string;
  timestamp: string;
};

export type AgentWorkflowUpdate = {
  timeline: TimelineEvent[];
  eventStream: AgentEvent[];
  outputs?: AgentWorkflowResult["outputs"];
};

export type AgentWorkflowOptions = {
  onUpdate?: (update: AgentWorkflowUpdate) => Promise<void> | void;
  llmSelection?: { provider: "azure" | "lmstudio"; model?: string };
};

const LOG_CONTENT_LIMIT = 120;

const sanitizeForLog = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LOG_CONTENT_LIMIT);

function logAgentEvent(event: AgentEvent) {
  const phase = event.phaseLabel ?? event.phaseId;
  const snippet = sanitizeForLog(event.content);
  const toolInfo = event.name ? ` tool=${event.name}` : "";
  console.info(
    `[AgentRunner] event ${event.id} kind=${event.kind} phase=${phase} role=${event.role}${toolInfo} content="${snippet}${
      event.content.length > LOG_CONTENT_LIMIT ? "…" : ""
    }"`
  );
}

function formatSummary(value: unknown) {
  if (!value) return "No data available yet.";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatThought(message: BaseMessage) {
  const role = "role" in message ? message.role : message.type ?? "assistant";
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "", null, 2);
  return `${role}: ${content}`;
}

function guessToolName(message: BaseMessage) {
  const functionCall = message.additional_kwargs?.function_call;
  if (functionCall?.name) {
    return functionCall.name;
  }
  const toolCalls = message.additional_kwargs?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length) {
    return toolCalls[0]?.name;
  }
  if (message.type === "tool" && typeof message.name === "string" && message.name) {
    return message.name;
  }
  return undefined;
}

function describeMessageContent(message: BaseMessage) {
  if (message.text && typeof message.text === "string" && message.text.trim()) {
    return message.text;
  }
  if (message.content) {
    return formatSummary(message.content);
  }
  return "";
}

function createAgentEvent(
  message: BaseMessage,
  phaseId: PhaseKey,
  phaseLabel: string,
  eventId: string
): AgentEvent {
  const role = "role" in message ? message.role ?? message.type ?? "assistant" : message.type ?? "assistant";
  const hasToolCall =
    message.type === "tool" ||
    Boolean(message.additional_kwargs?.function_call) ||
    Boolean(message.additional_kwargs?.tool_calls?.length);
  const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";
  const normalizedMessageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
  const isSystemRole = normalizedRole === "system" || normalizedMessageType === "system";
  const isUserRole =
    normalizedRole === "user" ||
    normalizedRole === "human" ||
    normalizedMessageType === "user" ||
    normalizedMessageType === "human";
  const isPhaseUser = phaseId === "user";
  const kind: AgentEventKind = hasToolCall
    ? "tool"
    : isSystemRole
    ? "system"
    : isPhaseUser || isUserRole
    ? "user"
    : "assistant";
  return {
    id: eventId,
    phaseId,
    phaseLabel,
    kind,
    role,
    name: guessToolName(message),
    content: describeMessageContent(message),
    toolArgs: message.additional_kwargs?.function_call?.arguments,
    timestamp: new Date().toISOString(),
  };
}

function createInitialTimeline(): TimelineEvent[] {
  return phaseOrder.map((phaseId) => ({
    id: phaseId,
    label: phaseDefinitions[phaseId].label,
    status: "pending",
    summary: phaseDefinitions[phaseId].summary,
    details: phaseDefinitions[phaseId].description,
    systemPrompt: phaseDefinitions[phaseId].systemPrompt,
    thoughtLog: [],
  }));
}

async function describeMeta(meta: Record<string, unknown>) {
  const highlights: string[] = [];
  if (meta.languages) {
    highlights.push(
      `Languages: ${
        Array.isArray(meta.languages) ? (meta.languages as string[]).join(", ") : meta.languages
      }`
    );
  }
  if (meta.frameworks) {
    highlights.push(
      `Frameworks: ${
        Array.isArray(meta.frameworks) ? (meta.frameworks as string[]).join(", ") : meta.frameworks
      }`
    );
  }
  if (meta.entrypoints) {
    highlights.push(
      `Entrypoints: ${
        Array.isArray(meta.entrypoints) ? (meta.entrypoints as string[]).join(", ") : meta.entrypoints
      }`
    );
  }
  if (meta.critical_areas) {
    highlights.push(`Critical areas: ${formatSummary(meta.critical_areas)}`);
  }
  if (!highlights.length) {
    highlights.push("Meta information was generated but no highlights were detected.");
  }
  return highlights.join(" · ");
}

const cloneValue = <T>(value: T): T => {
  if (typeof (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone })?.structuredClone === "function") {
    return (globalThis as typeof globalThis & { structuredClone: typeof structuredClone }).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

async function runPhase<TReturn>(
  phaseId: keyof typeof phaseDefinitions,
  callback: () => Promise<TReturn>,
  timeline: TimelineEvent[],
  options?: {
    onMessages?: (messages: BaseMessage[], phaseId: PhaseKey) => AgentEvent[] | Promise<AgentEvent[]>;
    flushUpdate?: () => Promise<void>;
  }
) {
  const event = timeline.find((entry) => entry.id === phaseId);
  if (!event) throw new Error(`Phase ${phaseId} missing from timeline`);

  event.status = "running";
  event.summary = `${phaseDefinitions[phaseId].summary} (running)`;
  event.startedAt = new Date().toISOString();
  if (options?.flushUpdate) {
    await options.flushUpdate();
  }

  try {
    const result = await callback();
    const messages = (result as { messages?: BaseMessage[] }).messages ?? [];
    const formattedEvents = options?.onMessages
      ? await options.onMessages(messages, phaseId as PhaseKey)
      : [];
    event.thoughtLog =
      formattedEvents.length > 0
        ? formattedEvents.map((entry) => `${entry.role}: ${entry.content}`)
        : messages.map(formatThought);
    event.status = "success";
    event.summary = `${phaseDefinitions[phaseId].summary} (done)`;
    event.endedAt = new Date().toISOString();
    return result;
  } catch (error: unknown) {
    event.status = "error";
    event.summary = `Failed: ${(error as Error).message ?? "unknown error"}`;
    event.endedAt = new Date().toISOString();
    if (options?.flushUpdate) {
      await options.flushUpdate();
    }
    throw error;
  }
}

export async function runAgentWorkflow(
  userRequest: string,
  options?: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const timeline = createInitialTimeline();
  const eventStream: AgentEvent[] = [];
  let eventCounter = 0;
  const nextEventId = () => `event-${eventCounter++}`;

  const flushUpdate = async (outputs?: AgentWorkflowResult["outputs"]) => {
    if (!options?.onUpdate) return;
    const payload: AgentWorkflowUpdate = {
      timeline: cloneValue(timeline),
      eventStream: cloneValue(eventStream),
    };
    if (outputs) {
      payload.outputs = cloneValue(outputs);
    }
    await options.onUpdate(payload);
  };

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
  logAgentEvent(initialEvent);

  await flushUpdate();

  const appendPhaseEvents = async (messages: BaseMessage[], phaseId: PhaseKey) => {
    const phaseLabel = phaseDefinitions[phaseId].label;
    const createdEvents: AgentEvent[] = [];
    for (const message of messages) {
      const event = createAgentEvent(message, phaseId, phaseLabel, nextEventId());
      eventStream.push(event);
      logAgentEvent(event);
      createdEvents.push(event);
      await flushUpdate();
    }
    return createdEvents;
  };

  const phase1Result = await runPhase(
    "phase1",
    () =>
      runPhase1MapperAgent(
        userRequest,
        [],
        (message) => appendPhaseEvents([message], "phase1"),
        options?.llmSelection
      ),
    timeline,
    {
      flushUpdate,
    }
  );
  const meta = (phase1Result.parsed as any)?.meta ?? {};
  const phase1Entry = timeline.find((entry) => entry.id === "phase1");
  if (phase1Entry) {
    phase1Entry.details = await describeMeta(meta);
  }
  await flushUpdate();

  const phase2Result = await runPhase(
    "phase2",
    () =>
      runPhase2AuditorAgent({
        userRequest,
        meta,
        suggestedAuditFiles: (phase1Result.parsed as any)?.suggested_audit_files ?? [],
        onMessage: (message) => appendPhaseEvents([message], "phase2"),
        llmSelection: options?.llmSelection,
      }),
    timeline,
    {
      flushUpdate,
    }
  );
  const findingsSummary = (phase2Result.parsed as any)?.findings ?? [];
  const phase2Entry = timeline.find((entry) => entry.id === "phase2");
  if (phase2Entry) {
    phase2Entry.details =
      Array.isArray(findingsSummary) && findingsSummary.length
        ? `Findings captured: ${findingsSummary.length}`
        : "No findings were returned.";
  }
  await flushUpdate();

  const phase3Result = await runPhase(
    "phase3",
    () =>
      runPhase3PlannerAgent({
        userRequest,
        findings: findingsSummary,
        onMessage: (message) => appendPhaseEvents([message], "phase3"),
        llmSelection: options?.llmSelection,
      }),
    timeline,
    {
      flushUpdate,
    }
  );
  const tasksSummary = (phase3Result.parsed as any)?.tasks ?? [];
  const phase3Entry = timeline.find((entry) => entry.id === "phase3");
  if (phase3Entry) {
    phase3Entry.details =
      Array.isArray(tasksSummary) && tasksSummary.length
        ? `Plan drafted with ${tasksSummary.length} tasks.`
        : "No actionable tasks were produced.";
  }
  await flushUpdate();

  const phase4Result = await runPhase(
    "phase4",
    () =>
      runPhase4ReporterAgent({
        userRequest,
        meta,
        findings: findingsSummary,
        tasks: tasksSummary,
        onMessage: (message) => appendPhaseEvents([message], "phase4"),
        llmSelection: options?.llmSelection,
      }),
    timeline,
    {
      flushUpdate,
    }
  );

  const reportMarkdown = (phase4Result.parsed as any)?.report_markdown ?? "";
  const finalSummary = reportMarkdown.split("\n").slice(0, 4).join(" ").trim();
  const phase4Entry = timeline.find((entry) => entry.id === "phase4");
  if (phase4Entry) {
    phase4Entry.summary = finalSummary || "Report generated.";
  }
  await flushUpdate();

  const finalResult: AgentWorkflowResult = {
    timeline,
    conclusion: finalSummary || "Pipeline completed successfully.",
    outputs: {
      meta,
      findings: findingsSummary,
      tasks: tasksSummary,
      report: reportMarkdown,
    },
    eventStream,
  };
  await flushUpdate(finalResult.outputs);
  console.info(
    `[AgentRunner] workflow completed conclusion="${sanitizeForLog(finalResult.conclusion)}" events=${finalResult.eventStream.length}`
  );
  return finalResult;
}
