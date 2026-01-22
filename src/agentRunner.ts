import { BaseMessage, SystemMessage } from "@langchain/core/messages";

import {
  phaseDefinitions,
  phaseOrder,
  runPhase1ReconAgent,
  runPhase2StrategyAgent,
  runPhase3InvestigationAgents,
  runPhase4AdjudicatorAgent,
  runPhase5ReporterAgent,
  type PhaseKey,
} from "./agents/phases";
import { normalizeAndValidateTargetFiles } from "./lib/repoPath";
import {
  formatAuditContextPrompt,
  formatAuditContextSummary,
  type AuditContext,
} from "./shared/auditContext";
import type { AuditState, TaskTicket } from "./graph";
import { auditService } from "./services/auditService";

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
    context: AuditState["context"];
    target_files: AuditState["target_files"];
    raw_claims: AuditState["raw_claims"];
    verified_findings: AuditState["verified_findings"];
    findings: AuditState["findings"];
    tasks: TaskTicket[];
    report: string;
    meta?: Record<string, unknown>;
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
  toolCallId?: string;
  content: string;
  toolNote?: string;
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
  auditContext?: AuditContext | null;
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
    `[AgentRunner] event ${event.id} kind=${event.kind} phase=${phase} role=${event.role}${toolInfo} content="${snippet}${event.content.length > LOG_CONTENT_LIMIT ? "…" : ""
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

function summarizePhaseEvents(events: AgentEvent[]) {
  const toolEvents = events.filter((event) => event.kind === "tool");
  const toolCount = toolEvents.length;
  const filesRead = toolEvents.filter(
    (event) => event.name === "read_file" || event.name === "read_file_range"
  ).length;
  const searches = toolEvents.filter(
    (event) => event.name === "search_code" || event.name === "git_grep" || event.name === "structural_search"
  ).length;
  const listFiles = toolEvents.filter((event) => event.name === "list_files").length;
  const repos = toolEvents.filter((event) => event.name === "repo_metrics").length;
  const parts = [
    `Summary: tools=${toolCount}`,
    `files_read=${filesRead}`,
    `searches=${searches}`,
    `list_files=${listFiles}`,
    `repo_metrics=${repos}`,
  ];
  return parts.join(" · ");
}

function hasMeaningfulThoughts(thoughts: string[]) {
  return thoughts.some((entry) => entry.trim().length > 0);
}

function guessToolName(message: BaseMessage) {
  const functionCall = message.additional_kwargs?.function_call;
  if (functionCall?.name) {
    return functionCall.name;
  }
  const toolCalls =
    (message as BaseMessage & { tool_calls?: unknown[] }).tool_calls ??
    message.additional_kwargs?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length) {
    const first = toolCalls[0] as { name?: unknown; function?: { name?: unknown } };
    if (typeof first?.name === "string") return first.name;
    if (typeof first?.function?.name === "string") return first.function.name;
    return undefined;
  }
  if (message.type === "tool" && typeof message.name === "string" && message.name) {
    return message.name;
  }
  return undefined;
}

function extractToolArgs(message: BaseMessage): string | undefined {
  const functionCall = message.additional_kwargs?.function_call as
    | { arguments?: unknown }
    | undefined;
  if (functionCall?.arguments !== undefined) {
    return typeof functionCall.arguments === "string"
      ? functionCall.arguments
      : JSON.stringify(functionCall.arguments);
  }
  const toolCalls =
    (message as BaseMessage & {
      tool_calls?: Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>;
    }).tool_calls ??
    (message.additional_kwargs?.tool_calls as
      | Array<{ args?: unknown; arguments?: unknown; function?: { arguments?: unknown } }>
      | undefined);
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

function extractToolCallId(message: BaseMessage): string | undefined {
  const direct = (message as BaseMessage & { tool_call_id?: string }).tool_call_id;
  if (direct) return String(direct);
  const extra = message.additional_kwargs as { tool_call_id?: string } | undefined;
  if (extra?.tool_call_id) return String(extra.tool_call_id);
  const toolCalls =
    (message as BaseMessage & { tool_calls?: Array<{ id?: string }> }).tool_calls ??
    (message.additional_kwargs?.tool_calls as Array<{ id?: string }> | undefined);
  const first = Array.isArray(toolCalls) ? toolCalls[0] : undefined;
  if (first?.id) return String(first.id);
  return undefined;
}

function createAgentEvent(
  message: BaseMessage,
  phaseId: PhaseKey | string,
  phaseLabel: string,
  eventId: string
): AgentEvent {
  const role = ("role" in message ? message.role ?? message.type ?? "assistant" : message.type ?? "assistant") as string;
  const hasToolCall =
    message.type === "tool" ||
    Boolean(message.additional_kwargs?.function_call) ||
    Boolean(message.additional_kwargs?.tool_calls?.length) ||
    Boolean((message as BaseMessage & { tool_calls?: unknown[] }).tool_calls?.length);
  const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";
  const normalizedMessageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
  const isSystemRole = normalizedRole === "system" || normalizedMessageType === "system";
  const isUserRole =
    normalizedRole === "user" ||
    normalizedRole === "human" ||
    normalizedMessageType === "user" ||
    normalizedMessageType === "human";
  const isPhaseUser = (phaseId as string) === "user";
  const kind: AgentEventKind = hasToolCall
    ? "tool"
    : isSystemRole
      ? "system"
      : isPhaseUser || isUserRole
        ? "user"
        : "assistant";
  const messageContent = describeMessageContent(message);
  const isToolResult = normalizedMessageType === "tool";
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
    toolArgs: extractToolArgs(message),
    timestamp: new Date().toISOString(),
  };
}

function createInitialTimeline(auditContext?: AuditContext | null): TimelineEvent[] {
  const contextPrompt = formatAuditContextPrompt(auditContext);
  const contextSummary = formatAuditContextSummary(auditContext);
  return phaseOrder.map((phaseId) => ({
    id: phaseId,
    label: phaseDefinitions[phaseId].label,
    status: "pending",
    summary: phaseDefinitions[phaseId].summary,
    details: contextSummary
      ? `${phaseDefinitions[phaseId].description}\n\nAudit context: ${contextSummary}`
      : phaseDefinitions[phaseId].description,
    systemPrompt: contextPrompt
      ? `${phaseDefinitions[phaseId].systemPrompt}\n\n${contextPrompt}`
      : phaseDefinitions[phaseId].systemPrompt,
    thoughtLog: [],
  }));
}

async function describeContext(context: AuditState["context"]) {
  const highlights: string[] = [];
  if (context.languages?.length) {
    highlights.push(`Languages: ${context.languages.join(", ")}`);
  }
  if (context.frameworks?.length) {
    highlights.push(`Frameworks: ${context.frameworks.join(", ")}`);
  }
  if (context.hotspots?.length) {
    highlights.push(`Hotspots: ${context.hotspots.slice(0, 4).join(", ")}${context.hotspots.length > 4 ? "…" : ""}`);
  }
  if (!highlights.length) {
    highlights.push("Context captured with no highlights.");
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
    if (formattedEvents.length > 0) {
      const assistantEntries = formattedEvents.filter((entry) => entry.kind === "assistant");
      if (assistantEntries.length) {
        event.thoughtLog = assistantEntries.map((entry) => `${entry.role}: ${entry.content}`);
      } else {
        event.thoughtLog = ["No assistant messages emitted."];
      }
    } else if (messages.length > 0) {
      const assistantMessages = messages.filter((message) => {
        const role = "role" in message ? message.role : message.type ?? "assistant";
        const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";
        const messageType = typeof message.type === "string" ? message.type.toLowerCase() : "";
        if (messageType === "tool" || messageType === "system") return false;
        if (normalizedRole === "user" || normalizedRole === "human") return false;
        return true;
      });
      event.thoughtLog = assistantMessages.length
        ? assistantMessages.map(formatThought)
        : ["No assistant messages emitted."];
    } else {
      event.thoughtLog = ["No assistant messages emitted."];
    }
    if (!hasMeaningfulThoughts(event.thoughtLog)) {
      event.thoughtLog = ["No assistant messages emitted."];
    }
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
  const timeline = createInitialTimeline(options?.auditContext);
  const eventStream: AgentEvent[] = [];
  let eventCounter = 0;
  const nextEventId = () => `event-${eventCounter++}`;
  const contextSummary = formatAuditContextSummary(options?.auditContext);
  const contextPrompt = formatAuditContextPrompt(options?.auditContext);
  const contextMessages = contextPrompt ? [new SystemMessage(contextPrompt)] : [];
  const phaseUserMessageLogged = new Set<PhaseKey>();

  // 1. Create Session
  const sessionId = await auditService.createSession(userRequest);
  console.info(`[AgentRunner] Started MongoDB session: ${sessionId}`);

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

    // 2. Update Session (Background)
    if (sessionId) {
      // We persist the current state of the workflow
      // This includes the timeline and event stream so far
      auditService.updateSession(sessionId, {
        timeline: payload.timeline,
        eventStream: payload.eventStream, // Caution: this grows large
        outputs: payload.outputs as any // Types might be lose here, safe to cast
      }).catch(err => console.error("Background update failed", err));
    }
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

  if (contextSummary) {
    const contextEvent: AgentEvent = {
      id: nextEventId(),
      phaseId: "user",
      phaseLabel: "Audit context",
      kind: "system",
      role: "system",
      content: contextSummary,
      timestamp: new Date().toISOString(),
    };
    eventStream.push(contextEvent);
    logAgentEvent(contextEvent);
  }

  await flushUpdate();

  const appendPhaseEvents = async (messages: BaseMessage[], phaseId: PhaseKey) => {
    const phaseLabel = phaseDefinitions[phaseId].label;
    const createdEvents: AgentEvent[] = [];
    for (const message of messages) {
      const role = "role" in message ? message.role ?? message.type ?? "" : message.type ?? "";
      const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";
      if ((phaseId as string) !== "user" && (normalizedRole === "user" || normalizedRole === "human")) {
        if (phaseUserMessageLogged.has(phaseId)) continue;
        phaseUserMessageLogged.add(phaseId);
      }
      const event = createAgentEvent(message, phaseId, phaseLabel, nextEventId());
      eventStream.push(event);
      logAgentEvent(event);
      createdEvents.push(event);
      await flushUpdate();
    }
    return createdEvents;
  };

  try {
    const phase1Result = await runPhase(
      "phase1",
      () =>
        runPhase1ReconAgent(
          userRequest,
          contextMessages,
          async (message) => { await appendPhaseEvents([message], "phase1"); },
          options?.llmSelection
        ),
      timeline,
      {
        flushUpdate,
      }
    );
    const parsedContext = (phase1Result.parsed as any)?.context ?? {};
    const context: AuditState["context"] = {
      mission:
        typeof parsedContext.mission === "string" && parsedContext.mission.trim()
          ? parsedContext.mission
          : userRequest,
      languages: Array.isArray(parsedContext.languages) ? parsedContext.languages : [],
      frameworks: Array.isArray(parsedContext.frameworks) ? parsedContext.frameworks : [],
      hotspots: Array.isArray(parsedContext.hotspots) ? parsedContext.hotspots : [],
    };
    const phase1Entry = timeline.find((entry) => entry.id === "phase1");
    if (phase1Entry) {
      phase1Entry.details = await describeContext(context);
    }
    await flushUpdate();

    const phase2Result = await runPhase(
      "phase2",
      () =>
        runPhase2StrategyAgent({
          userRequest,
          context,
          extraMessages: contextMessages,
          onMessage: async (message) => { await appendPhaseEvents([message], "phase2"); },
          llmSelection: options?.llmSelection,
        }),
      timeline,
      {
        flushUpdate,
      }
    );
    const initialTargets = (phase2Result.parsed as any)?.target_files ?? [];
    const { validTargets, droppedTargets } = await normalizeAndValidateTargetFiles(
      Array.isArray(initialTargets) ? initialTargets : []
    );
    const targetFiles = validTargets;

    const phase2Entry = timeline.find((entry) => entry.id === "phase2");
    if (phase2Entry) {
      if (droppedTargets.length > 0) {
        console.warn(`[Phase2] Dropped targets: ${JSON.stringify(droppedTargets)}`);
      }
      const droppedNote = droppedTargets.length ? ` (Dropped ${droppedTargets.length} invalid)` : "";
      phase2Entry.details =
        Array.isArray(targetFiles) && targetFiles.length
          ? `Targets selected: ${targetFiles.length}${droppedNote}`
          : "No valid target files were selected.";
    }
    await flushUpdate();

    const phase3Result = await runPhase(
      "phase3",
      () =>
        runPhase3InvestigationAgents({
          userRequest,
          targetFiles,
          extraMessages: contextMessages,
          onMessage: async (message) => { await appendPhaseEvents([message], "phase3"); },
          llmSelection: options?.llmSelection,
        }),
      timeline,
      {
        flushUpdate,
      }
    );
    const phase3Parsed = (phase3Result.parsed as any) ?? {};
    const rawClaims = phase3Parsed?.raw_claims ?? [];
    const findings = phase3Parsed?.findings ?? [];
    const phase3Entry = timeline.find((entry) => entry.id === "phase3");
    if (phase3Entry) {
      phase3Entry.details =
        Array.isArray(rawClaims) && rawClaims.length
          ? `Raw claims captured: ${rawClaims.length}`
          : Array.isArray(findings) && findings.length
            ? `Findings captured: ${findings.length}`
            : "No raw claims were produced.";
    }
    await flushUpdate();

    const phase4Result = await runPhase(
      "phase4",
      async () => {
        const severityRank = (severity?: string) => {
          switch (severity) {
            case "critical":
              return 3;
            case "high":
              return 2;
            case "medium":
              return 1;
            default:
              return 0;
          }
        };
        const maxAdjudicationClaims = 12;
        const adjudicationTargets = (rawClaims ?? [])
          .filter((claim: any) => severityRank(claim?.severity) >= 2)
          .sort((a: any, b: any) => severityRank(b?.severity) - severityRank(a?.severity))
          .slice(0, maxAdjudicationClaims);
        const verdicts: AuditState["verified_findings"] = [];
        for (const claim of adjudicationTargets) {
          if (!claim) continue;
          const verdictResult = await runPhase4AdjudicatorAgent({
            claim,
            extraMessages: contextMessages,
            onMessage: async (message) => { await appendPhaseEvents([message], "phase4"); },
            llmSelection: options?.llmSelection,
          });
          const parsed = (verdictResult.parsed as any)?.verdicts ?? [];
          const verdict = Array.isArray(parsed) ? parsed[0] : undefined;
          if (!verdict) continue;
          const status =
            verdict.status === "VERIFIED" || verdict.status === "REFUTED" || verdict.status === "PLAUSIBLE"
              ? verdict.status
              : verdict.status === "REJECTED"
                ? "REFUTED"
                : "PLAUSIBLE";
          verdicts.push({
            claim_id: verdict.claim_id ?? claim.id,
            status,
            verdict_reason: verdict.reasoning ?? "",
            final_severity: status === "REFUTED" ? "none" : claim.severity ?? "medium",
          });
        }
        return { verified_findings: verdicts };
      },
      timeline,
      {
        flushUpdate,
      }
    );
    const verdicts = (phase4Result as { verified_findings?: AuditState["verified_findings"] }).verified_findings ?? [];
    const phase4Entry = timeline.find((entry) => entry.id === "phase4");
    if (phase4Entry) {
      phase4Entry.details =
        Array.isArray(verdicts) && verdicts.length
          ? `Verified findings: ${verdicts.length}`
          : "No verified findings were produced.";
    }
    await flushUpdate();

    const phase5Result = await runPhase(
      "phase5",
      () =>
        runPhase5ReporterAgent({
          userRequest,
          context,
          verifiedFindings: verdicts,
          rawClaims,
          extraMessages: contextMessages,
          onMessage: async (message) => { await appendPhaseEvents([message], "phase5"); },
          llmSelection: options?.llmSelection,
        }),
      timeline,
      {
        flushUpdate,
      }
    );

    const reportMarkdown = (phase5Result.parsed as any)?.report_markdown ?? "";
    const tasksSummary = (phase5Result.parsed as any)?.tasks ?? [];
    const shouldFallbackReport = !(typeof reportMarkdown === "string" && reportMarkdown.trim());
    const safeReportMarkdown = shouldFallbackReport
      ? [
        "# Audit report",
        "",
        "No report content was generated by the model. This is an auto-generated fallback summary.",
        "",
        "## Status",
        "- Phase 1: completed",
        "- Phase 2: completed",
        "- Phase 3: completed",
        "- Phase 4: completed",
        "- Phase 5: completed (empty output)",
        "",
        "## Summary",
        `- Target files: ${Array.isArray(targetFiles) ? targetFiles.length : 0}`,
        `- Raw claims: ${Array.isArray(rawClaims) ? rawClaims.length : 0}`,
        `- Verified findings: ${Array.isArray(verdicts) ? verdicts.length : 0}`,
        "",
        "## Notes",
        Array.isArray(targetFiles) && targetFiles.length === 0
          ? "- No target files were selected in Phase 2."
          : "- Target files were selected.",
        Array.isArray(rawClaims) && rawClaims.length === 0
          ? "- No raw claims were produced in Phase 3."
          : "- Raw claims were produced.",
      ].join("\n")
      : reportMarkdown;
    const finalSummary = safeReportMarkdown.split("\n").slice(0, 4).join(" ").trim();
    const phase5Entry = timeline.find((entry) => entry.id === "phase5");
    if (phase5Entry) {
      phase5Entry.summary = finalSummary || "Report generated.";
    }
    await flushUpdate();

    const finalResult: AgentWorkflowResult = {
      timeline,
      conclusion: finalSummary || "Pipeline completed successfully.",
      outputs: {
        context,
        target_files: targetFiles,
        raw_claims: rawClaims,
        verified_findings: verdicts,
        findings: Array.isArray(findings) ? findings : [],
        tasks: Array.isArray(tasksSummary) ? tasksSummary : [],
        report: safeReportMarkdown,
        meta: {},
      },
      eventStream,
    };
    await flushUpdate(finalResult.outputs);
    console.info(
      `[AgentRunner] workflow completed conclusion="${sanitizeForLog(finalResult.conclusion)}" events=${finalResult.eventStream.length}`
    );

    // 3. Complete Session
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
