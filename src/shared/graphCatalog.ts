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
  toolNames: string[];
};

export type AuditPhaseKey = "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
export type DeepResearchPhaseKey =
  | "clarify"
  | "brief"
  | "plan"
  | "research"
  | "summary"
  | "report";
export type GraphId = "audit" | typeof simpleReactGraphId;

export type GraphNodePrompt = {
  id: string;
  label: string;
  prompt: string;
};

const baseToolNames = [
  "list_files",
  "read_file",
  "read_file_range",
  "search_code",
  "repo_metrics",
  "todo_search",
  "dependency_info",
  "describe_structure",
  "git_log",
  "git_diff",
  "git_grep",
  "git_blame",
  "structural_search",
  "symbols_list",
  "find_symbol",
  "go_to_definition",
  "references",
  "find_references",
  "web_search",
  "fetch_url",
  "github_api",
  "bootstrap_context",
  "locate_ui_feature",
  "write_file",
  "str_replace_editor",
  "execute_bash",
  "output_format",
  "semantic_code_search",
];

const auditToolList = `Tools available: ${baseToolNames.join(", ")}.`;
const auditToolListNone = "Tools available: none.";
const auditAdjudicationToolNames = ["read_file_range", "go_to_definition", "references", "find_references", "semantic_code_search"];
const auditToolListAdjudication = `Tools available: ${auditAdjudicationToolNames.join(", ")}.`;

export const auditPhaseConfig: Record<AuditPhaseKey, PhaseDefinition> = {
  phase1: {
    id: "phase1",
    label: "Phase 1 — Reconnaissance",
    summary: "Map the terrain: stack, structure, hotspots.",
    description:
      "Use lightweight tooling to understand the repo shape without deep reading.",
    systemPrompt: [
      "You are ReconAgent.",
      auditToolList,
      "Preferred tools: list_files, repo_metrics, git_log, dependency_info, describe_structure, read_file (README/package.json only), semantic_code_search.",
      "Rules:",
      "- Use semantic_code_search early to find conceptual entry points (e.g., 'auth', 'database', 'routing').",
      "- Bootstrap from README + dependency manifests to identify languages/frameworks.",
      "- Use list_files with maxDepth=2 to avoid huge listings; escalate depth only when explicitly requested.",
      "- Use repo_metrics/git_log for hotspots and churn but do not read more than two files beyond README/package.json.",
      "- Output EXACTLY this JSON object, no prose, no markdown: {\"context\":{\"mission\":\"...\",\"languages\":[],\"frameworks\":[],\"hotspots\":[]}}.",
      "- Do not include ellipses, trailing commas, or extra keys outside the required structure.",
      "- If you cannot populate a field, use empty strings/arrays but keep the JSON strict.",
    ].join("\n"),
    toolNames: baseToolNames,
  },
  phase2: {
    id: "phase2",
    label: "Phase 2 — Strategy",
    summary: "Select the highest-value files to investigate.",
    description:
      "Blend hotspots, churn, and objective relevance into a target list.",
    systemPrompt: [
      "You are StrategistAgent.",
      "Mission: select and score the exact files to audit.",
      auditToolList,
      "Preferred tools: search_code, repo_metrics, git_log, describe_structure, semantic_code_search.",
      "Rules:",
      "- Use semantic_code_search to find files related to high-level logic or patterns.",
      "- Rank files by (Complexity * 0.4) + (Recency * 0.3) + (Relevance * 0.3).",
      "- Assign a focused mission per file (e.g., JWT validation, SQLi, authz).",
      "- Hard cap: use at most 8 tool calls, then output JSON.",
      "- Limit to top 20 files.",
      "- Only output paths that exist in list_files; paths must be repo-relative.",
      "- Output MUST be valid JSON only (no markdown).",
      "- Do not use ellipses (...) or trailing commas; output strict JSON.",
    ].join("\n"),
    toolNames: baseToolNames,
  },
  phase3: {
    id: "phase3",
    label: "Phase 3 — Investigation",
    summary: "Parallel deep dive into assigned files.",
    description:
      "Sub-agents read only their target file and emit raw claims.",
    systemPrompt: [
      "You are InvestigatorAgent.",
      "Mission: review ONLY the assigned file and emit raw claims.",
      "Tools available: semantic_code_search.",
      "Rules:",
      "- You may use semantic_code_search to find related conceptual patterns, but your primary focus is the assigned file content.",
      "- Capture assumptions explicitly when a claim depends on other files.",
      "- Output MUST be valid JSON only (no markdown).",
      "- Do not use ellipses (...) or trailing commas; output strict JSON.",
    ].join("\n"),
    toolNames: ["semantic_code_search"],
  },
  phase4: {
    id: "phase4",
    label: "Phase 4 — Adjudication",
    summary: "Verify high-impact claims across the codebase.",
    description: "Senior verifier traces assumptions with strict hop limits.",
    systemPrompt: [
      "### IDENTITY",
      "You are the **Senior Lead Auditor**. Your purpose is NOT to find new bugs, but to **VERIFY** the claims submitted by junior investigators. You are skeptical, rigorous, and scientific.",
      "",
      auditToolListAdjudication,
      "",
      "### INPUT",
      "You will receive a list of `RawClaims`. Each claim posits a potential vulnerability based on a local file observation.",
      "Most claims include an `assumption` (e.g., \"Variable X is tainted\").",
      "",
      "### MISSION",
      "For each High/Critical severity claim, you must determine a Verdict using the **Scientific Method**:",
      "1.  **VERIFIED:** You have proven the assumption is TRUE. (e.g., You traced the variable to the API entry point and found NO validation).",
      "2.  **REFUTED:** You have proven the assumption is FALSE. (e.g., You found a `sanitize()` function called on the variable in a parent file).",
      "3.  **PLAUSIBLE:** You attempted verification but hit a dead end (e.g., dynamic interface injection) or ran out of steps. The risk remains.",
      "4.  **REJECTED:** The claim is trivial, a false positive, or logically unsound.",
      "",
      "### PROTOCOL",
      "For each claim:",
      "1.  **Analyze the Assumption:** What *must* be true for this to be a valid bug?",
      "2.  **Plan the Trace:** Which symbols do you need to follow? (e.g., \"I need to find usages of `processUserData` to see where the input comes from\").",
      "3.  **Execute Tools:** Use `find_references` or `go_to_definition`.",
      "    * *Constraint:* You have a maximum of **3 HOPS** per claim. Do not go down infinite rabbit holes.",
      "    * *Constraint:* Do NOT re-read the original file's full content. Trust the snippet. Look OUTSIDE.",
      "4.  **Final Verdict:** Decide based on evidence.",
      "",
      "### OUTPUT FORMAT",
      "Return a JSON object:",
      "{",
      "  \"verdicts\": [",
      "    {",
      "      \"claim_id\": \"c_123\",",
      "      \"status\": \"VERIFIED\",",
      "      \"confidence_score\": 95,",
      "      \"reasoning\": \"Traced `userId` parameter from `updateProfile` (line 40) back to `routes.ts` (line 15). The route uses `express.json()` but applies no Zod/Joi validation schema before passing data to the controller.\",",
      "      \"proof_trace\": [\"routes.ts:15 (Entry)\", \"controller.ts:20 (Pass-through)\", \"service.ts:40 (Usage)\"]",
      "    }",
      "  ]",
      "}",
      "",
      "Rules:",
      "- Output MUST be valid JSON only (no markdown).",
      "- Do not use ellipses (...) or trailing commas; output strict JSON.",
    ].join("\n"),
    toolNames: auditAdjudicationToolNames,
  },
  phase5: {
    id: "phase5",
    label: "Phase 5 — Reporting",
    summary: "Synthesize verified findings into an actionable report.",
    description: "Cluster verified findings and generate remediation tasks.",
    systemPrompt: [
      "You are ReporterAgent.",
      "Mission: synthesize verified findings into a final report + tasks.",
      auditToolList,
      "Rules:",
      "- Discard REJECTED findings, cluster themes, prioritize by severity/confidence.",
      "- Output MUST be valid JSON only (no markdown outside JSON string).",
      "- Do not use ellipses (...) or trailing commas; output strict JSON.",
    ].join("\n"),
    toolNames: baseToolNames,
  },
};

