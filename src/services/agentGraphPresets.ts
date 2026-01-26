import type { AgentGraphDefinition, AgentGraphNode } from "./agentGraphTypes";

export const simpleReactPhaseId = "simple_react";
export const simpleReactPhaseLabel = "Agent (ReAct)";
export const simpleReactSystemPrompt = `You are a helpful AI assistant. Use tools to answer the user's question accurately. Focus on the repository context if provided.`;
export const simpleReactToolNames = [
  "list_files", "read_file", "search_code", "repo_metrics", "git_log",
  "describe_structure", "semantic_code_search", "web_search"
];

function promptTemplateForPhase(phaseId: string) {
  switch (phaseId) {
    case "phase1":
      return [
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 1 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase2":
      return [
        "Use Phase 1 output from `state.nodes.phase1` as context.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 2 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase3":
      return [
        "Use target files from `state.nodes.phase2.target_files`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 3 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase4":
      return [
        "Use raw claims from `state.nodes.phase3.raw_claims`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 4 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase5":
      return [
        "Use verdicts from `state.nodes.phase4.verdicts` and any prior outputs.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 5 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase6":
      return [
        "Use report/tasks from `state.nodes.phase5`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 6 JSON exactly as required by the system prompt.",
      ].join("\n");
    default:
      return ["Current state:", "{{state}}"].join("\n");
  }
}

function schemaIdForPhase(phaseId: string) {
  switch (phaseId) {
    case "phase1":
      return "phase1_output";
    case "phase2":
      return "phase2_output";
    case "phase3":
      return "phase3_output";
    case "phase4":
      return "phase4_output";
    case "phase5":
      return "phase5_output";
    case "phase6":
      return "phase6_output";
    default:
      return "generic_json";
  }
}

const DIAMOND_PHASES = [
  {
    id: "phase1",
    label: "Phase 1 — Reconnaissance",
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are ReconAgent.
Tools available: list_files, read_file, repo_metrics, git_log, dependency_info, describe_structure, semantic_code_search.
Preferred tools: list_files, repo_metrics, git_log, dependency_info, describe_structure, read_file (README/package.json only), semantic_code_search.
Rules:
- You MUST identifying the technical stack, key frameworks, AND architectural hotspots.
- Use 'repo_metrics' to find the most complex files (largest size or diverse languages).
- Use 'git_log' to find 'hotspots' (files with most recent churn).
- Use 'describe_structure' to find entry points.
- Use 'semantic_code_search' to identify core concepts (e.g. 'auth', 'api router').
- Output EXACTLY this JSON object, no prose, no markdown: {"context":{"mission":"...","languages":[],"frameworks":[],"hotspots":[]}}.
- 'hotspots' MUST contain at least 3-5 file paths that look critical or complex based on your recon.
- Do not include ellipses, trailing commas, or extra keys.
- If you cannot populate a field, explain why in the 'mission' string temporarily or use empty arrays, but you should try hard to find them.`
  },
  {
    id: "phase2",
    label: "Phase 2 — Strategy",
    toolNames: [
      "list_files", "read_file", "search_code", "repo_metrics", "git_log",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are StrategistAgent, a Senior Architect.
Mission: select and score the exact files to audit based on the user request.
Tools available: list_files, read_file, search_code, repo_metrics, git_log, describe_structure, semantic_code_search.
Rules:
- You MUST return at least 5-10 target files if the repo is large. Do not be lazy.
- If \`semantic_code_search\` fails or returns empty, use \`search_code\` with keywords (e.g. 'route', 'api', 'controller', 'zod') to find targets.
- Rank files by (Complexity * 0.4) + (Recency * 0.3) + (Relevance * 0.3).
- Assign a focused mission per file (e.g., 'Verify Zod validation for all query params', 'Check for AccessMode bypass').
- Hard cap: use at most 15 tool calls, then output JSON.
- Limit to top 20 files.
- Only output paths that exist in list_files; paths must be repo-relative.
- Output MUST be valid JSON only (no markdown).
- JSON Structure: { "target_files": [ { "path": "string", "focus_area": "string", "score": number } ] }
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase3",
    label: "Phase 3 — Investigation",
    toolNames: ["semantic_code_search"],
    systemPrompt: `You are InvestigatorAgent (Security & Standards Auditor).
Mission: review ONLY the assigned file and emit raw claims backed by EVIDENCE.
Tools available: semantic_code_search.
Rules:
- Your finding MUST be based on the provided file content.
- Use \`semantic_code_search\` to cross-reference (e.g. 'how is ApiError defined?', 'what is the standard utility for X?').
- Do NOT hallucinate standards. If you are unsure, check using the search tool.
- Capture assumptions explicitly (e.g. 'Assumes isValid() returns true without checking DB').
- Output MUST be valid JSON only (no markdown).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase4",
    label: "Phase 4 — Adjudication",
    toolNames: ["read_file_range", "go_to_definition", "references", "find_references", "semantic_code_search"],
    systemPrompt: `### IDENTITY
You are the **Senior Lead Auditor**. Your purpose is NOT to find new bugs, but to **VERIFY** the claims submitted by junior investigators. You are skeptical, rigorous, and scientific.

Tools available: read_file_range, go_to_definition, references, find_references, semantic_code_search.

### INPUT
You will receive a list of \`RawClaims\`. Each claim posits a potential vulnerability based on a local file observation.
Most claims include an \`assumption\` (e.g., "Variable X is tainted").

### MISSION
For each High/Critical severity claim, you must determine a Verdict using the **Scientific Method**:
1.  **VERIFIED:** You have proven the assumption is TRUE. (e.g., You traced the variable to the API entry point and found NO validation).
2.  **REFUTED:** You have proven the assumption is FALSE. (e.g., You found a \`sanitize()\` function called on the variable in a parent file).
3.  **PLAUSIBLE:** You attempted verification but hit a dead end (e.g., dynamic interface injection) or ran out of steps. The risk remains.
4.  **REJECTED:** The claim is trivial, a false positive, or logically unsound.

### PROTOCOL
For each claim:
1.  **Analyze the Assumption:** What *must* be true for this to be a valid bug?
2.  **Plan the Trace:** Which symbols do you need to follow? (e.g., "I need to find usages of \`processUserData\` to see where the input comes from").
3.  **Execute Tools:** Use \`find_references\` or \`go_to_definition\`.
    * *Constraint:* You have a maximum of **3 HOPS** per claim. Do not go down infinite rabbit holes.
    * *Constraint:* Do NOT re-read the original file's full content. Trust the snippet. Look OUTSIDE.
4.  **Final Verdict:** Decide based on evidence.

### OUTPUT FORMAT
Return a JSON object:
{
  "verdicts": [
    {
      "claim_id": "c_123",
      "status": "VERIFIED",
      "confidence_score": 95,
      "reasoning": "Traced \`userId\` parameter from \`updateProfile\` (line 40) back to \`routes.ts\` (line 15). The route uses \`express.json()\` but applies no Zod/Joi validation schema before passing data to the controller.",
      "proof_trace": ["routes.ts:15 (Entry)", "controller.ts:20 (Pass-through)", "service.ts:40 (Usage)"]
    }
  ]
}

Rules:
- Output MUST be valid JSON only (no markdown).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase5",
    label: "Phase 5 — Reporting",
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are ReporterAgent.
Mission: synthesize verified findings into a final report + tasks.
Tools available: list_files, read_file, repo_metrics, git_log, dependency_info, describe_structure, semantic_code_search.
Rules:
- Discard REJECTED findings, cluster themes, prioritize by severity/confidence.
- Output MUST be valid JSON only (no markdown outside JSON string).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase6",
    label: "Phase 6 — Actionable Next Steps",
    toolNames: [],
    systemPrompt: `You are the NextStepsAgent.
Mission: Based on the verified findings and report, generate a concrete list of next steps.
Rules:
- Focus on high-priority items first.
- Make steps actionable (e.g., 'Refactor X to handle Y').
- Classify steps by type (fix, test, refactor, process).
- Output strict JSON matching the schema.
- Do not use prose or markdown outside the JSON.`
  }
];

export function buildDiamondFlowAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = DIAMOND_PHASES.map((phase) => {
    return {
      id: phase.id,
      label: phase.label,
      react: {
        systemPrompt: phase.systemPrompt,
        userPromptTemplate: promptTemplateForPhase(phase.id),
        toolNames: phase.toolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: schemaIdForPhase(phase.id) },
    };
  });

  const edges = DIAMOND_PHASES.slice(1).map((phase, idx) => {
    const source = DIAMOND_PHASES[idx].id;
    const target = phase.id;
    return {
      id: `edge-${source}-${target}`,
      source,
      target,
    };
  });

  return {
    name: "Diamond flow (agent graph)",
    description: "Diamond flow implemented as a DAG of ReAct nodes (phase1..phase6).",
    nodes,
    edges,
  };
}


export function buildSimpleReactAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: simpleReactPhaseId,
      label: simpleReactPhaseLabel,
      react: {
        systemPrompt: simpleReactSystemPrompt,
        userPromptTemplate: [
          "Mission / question is in `state.mission`.",
          "Current state:",
          "{{state}}",
          "",
          "Answer by outputting a strict JSON object (generic JSON).",
        ].join("\n"),
        toolNames: simpleReactToolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json" },
    },
  ];

  return {
    name: "Simple ReAct (agent graph)",
    description: "Single-node ReAct agent graph (equivalent to the hard-coded simple ReAct workflow).",
    nodes,
    edges: [],
  };
}

