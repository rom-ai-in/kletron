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

// ─────────────────────────────────────────────────────────────────────────────
// CURSOR-LIKE ROBUST LOOP GRAPH (STATE MACHINE)
// Detailed example of router nodes + conditional edges + loopbacks
// ─────────────────────────────────────────────────────────────────────────────

const CURSOR_CORE_TOOLS = [
  "list_files",
  "read_file",
  "read_file_range",
  "search_code",
  "repo_metrics",
  "dependency_info",
  "describe_structure",
  "git_log",
  "git_diff",
  "git_grep",
  "git_blame",
  "semantic_code_search",
  "structural_search",
  "symbols_list",
  "find_symbol",
  "go_to_definition",
  "references",
  "find_references",
  "execute_bash",
  "output_format"
];

const CURSOR_RESEARCH_TOOLS = [
  ...CURSOR_CORE_TOOLS,
  "web_search",
  "fetch_url"
];

const CURSOR_CODER_TOOLS = [
  ...CURSOR_CORE_TOOLS,
  "write_file",
  "str_replace_editor"
];

export function buildCursorLikeRobustGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "intake",
      label: "Intake",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Intake agent.",
          "Goal: normalize the user request and extract constraints.",
          "Inputs: state.mission (user message), state (full).",
          "Outputs: strict JSON only. Do not include markdown or prose.",
          "",
          "Write ONLY these keys (no extra keys):",
          "{",
          "  \"goal\": string,",
          "  \"constraints\": string[],",
          "  \"openQuestions\": string[],",
          "  \"nonGoals\": string[],",
          "  \"userInput\": string",
          "}",
          "",
          "Guidance:",
          "- Avoid asking the user unless absolutely necessary; put unknowns into openQuestions.",
          "- Keep constraints concrete (language, framework, perf, security, time).",
          "- Use userInput = original mission."
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}\n\nCurrent state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "spec_acceptance",
      label: "Spec & Acceptance",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Spec & Acceptance agent.",
          "Goal: translate goal into acceptance criteria and definition of done.",
          "Inputs: state.goal, state.constraints, state.openQuestions.",
          "Outputs: strict JSON only (no markdown).",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"acceptanceCriteria\": string[],",
          "  \"definitionOfDone\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "repo_scan",
      label: "Repo Scan",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Repo Scan agent.",
          "Goal: discover repo structure, stack, and build/test commands.",
          "Use tools to inspect config files and structure.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"repoSummary\": string,",
          "  \"envInfo\": object,",
          "  \"buildCommands\": string[],",
          "  \"constraintsDetected\": string[]",
          "}",
          "",
          "If you infer commands, label them clearly in envInfo."
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: CURSOR_CORE_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "planner",
      label: "Planner",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Planner (orchestrator).",
          "Goal: produce milestones, task queue, and risk register.",
          "Do NOT edit files; only plan.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"plan\": object,",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string,",
          "  \"riskRegister\": array",
          "}",
          "",
          "Ensure taskQueue is ordered and currentTaskId is the first task id."
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "route_prep",
      label: "Task Router Prep",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Task Router Prep agent.",
          "Goal: choose the next role based on state.",
          "Do NOT use tools. Decide a single next step.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"route\": {",
          "    \"next\": \"researcher\" | \"coder\" | \"reviewer\" | \"debugger\" | \"final_gate\",",
          "    \"reason\": string",
          "  }",
          "}",
          "",
          "Routing rules (apply in this order):",
          "1) If openQuestions has items -> researcher",
          "2) If taskQueue has items -> coder",
          "3) If qualityGates show failures -> debugger",
          "4) If acceptanceCriteria satisfied and review pending -> reviewer",
          "5) Otherwise -> final_gate"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "task_router",
      label: "Task Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json" }
    },
    {
      id: "researcher",
      label: "Researcher",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Researcher.",
          "Goal: resolve openQuestions using repository info or web tools.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"workingNotes\": string[],",
          "  \"openQuestions\": string[]",
          "}",
          "",
          "Append to existing workingNotes; remove resolved openQuestions."
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: CURSOR_RESEARCH_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "coder",
      label: "Coder",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Coder.",
          "Goal: implement ONE task from state.currentTaskId with minimal diff.",
          "Rules:",
          "- Use tools; prefer apply_patch or minimal edits.",
          "- Update or add tests if needed.",
          "- Record edits in fileChanges and notes in workingNotes.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"fileChanges\": array,",
          "  \"workingNotes\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: CURSOR_CODER_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "policy_gate",
      label: "Policy / Safety Gate",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Policy Gate.",
          "Goal: review last changes for safety/risk and decide next step.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"reviewFeedback\": array,",
          "  \"route\": {",
          "    \"next\": \"coder\" | \"verify_fast\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: ["git_diff", "search_code"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "policy_router",
      label: "Policy Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json" }
    },
    {
      id: "verify_fast",
      label: "Verify (Fast)",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Fast Verifier.",
          "Goal: run quick checks (lint/typecheck/unit) and summarize.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"testResults\": object,",
          "  \"qualityGates\": object,",
          "  \"route\": {",
          "    \"next\": \"verify_full\" | \"debugger\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: ["execute_bash", "read_file"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "verify_full",
      label: "Verify (Full)",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Full Verifier.",
          "Goal: run full test suite/integration and update gates.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"testResults\": object,",
          "  \"qualityGates\": object,",
          "  \"route\": {",
          "    \"next\": \"reviewer\" | \"debugger\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: ["execute_bash", "read_file"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "verify_router",
      label: "Verify Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json" }
    },
    {
      id: "debugger",
      label: "Debugger",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Debugger.",
          "Goal: analyze failures and propose minimal fix steps.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"reviewFeedback\": array,",
          "  \"taskQueue\": array,",
          "  \"workingNotes\": string[],",
          "  \"route\": {",
          "    \"next\": \"coder\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: ["read_file", "search_code", "git_diff", "execute_bash"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "reviewer",
      label: "Reviewer",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Reviewer.",
          "Goal: check spec, edge cases, security, and correctness.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"reviewFeedback\": array,",
          "  \"confidence\": string | number,",
          "  \"suggestedTests\": string[],",
          "  \"route\": {",
          "    \"next\": \"coder\" | \"refactor\" | \"final_gate\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: ["read_file", "git_diff", "search_code"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "review_router",
      label: "Review Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json" }
    },
    {
      id: "refactor",
      label: "Refactor / Docs",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Refactor/Docs agent.",
          "Goal: improve clarity, docs, and remove dead code with minimal risk.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"fileChanges\": array,",
          "  \"workingNotes\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: CURSOR_CODER_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "final_gate",
      label: "Final Gate",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Final Gate.",
          "Goal: enforce definitionOfDone and decide if the run is complete.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[],",
          "  \"route\": {",
          "    \"next\": \"done\" | \"planner\" | \"coder\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    },
    {
      id: "final_router",
      label: "Final Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json" }
    },
    {
      id: "done",
      label: "Done",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Done node.",
          "Goal: finalize output. No tools.",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Current state:\n{{state}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true }
    }
  ];

  const edges = [
    { id: "edge-intake-spec", source: "intake", target: "spec_acceptance" },
    { id: "edge-spec-scan", source: "spec_acceptance", target: "repo_scan" },
    { id: "edge-scan-plan", source: "repo_scan", target: "planner" },
    { id: "edge-plan-routeprep", source: "planner", target: "route_prep" },
    { id: "edge-routeprep-router", source: "route_prep", target: "task_router" },

    { id: "edge-router-researcher", source: "task_router", target: "researcher", condition: "state.route.next == \"researcher\"" },
    { id: "edge-router-coder", source: "task_router", target: "coder", condition: "state.route.next == \"coder\"" },
    { id: "edge-router-reviewer", source: "task_router", target: "reviewer", condition: "state.route.next == \"reviewer\"" },
    { id: "edge-router-debugger", source: "task_router", target: "debugger", condition: "state.route.next == \"debugger\"" },
    { id: "edge-router-final", source: "task_router", target: "final_gate", condition: "state.route.next == \"final_gate\"" },

    { id: "edge-researcher-routeprep", source: "researcher", target: "route_prep" },

    { id: "edge-coder-policy", source: "coder", target: "policy_gate" },
    { id: "edge-policy-router", source: "policy_gate", target: "policy_router" },
    { id: "edge-policy-coder", source: "policy_router", target: "coder", condition: "state.route.next == \"coder\"" },
    { id: "edge-policy-verify", source: "policy_router", target: "verify_fast", condition: "state.route.next == \"verify_fast\"" },

    { id: "edge-verifyfast-router", source: "verify_fast", target: "verify_router" },
    { id: "edge-verifyfull-router", source: "verify_full", target: "verify_router" },
    { id: "edge-router-verifyfull", source: "verify_router", target: "verify_full", condition: "state.route.next == \"verify_full\"" },
    { id: "edge-router-debugger2", source: "verify_router", target: "debugger", condition: "state.route.next == \"debugger\"" },
    { id: "edge-router-reviewer2", source: "verify_router", target: "reviewer", condition: "state.route.next == \"reviewer\"" },

    { id: "edge-debugger-coder", source: "debugger", target: "coder" },

    { id: "edge-reviewer-router", source: "reviewer", target: "review_router" },
    { id: "edge-review-coder", source: "review_router", target: "coder", condition: "state.route.next == \"coder\"" },
    { id: "edge-review-refactor", source: "review_router", target: "refactor", condition: "state.route.next == \"refactor\"" },
    { id: "edge-review-final", source: "review_router", target: "final_gate", condition: "state.route.next == \"final_gate\"" },

    { id: "edge-refactor-final", source: "refactor", target: "final_gate" },
    { id: "edge-final-router", source: "final_gate", target: "final_router" },
    { id: "edge-final-done", source: "final_router", target: "done", condition: "state.route.next == \"done\"" },
    { id: "edge-final-planner", source: "final_router", target: "planner", condition: "state.route.next == \"planner\"" },
    { id: "edge-final-coder", source: "final_router", target: "coder", condition: "state.route.next == \"coder\"" }
  ];

  return {
    name: "Cursor-like Robust Loop (agent graph)",
    description:
      "State-machine graph with router nodes, conditional edges, and loopbacks implementing intake->plan->implement->verify->review->finalize.",
    nodes,
    edges,
    execution: {
      mode: "state_machine",
      entryNodeId: "intake",
      maxIterations: 200,
      maxNodeRuns: 20
    },
    stateDefaults: {
      goal: "",
      constraints: [],
      acceptanceCriteria: [],
      definitionOfDone: [],
      plan: {},
      currentTaskId: "",
      taskQueue: [],
      riskRegister: [],
      repoSummary: "",
      envInfo: {},
      buildCommands: [],
      constraintsDetected: [],
      workingNotes: [],
      designDecisions: [],
      openQuestions: [],
      toolCalls: [],
      terminalRuns: [],
      fileChanges: [],
      testResults: {},
      qualityGates: {},
      reviewFeedback: [],
      suggestedTests: [],
      confidence: "",
      finalSummary: "",
      nextSteps: [],
      route: { next: "researcher", reason: "bootstrap" }
    }
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION GENERATOR PRO GRAPH
// 6-phase pipeline: research → offer_analysis → structure → enrich → create → verify
// ─────────────────────────────────────────────────────────────────────────────
