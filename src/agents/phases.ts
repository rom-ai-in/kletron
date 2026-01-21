import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { getChatModel, type LlmSelection } from "../llm";
import { config } from "../config";
import {
  allMcpTools,
  createListFilesTool,
  findReferencesTool,
  goToDefinitionTool,
  readFileRangeTool,
  referencesTool,
} from "../tools/mcpTools";
import {
  auditPhaseConfig,
  auditPhaseOrder,
  type AuditPhaseKey,
} from "../shared/graphCatalog";
import { McpClient } from "../mcp/client";

function stripEllipsisOutsideStrings(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "." && input.slice(i, i + 3) === "...") {
      i += 2;
      continue;
    }

    out += ch;
  }

  return out;
}

function removeTrailingCommasOutsideStrings(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j += 1;
      if (input[j] === "}" || input[j] === "]") {
        continue;
      }
    }

    out += ch;
  }

  return out;
}

function sanitizeJsonCandidate(input: string): string {
  const withoutEllipsis = stripEllipsisOutsideStrings(input);
  return removeTrailingCommasOutsideStrings(withoutEllipsis);
}

function stripCodeFences(input: string): string {
  const fenceMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return input;
}

function findFirstJsonObject(input: string): string | null {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractJsonObject(text: string): unknown {
  const trimmed = stripCodeFences(text.trim());
  const attempts: string[] = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    attempts.push(trimmed.slice(first, last + 1));
  }
  const balanced = findFirstJsonObject(trimmed);
  if (balanced) attempts.push(balanced);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      try {
        const sanitized = sanitizeJsonCandidate(attempt);
        return JSON.parse(sanitized);
      } catch {
        // Keep trying other candidates.
      }
    }
  }

  throw new Error("Could not parse JSON output from agent.");
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
  maxToolCalls?: number;
  repairInstructions?: string;
  validateParsed?: (value: unknown) => boolean;
  repairFallback?: unknown;
}) {
  const model = getChatModel(opts.llmSelection);
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
  let toolCallCount = 0;
  let toolLimitReached = false;

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
        await opts.onMessage(message);
      }
      const hasToolCall =
        message.type === "tool" ||
        Boolean(message.additional_kwargs?.function_call) ||
        Boolean(message.additional_kwargs?.tool_calls?.length);
      if (hasToolCall) {
        toolCallCount += 1;
        if (opts.maxToolCalls && toolCallCount >= opts.maxToolCalls) {
          toolLimitReached = true;
          break;
        }
      }
    }
    if (toolLimitReached) break;
  }

  const finalMessages = lastState?.messages ?? accumulatedMessages;
  const lastAssistantWithJson = [...finalMessages]
    .reverse()
    .find(
      (message) =>
        (message as any).role === "assistant" &&
        typeof message.content === "string" &&
        message.content.includes("{")
    );
  const lastAssistant = [...finalMessages]
    .reverse()
    .find((message) => (message as any).role === "assistant");
  const last = lastAssistantWithJson ?? lastAssistant ?? finalMessages.at(-1);
  if (!last) {
    throw new Error("Agent did not produce a final message.");
  }
  const content = typeof last.content === "string" ? last.content : JSON.stringify(last.content ?? "");
  let parsed: unknown;
  const runRepair = async (input: string) => {
    const requirement = opts.repairInstructions
      ? `\n\nRequired JSON shape:\n${opts.repairInstructions}`
      : "";
    const repairPrompt = [
      "You are a JSON repair tool.",
      "Task: Return ONLY strict JSON. No prose, no markdown, no code fences.",
      "If the input contains no JSON, synthesize the minimal valid JSON required by the request.",
      requirement,
      "",
      "Input:",
      input,
    ].join("\n");
    const repair = await model.invoke([
      new SystemMessage("Return only strict JSON. Do not include any other text."),
      new HumanMessage(repairPrompt),
    ]);
    const repairedContent =
      typeof repair.content === "string" ? repair.content : JSON.stringify(repair.content ?? "");
    return extractJsonObject(repairedContent);
  };

  try {
    parsed = extractJsonObject(content);
  } catch {
    try {
      parsed = await runRepair(content);
    } catch {
      if (opts.repairFallback !== undefined) {
        parsed = opts.repairFallback;
      } else {
        throw new Error("Could not parse JSON output from agent.");
      }
    }
  }

  if (toolLimitReached || (opts.validateParsed && !opts.validateParsed(parsed))) {
    try {
      parsed = await runRepair(content);
    } catch {
      if (opts.repairFallback !== undefined) {
        parsed = opts.repairFallback;
      }
    }
  } else if (opts.validateParsed && !opts.validateParsed(parsed) && opts.repairFallback !== undefined) {
    parsed = opts.repairFallback;
  }

  return { parsed, messages: finalMessages };
}

