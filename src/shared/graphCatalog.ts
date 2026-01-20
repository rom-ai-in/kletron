import {
  actionReportPrompt,
  clarifyWithUserInstructions,
  compressResearchSystemPrompt,
  findingsSummaryPrompt,
  leadResearcherPrompt,
  researchPlanningPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "../deepResearch/prompts";
import {
  simpleReactGraphId,
  simpleReactPhaseDescription,
  simpleReactPhaseId,
  simpleReactPhaseLabel,
  simpleReactPhaseSummary,
  simpleReactSystemPrompt,
  simpleReactToolNames,
} from "./reactAgentConfig";

export type PhaseDefinition = {
  id: string;
  label: string;
  summary: string;
  description: string;
  systemPrompt: string;
};

export type AuditPhaseKey = "phase1" | "phase2" | "phase3" | "phase4";
export type DeepResearchPhaseKey =
  | "clarify"
  | "brief"
  | "plan"
  | "research"
  | "summary"
  | "report";
export type GraphId = "audit" | "deep_research" | typeof simpleReactGraphId;

export type GraphNodePrompt = {
  id: string;
  label: string;
  prompt: string;
};

export const auditPhaseConfig: Record<AuditPhaseKey, PhaseDefinition> = {
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

export const auditPhaseOrder: AuditPhaseKey[] = [
  "phase1",
  "phase2",
  "phase3",
  "phase4",
];

export const auditPhaseDefinitions = auditPhaseOrder.map(
  (phaseId) => auditPhaseConfig[phaseId]
);

export const deepResearchPhaseConfig: Record<DeepResearchPhaseKey, PhaseDefinition> = {
  clarify: {
    id: "clarify",
    label: "Phase 1 — Clarify",
    summary: "Confirm scope and goals for the code research.",
    description: "Analyze the request and ask clarifying questions if needed.",
    systemPrompt: clarifyWithUserInstructions,
  },
  brief: {
    id: "brief",
    label: "Phase 2 — Research brief",
    summary: "Create a structured research brief from the request.",
    description: "Translate the request into a precise research question for the repo.",
    systemPrompt: transformMessagesIntoResearchTopicPrompt,
  },
  plan: {
    id: "plan",
    label: "Phase 3 — Research plan",
    summary: "Blueprint the MCP tooling approach, targeted files, and architecture study.",
    description:
      "Convert the research brief into a detailed plan that lists target files, architecture hotspots, and the MCP tools that will be used to inspect them.",
    systemPrompt: researchPlanningPrompt,
  },
  research: {
    id: "research",
    label: "Phase 4 — Deep research",
    summary: "Supervisor delegates research and gathers evidence.",
    description: "Use MCP tools to collect findings and citations.",
    systemPrompt: leadResearcherPrompt,
  },
  summary: {
    id: "summary",
    label: "Phase 5 — Findings summary",
    summary: "Summarize findings, issues, and inputs before taking action.",
    description: "Translate raw notes into structured findings, risks, and dependencies that feed the action report.",
    systemPrompt: findingsSummaryPrompt,
  },
  report: {
    id: "report",
    label: "Phase 6 — Action report",
    summary: "Produce an activable report with concrete tasks.",
    description: "Document findings with prioritized action items, monitoring, and references for the final deliverable.",
    systemPrompt: actionReportPrompt,
  },
};

export const deepResearchPhaseOrder: DeepResearchPhaseKey[] = [
  "clarify",
  "brief",
  "plan",
  "research",
  "summary",
  "report",
];

export const deepResearchPhaseDefinitions = deepResearchPhaseOrder.map(
  (phaseId) => deepResearchPhaseConfig[phaseId]
);

const simpleReactPhaseDefinitions: PhaseDefinition[] = [
  {
    id: simpleReactPhaseId,
    label: simpleReactPhaseLabel,
    summary: simpleReactPhaseSummary,
    description: simpleReactPhaseDescription,
    systemPrompt: simpleReactSystemPrompt,
  },
];

export type GraphOption = {
  id: GraphId;
  name: string;
  description: string;
  phases: PhaseDefinition[];
  nodePrompts: GraphNodePrompt[];
  toolNames: string[];
};

const baseToolNames = [
  "list_files",
  "repo_metrics",
  "describe_structure",
  "search_code",
  "read_file",
  "read_file_range",
  "git_log",
  "git_diff",
  "git_blame",
  "git_grep",
  "todo_search",
  "write_file",
];

export const graphOptions: GraphOption[] = [
  {
    id: "audit",
    name: "4-phase audit",
    description: "Map, audit, plan, and report using repo MCP tools.",
    phases: auditPhaseDefinitions,
    nodePrompts: auditPhaseDefinitions.map((phase) => ({
      id: phase.id,
      label: phase.label,
      prompt: phase.systemPrompt,
    })),
    toolNames: baseToolNames,
  },
  {
    id: "deep_research",
    name: "Deep research",
    description: "Supervisor + researchers produce a cited deep report.",
    phases: deepResearchPhaseDefinitions,
    nodePrompts: [
      {
        id: "clarify_with_user",
        label: "Clarify with user",
        prompt: clarifyWithUserInstructions,
      },
      {
        id: "write_research_brief",
        label: "Write research brief",
        prompt: transformMessagesIntoResearchTopicPrompt,
      },
      {
        id: "plan_research",
        label: "Plan research",
        prompt: researchPlanningPrompt,
      },
      {
        id: "research_supervisor",
        label: "Supervisor",
        prompt: leadResearcherPrompt,
      },
      {
        id: "researcher",
        label: "Researcher",
        prompt: researchSystemPrompt,
      },
      {
        id: "compress_research",
        label: "Compress research",
        prompt: compressResearchSystemPrompt,
      },
      {
        id: "summarize_findings",
        label: "Summarize findings",
        prompt: findingsSummaryPrompt,
      },
      {
        id: "final_action_report",
        label: "Final action report",
        prompt: actionReportPrompt,
      },
    ],
    toolNames: baseToolNames,
  },
  {
    id: simpleReactGraphId,
    name: "Simple ReAct agent",
    description: "Answer repository questions with one ReAct agent call.",
    phases: simpleReactPhaseDefinitions,
    nodePrompts: simpleReactPhaseDefinitions.map((phase) => ({
      id: phase.id,
      label: phase.label,
      prompt: phase.systemPrompt,
    })),
    toolNames: simpleReactToolNames,
  },
];
