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
    skillIds: ["recon-agent"],
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: "" // Prompt loaded from skill
  },
  {
    id: "phase2",
    label: "Phase 2 — Strategy",
    skillIds: ["strategist-agent"],
    toolNames: [
      "list_files", "read_file", "search_code", "repo_metrics", "git_log",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: "" // Prompt loaded from skill
  },
  {
    id: "phase3",
    label: "Phase 3 — Investigation",
    skillIds: ["investigator-agent"],
    toolNames: ["semantic_code_search"],
    systemPrompt: "" // Prompt loaded from skill
  },
  {
    id: "phase4",
    label: "Phase 4 — Adjudication",
    skillIds: ["adjudicator-agent"],
    toolNames: ["read_file_range", "go_to_definition", "references", "find_references", "semantic_code_search"],
    systemPrompt: "" // Prompt loaded from skill
  },
  {
    id: "phase5",
    label: "Phase 5 — Reporting",
    skillIds: ["reporter-agent"],
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: "" // Prompt loaded from skill
  },
  {
    id: "phase6",
    label: "Phase 6 — Actionable Next Steps",
    skillIds: ["next-steps-agent"],
    toolNames: [],
    systemPrompt: "" // Prompt loaded from skill
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
        skillIds: phase.skillIds,
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
          "0) If blockedReason is set OR consecutiveErrors >= 3 -> final_gate (report the blocker to user)",
          "1) If openQuestions has items AND blockedReason is NOT set -> researcher",
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
          "",
          "CRITICAL ERROR HANDLING:",
          "If you encounter a CONFIGURATION ERROR (e.g., 'Working folder not configured'),",
          "or any UNRECOVERABLE ERROR that prevents tool usage, you MUST:",
          "1) Set blockedReason to describe the error (e.g., 'Working folder not configured')",
          "2) Clear openQuestions (set to empty array [])",
          "3) Increment consecutiveErrors",
          "4) Do NOT keep retrying the same failing tools",
          "",
          "Outputs: strict JSON only.",
          "",
          "Write ONLY these keys:",
          "{",
          "  \"workingNotes\": string[],",
          "  \"openQuestions\": string[],",
          "  \"blockedReason\": string | null,",
          "  \"consecutiveErrors\": number",
          "}",
          "",
          "Append to existing workingNotes; remove resolved openQuestions.",
          "If tools work successfully, set blockedReason to null and consecutiveErrors to 0."
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
      route: { next: "researcher", reason: "bootstrap" },
      blockedReason: null,
      consecutiveErrors: 0
    }
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION GENERATOR PRO GRAPH
// 6-phase pipeline: research → offer_analysis → structure → enrich → create → verify
// ─────────────────────────────────────────────────────────────────────────────