const DEFAULT_RAW_SEVERITY = "medium";

const addLineNumbers = (content: string, startLine = 1) =>
  content
    .split("\n")
    .map((line, idx) => `${String(startLine + idx).padStart(4, " ")} | ${line}`)
    .join("\n");

const normalizeRawClaim = (
  value: any,
  fallback: { filePath: string; index: number }
) => {
  if (!value || typeof value !== "object") return null;
  const assumption =
    value.assumption && typeof value.assumption === "object"
      ? {
        condition:
          typeof value.assumption.condition === "string"
            ? value.assumption.condition
            : "Assumption not specified.",
        related_symbol:
          typeof value.assumption.related_symbol === "string"
            ? value.assumption.related_symbol
            : undefined,
      }
      : { condition: "Assumption not specified." };
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `${fallback.filePath.replace(/[^\w]+/g, "_")}_${fallback.index}`;

  const lineStart =
    typeof value.line_start === "number" && Number.isFinite(value.line_start)
      ? Math.max(1, Math.floor(value.line_start))
      : 1;
  const lineEnd =
    typeof value.line_end === "number" && Number.isFinite(value.line_end)
      ? Math.max(1, Math.floor(value.line_end))
      : lineStart;

  return {
    id,
    file_path:
      typeof value.file_path === "string" && value.file_path.trim()
        ? value.file_path
        : fallback.filePath,
    line_start: lineStart,
    line_end: Math.max(lineStart, lineEnd),
    snippet: typeof value.snippet === "string" ? value.snippet : "",
    severity:
      value.severity === "critical" ||
        value.severity === "high" ||
        value.severity === "medium" ||
        value.severity === "low"
        ? value.severity
        : DEFAULT_RAW_SEVERITY,
    description: typeof value.description === "string" ? value.description : "",
    assumption,
  };
};

export async function runPhase1ReconAgent(
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
    "- context: { mission: string, languages: string[], frameworks: string[], hotspots: string[] }",
    "",
    "If unsure, return: {\"context\":{\"mission\":\"\",\"languages\":[],\"frameworks\":[],\"hotspots\":[]}}",
  ].join("\n");

  const reconTools = [
    ...allMcpTools.filter((tool) => tool.name !== "list_files"),
    createListFilesTool(2),
  ];

  return runJsonReactAgent({
    name: "ReconAgent",
    systemPrompt,
    userPrompt,
    extraMessages,
    onMessage,
    tools: reconTools,
    llmSelection,
    maxToolCalls: 6,
    repairInstructions:
      "{\"context\":{\"mission\":\"...\",\"languages\":[],\"frameworks\":[],\"hotspots\":[]}}",
    validateParsed: (value) =>
      Boolean(
        value &&
        typeof value === "object" &&
        typeof (value as any).context === "object" &&
        Array.isArray((value as any).context?.languages) &&
        Array.isArray((value as any).context?.frameworks) &&
        Array.isArray((value as any).context?.hotspots)
      ),
    repairFallback: { context: { mission: "", languages: [], frameworks: [], hotspots: [] } },
  });
}

