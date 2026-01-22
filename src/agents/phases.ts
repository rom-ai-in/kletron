import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

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
import { extractJsonObject } from "../lib/jsonExtract";
import {
  Phase1OutputSchema,
  Phase2OutputSchema,
  Phase3OutputSchema,
  Phase4OutputSchema,
  Phase5OutputSchema,
  type TargetFile,
} from "../shared/agentSchemas";

// --- Types & Config ---

export type PhaseKey = AuditPhaseKey;
export const phaseDefinitions = auditPhaseConfig;
export const phaseOrder: PhaseKey[] = auditPhaseOrder;

/**
 * Default fallback values for each phase to ensure the graph can continue
 * even if the agent fails completely.
 */
const FALLBACKS = {
  phase1: {
    context: { mission: "", languages: [], frameworks: [], hotspots: [] },
  },
  phase2: {
    target_files: [],
  },
  phase3: {
    raw_claims: [],
  },
  phase4: {
    verdicts: [],
  },
  phase5: {
    report_markdown:
      "# Audit report\n\nThe reporting agent failed to produce a valid report.\n\n## Status\n- Phase 5 returned an invalid or empty payload.",
    tasks: [],
  },
};

// --- Schema-Guided Agent Wrapper ---

async function runSchemaReactAgent<T extends z.ZodTypeAny>(opts: {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  schema: T;
  fallback: z.infer<T>;
  llmSelection?: LlmSelection;
  extraMessages?: BaseMessage[];
  onMessage?: (message: BaseMessage) => Promise<void> | void;
  maxToolCalls?: number;
}): Promise<{ parsed: z.infer<T>; messages: BaseMessage[] }> {
  const model = getChatModel(opts.llmSelection);
  const agent = createReactAgent({
    llm: model,
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  });

  const inputMessages = [
    ...(opts.extraMessages ?? []),
    { role: "user", content: opts.userPrompt },
  ];

  const stream = await agent.stream(
    { messages: inputMessages },
    { streamMode: "values", recursionLimit: config.graphRecursionLimit }
  );

  const seenMessageIds = new Set<string>();
  const accumulatedMessages: BaseMessage[] = [];
  let lastState: { messages?: BaseMessage[] } | undefined;
  let toolCallCount = 0;
  let toolLimitReached = false;

  // 1. Run the agent loop
  for await (const state of stream) {
    if (!state || typeof state !== "object") continue;
    lastState = state as { messages?: BaseMessage[] };
    if (!Array.isArray(lastState.messages)) continue;

    for (const message of lastState.messages) {
      const idKey =
        typeof message.id === "string"
          ? message.id
          : `${(message as any).role ?? "unknown"}-${typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? "")
          }-${accumulatedMessages.length}`;

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

  // 2. Extract potential JSON from the last assistant message
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
    console.warn(`[${opts.name}] Agent produced no messages. Using fallback.`);
    return { parsed: opts.fallback, messages: finalMessages };
  }

  const content =
    typeof last.content === "string"
      ? last.content
      : JSON.stringify(last.content ?? "");

  // 3. Helper to attempt parsing + validating
  const tryParseAndValidate = (text: string): { success: boolean; data?: any; error?: string } => {
    try {
      const json = extractJsonObject(text);
      const result = opts.schema.safeParse(json);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error.toString() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };

  // 4. Initial attempt
  let attempt = tryParseAndValidate(content);
  if (attempt.success) {
    return { parsed: attempt.data, messages: finalMessages };
  }

  // 5. Repair Loop (1 Attempt)
  // If parsing or validation failed, ask the model to fix it using the error message
  console.warn(`[${opts.name}] JSON invalid or schema mismatch. Attempting repair... Error: ${attempt.error}`);

  try {
    const repairPrompt = [
      "You are a JSON repair tool.",
      "The previous output was invalid JSON or did not match the required schema.",
      `Error details: ${attempt.error}`,
      "",
      "Task: Return ONLY strict JSON that matches the schema. No prose, no markdown.",
      "Input to repair:",
      content,
    ].join("\n");

    const repairResponse = await model.invoke([
      new SystemMessage("Return only strict JSON. Do not include any other text."),
      new HumanMessage(repairPrompt),
    ]);

    const repairedContent =
      typeof repairResponse.content === "string"
        ? repairResponse.content
        : JSON.stringify(repairResponse.content ?? "");

    attempt = tryParseAndValidate(repairedContent);
    if (attempt.success) {
      console.log(`[${opts.name}] Repair successful.`);
      return { parsed: attempt.data, messages: finalMessages };
    }
  } catch (error) {
    console.error(`[${opts.name}] Repair failed completely:`, error);
  }

  // 6. Final Fallback
  console.warn(`[${opts.name}] Using fallback value.`);
  return { parsed: opts.fallback, messages: finalMessages };
}

// --- Phase Runners ---

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
    "Return JSON matching this schema:",
    "- context: { mission: string, languages: string[], frameworks: string[], hotspots: string[] }",
    "",
    "If unsure, return empty arrays.",
  ].join("\n");

  const reconTools = [
    ...allMcpTools.filter((tool) => tool.name !== "list_files"),
    createListFilesTool(2),
  ];

  return runSchemaReactAgent({
    name: "ReconAgent",
    systemPrompt,
    userPrompt,
    tools: reconTools,
    schema: Phase1OutputSchema,
    fallback: FALLBACKS.phase1 as z.infer<typeof Phase1OutputSchema>,
    llmSelection,
    extraMessages,
    onMessage,
    maxToolCalls: 6,
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
    "Return JSON matching this schema:",
    "- target_files: array of { path: string, focus_area: string, score: number (0-100) }",
    "IMPORTANT: output max 20 files.",
    "",
    "If unsure, return empty target_files array.",
  ].join("\n");

  return runSchemaReactAgent({
    name: "StrategistAgent",
    systemPrompt,
    userPrompt,
    tools: allMcpTools,
    schema: Phase2OutputSchema,
    fallback: FALLBACKS.phase2 as z.infer<typeof Phase2OutputSchema>,
    llmSelection: input.llmSelection,
    extraMessages: input.extraMessages,
    onMessage: input.onMessage,
    maxToolCalls: 8,
  });
}

export async function runPhase3InvestigationAgents(input: {
  userRequest: string;
  targetFiles: TargetFile[];
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

  const severityToFindingType = (severity?: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "BLOQUANT";
      case "medium":
      case "low":
        return "WARNING";
      default:
        return "INFO";
    }
  };

  const addLineNumbers = (content: string, startLine = 1) =>
    content
      .split("\n")
      .map((line, idx) => `${String(startLine + idx).padStart(4, " ")} | ${line}`)
      .join("\n");

  const tasks = targets.map(async (target) => {
    if (!target?.path) return;
    const filePath = target.path;
    const focusArea = target.focus_area || "General audit";

    try {
      // Direct read - no guessing. Trusting Phase 2 (and its validation step).
      const contentResult = await client.callTool("read_file", { filePath });
      let content = "";

      if (typeof contentResult === "string") {
        content = contentResult;
        // Basic check for error strings returned as success
        const lower = content.toLowerCase();
        if (lower.includes("no such file") || lower.includes("enoent")) {
          console.warn(`[InvestigatorAgent] File not found (content check): ${filePath}`);
          return;
        }
      } else if (contentResult && typeof contentResult === "object" && "error" in (contentResult as any)) {
        console.warn(`[InvestigatorAgent] File not found (error object): ${filePath}`);
        return;
      } else {
        content = JSON.stringify(contentResult ?? "", null, 2);
      }

      const numberedContent = addLineNumbers(content);

      const userPrompt = [
        `User request: ${input.userRequest}`,
        `Target file: ${filePath}`,
        `Focus area: ${focusArea}`,
        "",
        "Assigned file (with line numbers):",
        numberedContent,
        "",
        "Return JSON matching this schema:",
        "- raw_claims: array of { id, file_path, line_start, line_end, snippet, severity, description, assumption }",
        "severity must be one of: critical, high, medium, low",
        "",
        "If no issues found, return empty raw_claims array.",
      ].join("\n");

      const result = await runSchemaReactAgent({
        name: `InvestigatorAgent:${filePath}`,
        systemPrompt,
        userPrompt,
        tools: [],
        schema: Phase3OutputSchema,
        fallback: FALLBACKS.phase3 as z.infer<typeof Phase3OutputSchema>,
        llmSelection: input.llmSelection,
        extraMessages: input.extraMessages,
        onMessage: input.onMessage,
        maxToolCalls: 0, // Should be 0 since we provide the file content
      });

      const claims = result.parsed.raw_claims;
      claims.forEach((claim) => {
        // Enforce file path consistency
        const finalClaim = {
          ...claim,
          file_path: claim.file_path || filePath,
        };

        rawClaims.push(finalClaim);
        findings.push({
          type: severityToFindingType(finalClaim.severity),
          file: finalClaim.file_path,
          description: finalClaim.description,
          line_start: finalClaim.line_start,
          line_end: finalClaim.line_end,
          claim_id: finalClaim.id,
        });
      });

      if (Array.isArray(result.messages)) {
        allMessages.push(...result.messages);
      }

    } catch (error) {
      console.warn(`[InvestigatorAgent] Error processing ${filePath}:`, error);
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
    "Return JSON matching this schema:",
    "- verdicts: array of { claim_id, status, confidence_score, reasoning, proof_trace }",
    "status must be one of: VERIFIED, REFUTED, PLAUSIBLE, REJECTED",
    "",
    "If unsure, return empty verdicts array.",
  ].join("\n");

  const adjudicatorTools = [
    goToDefinitionTool,
    findReferencesTool,
    referencesTool,
    readFileRangeTool,
  ];

  return runSchemaReactAgent({
    name: "AdjudicatorAgent",
    systemPrompt,
    userPrompt,
    tools: adjudicatorTools,
    schema: Phase4OutputSchema,
    fallback: FALLBACKS.phase4 as z.infer<typeof Phase4OutputSchema>,
    llmSelection: input.llmSelection,
    extraMessages: input.extraMessages,
    onMessage: input.onMessage,
    maxToolCalls: 10,
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
    "Return JSON matching this schema:",
    "- report_markdown: string",
    "- tasks: array of { id, title, priority, impact, effort, steps, acceptance_criteria }",
    "",
    "If unsure, return basic error report.",
  ].join("\n");

  return runSchemaReactAgent({
    name: "ReporterAgent",
    systemPrompt,
    userPrompt,
    tools: [],
    schema: Phase5OutputSchema,
    fallback: FALLBACKS.phase5 as z.infer<typeof Phase5OutputSchema>,
    llmSelection: input.llmSelection,
    extraMessages: input.extraMessages,
    onMessage: input.onMessage,
    maxToolCalls: 0,
  });
}
