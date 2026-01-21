import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";

import { getChatModel, type LlmSelection } from "../llm";
import { allMcpTools } from "../tools/mcpTools";
import {
  auditPhaseConfig,
  auditPhaseOrder,
  type AuditPhaseKey,
} from "../shared/graphCatalog";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const candidate = trimmed.slice(first, last + 1);
      return JSON.parse(candidate);
    }
    throw new Error("Could not parse JSON output from agent.");
  }
}

export type PhaseKey = AuditPhaseKey;

export const phaseDefinitions = auditPhaseConfig;
export const phaseOrder: PhaseKey[] = auditPhaseOrder;

async function runJsonReactAgent(opts: {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  llmSelection?: LlmSelection;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
}) {
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
  const last = finalMessages.at(-1);
  if (!last) {
    throw new Error("Agent did not produce a final message.");
  }
  const content = typeof last.content === "string" ? last.content : JSON.stringify(last.content ?? "");
  const parsed = extractJsonObject(content);

  return { parsed, messages: finalMessages };
}

export async function runPhase1MapperAgent(
  userRequest: string,
  extraMessages: BaseMessage[] = [],
  onMessage?: (message: BaseMessage) => Promise<void> | void,
  llmSelection?: LlmSelection
) {
  const systemPrompt = auditPhaseConfig.phase1.systemPrompt;

  const userPrompt = [
    `User request: ${userRequest}`,
    "",
    "Return JSON with:",
    "- repo_map_markdown: string (a markdown section titled '## Repo map')",
    "- meta: object with keys: languages, frameworks, packages, entrypoints, critical_areas, hotspots, recent_changes_summary",
    "- suggested_audit_files: string[] (<= 20 file paths)",
  ].join("\n");

  const { parsed, messages } = await runJsonReactAgent({
    name: "Phase1MapperAgent",
    systemPrompt,
    userPrompt,
    extraMessages,
    onMessage,
    tools: allMcpTools,
    llmSelection,
  });

  return { parsed, messages };
}

export async function runPhase2AuditorAgent(input: {
  userRequest: string;
  meta: unknown;
  suggestedAuditFiles?: string[];
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase2.systemPrompt;

  const userPrompt = [
    `User request: ${input.userRequest}`,
    "",
    "Context meta (from Phase 1):",
    JSON.stringify(input.meta ?? {}, null, 2),
    "",
    "Suggested audit files (may be empty):",
    JSON.stringify(input.suggestedAuditFiles ?? [], null, 2),
    "",
    "Return JSON with:",
    "- audited_files: string[] (<= 20)",
    "- findings: array of objects { id, title, severity, description, evidence: [{ tool, filePath, snippet }], recommendation }",
  ].join("\n");

  const { parsed, messages } = await runJsonReactAgent({
    name: "Phase2AuditorAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: allMcpTools,
    llmSelection: input.llmSelection,
  });

  return { parsed, messages };
}

export async function runPhase3PlannerAgent(input: {
  userRequest: string;
  findings: unknown;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase3.systemPrompt;

  const userPrompt = [
    `User request: ${input.userRequest}`,
    "",
    "Findings:",
    JSON.stringify(input.findings ?? {}, null, 2),
    "",
    "Return JSON with:",
    "- tasks: array of objects { id, title, priority, impact, effort, steps, acceptance_criteria }",
  ].join("\n");

  const { parsed, messages } = await runJsonReactAgent({
    name: "Phase3PlannerAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: allMcpTools,
    llmSelection: input.llmSelection,
  });

  return { parsed, messages };
}

export async function runPhase4ReporterAgent(input: {
  userRequest: string;
  meta: unknown;
  findings: unknown;
  tasks: unknown;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase4.systemPrompt;

  const userPrompt = [
    `User request: ${input.userRequest}`,
    "",
    "Meta:",
    JSON.stringify(input.meta ?? {}, null, 2),
    "",
    "Findings:",
    JSON.stringify(input.findings ?? {}, null, 2),
    "",
    "Tasks:",
    JSON.stringify(input.tasks ?? {}, null, 2),
    "",
    "Return JSON with:",
    "- report_markdown: string (full markdown report; include sections: Executive summary, Repo map, Findings, Plan, Annexes)",
  ].join("\n");

  const { parsed, messages } = await runJsonReactAgent({
    name: "Phase4ReporterAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: allMcpTools,
    llmSelection: input.llmSelection,
  });

  return { parsed, messages };
}