export const auditPhaseOrder: AuditPhaseKey[] = [
  "phase1",
  "phase2",
  "phase3",
  "phase4",
  "phase5",
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
    toolNames: ["semantic_code_search"],
  },
  brief: {
    id: "brief",
    label: "Phase 2 — Research brief",
    summary: "Create a structured research brief from the request.",
    description: "Translate the request into a precise research question for the repo.",
    systemPrompt: transformMessagesIntoResearchTopicPrompt,
    toolNames: ["semantic_code_search"],
  },
  plan: {
    id: "plan",
    label: "Phase 3 — Research plan",
    summary: "Blueprint the MCP tooling approach, targeted files, and architecture study.",
    description:
      "Convert the research brief into a detailed plan that lists target files, architecture hotspots, and the MCP tools that will be used to inspect them.",
    systemPrompt: researchPlanningPrompt,
    toolNames: ["semantic_code_search"],
  },
  research: {
    id: "research",
    label: "Phase 4 — Deep research",
    summary: "Supervisor delegates research and gathers evidence.",
    description: "Use MCP tools to collect findings and citations.",
    systemPrompt: leadResearcherPrompt,
    toolNames: baseToolNames,
  },
  summary: {
    id: "summary",
    label: "Phase 5 — Findings summary",
    summary: "Summarize findings, issues, and inputs before taking action.",
    description: "Translate raw notes into structured findings, risks, and dependencies that feed the action report.",
    systemPrompt: findingsSummaryPrompt,
    toolNames: ["semantic_code_search"],
  },
  report: {
    id: "report",
    label: "Phase 6 — Action report",
    summary: "Produce an activable report with concrete tasks.",
    description: "Document findings with prioritized action items, monitoring, and references for the final deliverable.",
    systemPrompt: actionReportPrompt,
    toolNames: ["semantic_code_search"],
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
    toolNames: simpleReactToolNames,
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

export const graphOptions: GraphOption[] = [
  {
    id: "audit",
    name: "Diamond flow",
    description: "Recon, strategy, investigation, adjudication, reporting.",
    phases: auditPhaseDefinitions,
    nodePrompts: auditPhaseDefinitions.map((phase) => ({
      id: phase.id,
      label: phase.label,
      prompt: phase.systemPrompt,
    })),
    toolNames: baseToolNames,
  },
  {
    id: simpleReactGraphId,
    name: "Agent (ReAct)",
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