export async function runPhase2StrategyAgent(input: {
  userRequest: string;
  context: unknown;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase2.systemPrompt;
  const userPrompt = [
    `User request: ${input.userRequest}`,
    "",
    "Context (from Phase 1):",
    JSON.stringify(input.context ?? {}, null, 2),
    "",
    "Return JSON with:",
    "- target_files: array of { path, focus_area, score } (<= 20 items, score 0-100)",
    "",
    "If unsure, return: {\"target_files\":[]}",
  ].join("\n");

  return runJsonReactAgent({
    name: "StrategistAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: allMcpTools,
    llmSelection: input.llmSelection,
    maxToolCalls: 8,
    repairInstructions:
      "{\"target_files\":[{\"path\":\"...\",\"focus_area\":\"...\",\"score\":0}]}",
    validateParsed: (value) => Boolean(value && Array.isArray((value as any).target_files)),
    repairFallback: { target_files: [] },
  });
}

export async function runPhase3InvestigationAgents(input: {
  userRequest: string;
  targetFiles: Array<{ path: string; focus_area: string; score: number }>;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase3.systemPrompt;
  const client = await McpClient.getInstance();
  const rawClaims: any[] = [];
  const findings: any[] = [];
  const allMessages: BaseMessage[] = [];
  const targets = Array.isArray(input.targetFiles) ? input.targetFiles : [];

  const isMissingFileError = (value: unknown) =>
    typeof value === "string" &&
    (value.includes("ENOENT") || value.toLowerCase().includes("no such file"));

  const resolveFilePath = async (filePath: string) => {
    const bases = [
      "apps/api/src/routes/portals",
      "apps/api/src/routes/portals/company",
      "apps/api/src/routes/portals/tenant",
      "apps/api/src/routes/portals/partner",
      "apps/api/src/routes/portals/superadmin",
      "apps/api/src/services",
      "apps/api/src/middleware",
      "apps/api/src/routes",
      "apps/api/src",
      "apps/web",
      "packages",
      "docs",
      "scripts",
    ];
    const normalized = filePath.replace(/^\.\//, "");
    const candidates = new Set<string>();
    candidates.add(normalized);
    const hasPathSep = normalized.includes("/");
    const hasKnownRoot = /^(apps|packages|docs|scripts|tests|public)\//.test(normalized);
    if (!hasPathSep || !hasKnownRoot) {
      for (const base of bases) {
        candidates.add(`${base}/${normalized}`);
      }
    }
    for (const candidate of candidates) {
      try {
        const content = await client.callTool("read_file", { filePath: candidate });
        if (isMissingFileError(content)) {
          continue;
        }
        if (content && typeof content === "object" && "error" in (content as any)) {
          continue;
        }
        return { filePath: candidate, content };
      } catch {
        // Try next candidate
      }
    }
    return null;
  };

  const severityToFindingType = (severity?: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "BLOQUANT";
      case "medium":
        return "WARNING";
      default:
        return "INFO";
    }
  };

  const tasks = targets.map(async (target, index) => {
    if (!target?.path) return;
    const filePath = String(target.path);
    const focusArea =
      typeof target.focus_area === "string" && target.focus_area.trim()
        ? target.focus_area
        : "General audit";
    try {
      const resolved = await resolveFilePath(filePath);
      if (!resolved) {
        console.warn(`[InvestigatorAgent] Skipping missing file: ${filePath}`);
        return;
      }
      const resolvedPath = resolved.filePath;
      const content =
        typeof resolved.content === "string"
          ? resolved.content
          : JSON.stringify(resolved.content ?? "", null, 2);
      const numberedContent = addLineNumbers(content);

      const userPrompt = [
        `User request: ${input.userRequest}`,
        `Target file: ${resolvedPath}`,
        `Focus area: ${focusArea}`,
        "",
        "Assigned file (with line numbers):",
        numberedContent,
        "",
        "Return JSON with:",
        "- raw_claims: array of objects { id, file_path, line_start, line_end, snippet, severity, description, assumption: { condition, related_symbol? } }",
        "",
        "If unsure, return: {\"raw_claims\":[]}",
      ].join("\n");

      const result = await runJsonReactAgent({
        name: `InvestigatorAgent:${filePath}`,
        systemPrompt,
        userPrompt,
        extraMessages: input.extraMessages ?? [],
        onMessage: input.onMessage,
        tools: [],
        llmSelection: input.llmSelection,
        repairInstructions:
          "{\"raw_claims\":[{\"id\":\"...\",\"file_path\":\"...\",\"line_start\":1,\"line_end\":1,\"snippet\":\"\",\"severity\":\"medium\",\"description\":\"\",\"assumption\":{\"condition\":\"...\",\"related_symbol\":\"\"}}]}",
        validateParsed: (value) => Boolean(value && Array.isArray((value as any).raw_claims)),
        repairFallback: { raw_claims: [] },
      });

      const claims = Array.isArray((result.parsed as any)?.raw_claims)
        ? (result.parsed as any).raw_claims
        : [];
      if (Array.isArray(claims)) {
        claims.forEach((claim, claimIndex) => {
          const normalized = normalizeRawClaim(claim, { filePath: resolvedPath, index: claimIndex });
          if (normalized) {
            rawClaims.push(normalized);
            findings.push({
              type: severityToFindingType(normalized.severity),
              file: resolvedPath,
              description: normalized.description,
              line_start: normalized.line_start,
              line_end: normalized.line_end,
              claim_id: normalized.id,
            });
          }
        });
      }

      if (Array.isArray(result.messages)) {
        allMessages.push(...result.messages);
      }
    } catch (error) {
      console.warn(
        `[InvestigatorAgent] Failed to load or analyze file ${filePath}: ${String(
          (error as Error)?.message ?? error
        )}`
      );
    }
  });

  await Promise.all(tasks);

  return { parsed: { raw_claims: rawClaims, findings }, messages: allMessages };
}

export async function runPhase4AdjudicatorAgent(input: {
  claim: any;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase4.systemPrompt;

  const userPrompt = [
    "Claim to adjudicate:",
    JSON.stringify(input.claim ?? {}, null, 2),
    "",
    "Return JSON with:",
    "- verdicts: array of one object { claim_id, status, confidence_score, reasoning, proof_trace }",
    "",
    "If unsure, return: {\"verdicts\":[]}",
  ].join("\n");

  const adjudicatorTools = [
    goToDefinitionTool,
    findReferencesTool,
    referencesTool,
    readFileRangeTool,
  ];

  return runJsonReactAgent({
    name: "AdjudicatorAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: adjudicatorTools,
    llmSelection: input.llmSelection,
    maxToolCalls: 10,
    repairInstructions:
      "{\"verdicts\":[{\"claim_id\":\"...\",\"status\":\"VERIFIED\",\"confidence_score\":90,\"reasoning\":\"...\",\"proof_trace\":[\"file.ts:1\"]}]}",
    validateParsed: (value) => Boolean(value && Array.isArray((value as any).verdicts)),
    repairFallback: { verdicts: [] },
  });
}

export async function runPhase5ReporterAgent(input: {
  userRequest: string;
  context: unknown;
  verifiedFindings: unknown;
  rawClaims: unknown;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  llmSelection?: LlmSelection;
}) {
  const systemPrompt = auditPhaseConfig.phase5.systemPrompt;
  const userPrompt = [
    `User request: ${input.userRequest}`,
    "",
    "Context:",
    JSON.stringify(input.context ?? {}, null, 2),
    "",
    "Verified findings:",
    JSON.stringify(input.verifiedFindings ?? {}, null, 2),
    "",
    "Raw claims (for traceability):",
    JSON.stringify(input.rawClaims ?? {}, null, 2),
    "",
    "Return JSON with:",
    "- report_markdown: string (include sections: Executive summary, Key findings, Evidence vault, Remediation plan)",
    "- tasks: array of objects { id, title, priority, impact, effort, steps, acceptance_criteria }",
    "",
    "If unsure, return: {\"report_markdown\":\"\",\"tasks\":[]}",
  ].join("\n");

  return runJsonReactAgent({
    name: "ReporterAgent",
    systemPrompt,
    userPrompt,
    extraMessages: input.extraMessages ?? [],
    onMessage: input.onMessage,
    tools: [],
    llmSelection: input.llmSelection,
    maxToolCalls: 0,
    repairInstructions:
      "{\"report_markdown\":\"...\",\"tasks\":[{\"id\":\"...\",\"title\":\"...\",\"priority\":\"...\",\"impact\":\"...\",\"effort\":\"...\",\"steps\":[],\"acceptance_criteria\":[]}]}",
    validateParsed: (value) =>
      Boolean(
        value &&
        typeof (value as any).report_markdown === "string" &&
        Array.isArray((value as any).tasks)
      ),
    repairFallback: {
      report_markdown: [
        "# Audit report",
        "",
        "The reporting agent failed to produce a valid report.",
        "",
        "## Status",
        "- Phase 5 returned an invalid or empty payload.",
      ].join("\n"),
      tasks: [],
    },
  });
}
