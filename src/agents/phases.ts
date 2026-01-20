import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";

import { getChatModel } from "../llm";
import {
  describeStructureTool,
  gitBlameTool,
  gitDiffTool,
  gitGrepTool,
  gitLogTool,
  listFilesTool,
  readFileRangeTool,
  readFileTool,
  repoMetricsTool,
  searchCodeTool,
  todoSearchTool,
} from "../tools/mcpTools";

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

export type PhaseKey = "phase1" | "phase2" | "phase3" | "phase4";

const phaseConfig: Record<
  PhaseKey,
  {
    id: PhaseKey;
    label: string;
    summary: string;
    description: string;
    systemPrompt: string;
  }
> = {
  phase1: {
    id: "phase1",
    label: "Phase 1 — Map",
    summary: "Generate a repo map + meta data.",
    description:
      "Prefer repo metrics, repo structure, and targeted search to keep the survey light.",
    systemPrompt: [
      "You are Phase1MapperAgent.",
      "Mission: map the target Git repository without reading everything.",
      "Use tools to: list structure, detect languages/frameworks, and identify critical areas (auth, payments, infra, migrations, CI/CD, security).",
      "Rules:",
      "- Prefer repo_metrics + describe_structure + search_code + git_log.",
      "- Do NOT read more than 5 files; only read when necessary.",
      "- Output MUST be valid JSON only (no markdown).",
    ].join("\n"),
  },
  phase2: {
    id: "phase2",
    label: "Phase 2 — Audit",
    summary: "Produce focused findings within a limited scope.",
    description:
      "Use git diffs, search, and range reads to generate evidence tied to recent activity files.",
    systemPrompt: [
      "You are Phase2AuditorAgent.",
      "Mission: produce focused findings on a limited scope (max 20 files).",
      "Rules:",
      "- Audit style/architecture/security/tests quickly and pragmatically.",
      "- Use git_log/git_diff/git_blame/search_code/read_file_range/read_file/git_grep as needed.",
      "- Do NOT audit more than 20 files; prioritize by git recency and hotspot signals.",
      "- Output MUST be valid JSON only (no markdown).",
    ].join("\n"),
  },
  phase3: {
    id: "phase3",
    label: "Phase 3 — Plan",
    summary: "Turn findings into actionable tickets.",
    description:
      "Prioritize by impact · effort and create acceptance criteria for each task.",
    systemPrompt: [
      "You are Phase3PlannerAgent.",
      "Mission: turn findings into an actionable plan (tickets).",
      "Rules:",
      "- No tools required; rely on the provided findings.",
      "- Output MUST be valid JSON only (no markdown).",
    ].join("\n"),
  },
  phase4: {
    id: "phase4",
    label: "Phase 4 — Report",
    summary: "Craft a final markdown report.",
    description:
      "Combine executive summary, repo map, findings, plan, and annexes into a tidy report.",
    systemPrompt: [
      "You are Phase4ReporterAgent.",
      "Mission: produce a stable final markdown report combining repo map, risks/findings, and task plan.",
      "Rules:",
      "- Do NOT call tools; only generate content.",
      "- Output MUST be valid JSON only (no markdown outside the JSON string).",
    ].join("\n"),
  },
};

export const phaseDefinitions = phaseConfig;
export const phaseOrder: PhaseKey[] = ["phase1", "phase2", "phase3", "phase4"];

async function runJsonReactAgent(opts: {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  tools: any[];
  extraMessages?: BaseMessage[];
}) {
  const model = getChatModel();
  const agent = createReactAgent({
    llm: model,
    tools: opts.tools,
    prompt: new SystemMessage(opts.systemPrompt),
    name: opts.name,
  });

  const response = await agent.invoke({
    messages: [...(opts.extraMessages ?? []), { role: "user", content: opts.userPrompt }],
  });

  const last = response.messages?.at(-1);
  const content = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
  const parsed = extractJsonObject(content);

  return { parsed, messages: response.messages ?? [] };
}

export async function runPhase1MapperAgent(userRequest: string, extraMessages: BaseMessage[] = []) {
  const systemPrompt = phaseConfig.phase1.systemPrompt;

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
    tools: [repoMetricsTool, describeStructureTool, listFilesTool, searchCodeTool, gitLogTool, todoSearchTool, readFileTool],
  });

  return { parsed, messages };
}

export async function runPhase2AuditorAgent(input: {
  userRequest: string;
  meta: unknown;
  suggestedAuditFiles?: string[];
  extraMessages?: BaseMessage[];
}) {
  const systemPrompt = phaseConfig.phase2.systemPrompt;

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
    tools: [gitLogTool, gitDiffTool, gitBlameTool, gitGrepTool, searchCodeTool, readFileRangeTool, readFileTool, listFilesTool],
  });

  return { parsed, messages };
}

export async function runPhase3PlannerAgent(input: {
  userRequest: string;
  findings: unknown;
  extraMessages?: BaseMessage[];
}) {
  const systemPrompt = phaseConfig.phase3.systemPrompt;

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
    tools: [],
  });

  return { parsed, messages };
}

export async function runPhase4ReporterAgent(input: {
  userRequest: string;
  meta: unknown;
  findings: unknown;
  tasks: unknown;
  extraMessages?: BaseMessage[];
}) {
  const systemPrompt = phaseConfig.phase4.systemPrompt;

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
    tools: [],
  });

  return { parsed, messages };
}
