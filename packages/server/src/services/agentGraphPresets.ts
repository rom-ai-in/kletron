import type { AgentGraphDefinition, AgentGraphNode } from "./agentGraphTypes";

export const simpleReactPhaseId = "simple_react";
export const simpleReactPhaseLabel = "Agent (ReAct)";
const TOOL_PREFERENCE_GUIDANCE = [
  "Tooling guidance:",
  "- Prefer list_files/read_file/search_code/git_grep/semantic_code_search before execute_bash.",
  "- Use execute_bash only when a shell pipeline is truly required.",
  "- Avoid repeating commands; reuse prior outputs.",
].join(" ");
export const simpleReactSystemPrompt = [
  "You are a helpful AI assistant.",
  "Use tools to answer the user's question accurately. Focus on the repository context if provided.",
  "If the request is multi-step, create and maintain a task queue using write_todos.",
  "Update task status as you progress.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");
export const simpleReactToolNames = [
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
  "output_format",
  "write_file",
  "str_replace_editor",
  "web_search",
  "fetch_url",
  "write_todos"
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
    category: "graph",
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
        userPromptTemplate: "{{mission}}",
        toolNames: simpleReactToolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "conversational" },
    },
  ];

  return {
    name: "Simple ReAct (agent graph)",
    description: "Single-node ReAct agent graph — conversational AI with tool access.",
    category: "graph",
    nodes,
    edges: [],
  };
}

export function buildPresentationGeneratorProGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const base = buildSimpleReactAgentGraph();
  const nodes = base.nodes.map((node) => ({
    ...node,
    label: "Presentation Generator Pro",
    react: node.react
      ? {
          ...node.react,
          systemPrompt: [
            "You are a presentation generation expert.",
            "Goal: produce clear, structured slide content from the user's request.",
            "When helpful, propose an outline first, then the slide-by-slide content.",
            "Keep content concise and visually scannable.",
          ].join("\n"),
        }
      : node.react,
  }));

  return {
    ...base,
    name: "Presentation Generator Pro",
    description: "Single-node presentation generator tailored for slide-ready outputs.",
    category: "graph",
    nodes,
  };
}

export function buildCompleteDeepAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "complete_intake",
      label: "Intake",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Intake agent.",
          "Normalize the mission into a clear goal and constraints.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"goal\": string,",
          "  \"constraints\": string[],",
          "  \"openQuestions\": string[],",
          "  \"userInput\": string",
          "}"
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_intake_output", statePath: "state", stateMerge: true }
    },
    {
      id: "complete_planner",
      label: "Planner",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Planner.",
          "Create an actionable plan and task queue.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"plan\": object,",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string,",
          "  \"riskRegister\": array",
          "}",
          "",
          "Requirement: taskQueue must contain at least 3 tasks with { id, title, status }.",
          "Set currentTaskId to the first task whose status is \"todo\"."
        ].join("\n"),
        userPromptTemplate: [
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}",
          "Open questions: {{state.openQuestions}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_planner_output", statePath: "state", stateMerge: true }
    },
    {
      id: "complete_delegate_research",
      label: "Delegate Research",
      kind: "delegate",
      react: {
        systemPrompt: [
          "You are a deep research subagent.",
          "Use tools to gather evidence and extract key findings.",
          TOOL_PREFERENCE_GUIDANCE,
          "Return JSON with summary, findings, and risks."
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}",
          "Open questions: {{state.openQuestions}}"
        ].join("\n"),
        toolNames: CURSOR_RESEARCH_TOOLS,
        llmSelection: { provider: "azure" }
      },
      delegate: {
        mode: "react",
        summaryPrompt: [
          "Summarize the delegate result.",
          "Return strict JSON with keys:",
          "{",
          "  \"summary\": string,",
          "  \"keyFindings\": string[],",
          "  \"risks\": string[]",
          "}"
        ].join("\n")
      },
      output: { schemaId: "generic_json", statePath: "state.research", stateMerge: true }
    },
    {
      id: "complete_execute",
      label: "Executor",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Executor.",
          "Implement the plan and update task status using write_todos when needed.",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string,",
          "  \"workingNotes\": string[],",
          "  \"blockedReason\": string | null",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Plan: {{state.plan}}",
          "Task queue: {{state.taskQueue}}",
          "Current task: {{state.currentTaskId}}",
          "Research: {{state.research}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: CURSOR_CODER_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_coder_output", statePath: "state", stateMerge: true }
    },
    {
      id: "complete_verify",
      label: "Verifier",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Verifier.",
          "Validate outputs against acceptance criteria and quality gates.",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"reviewFeedback\": array,",
          "  \"confidence\": string | number,",
          "  \"suggestedTests\": string[],",
          "  \"route\": { \"next\": string, \"reason\": string }",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Acceptance criteria: {{state.acceptanceCriteria}}",
          "Definition of done: {{state.definitionOfDone}}",
          "Working notes: {{state.workingNotes}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: CURSOR_CORE_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_reviewer_output", statePath: "state", stateMerge: true }
    },
    {
      id: "complete_finalize",
      label: "Finalize",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Finalizer.",
          "Produce the final summary and next steps.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[],",
          "  \"confidence\": string",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Review feedback: {{state.reviewFeedback}}",
          "Quality gates: {{state.qualityGates}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_done_output", statePath: "state", stateMerge: true }
    }
  ];

  const edges = [
    { id: "edge-complete-intake-planner", source: "complete_intake", target: "complete_planner" },
    { id: "edge-complete-planner-delegate", source: "complete_planner", target: "complete_delegate_research" },
    { id: "edge-complete-delegate-execute", source: "complete_delegate_research", target: "complete_execute" },
    { id: "edge-complete-execute-verify", source: "complete_execute", target: "complete_verify" },
    { id: "edge-complete-verify-finalize", source: "complete_verify", target: "complete_finalize" },
  ];

  return {
    name: "Complete Deep Agent (agent graph)",
    description: "End-to-end deep agent workflow with delegate research and task tracking.",
    category: "deep_agent",
    nodes,
    edges,
    execution: { mode: "dag" }
  };
}

export function buildDriftAnalysisGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "drift_intake",
      label: "Drift Intake",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Drift Intake agent.",
          "Clarify scope and signals for drift analysis.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"goal\": string,",
          "  \"constraints\": string[],",
          "  \"openQuestions\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_intake_output", statePath: "state", stateMerge: true }
    },
    {
      id: "drift_scan",
      label: "Drift Scan",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Drift Scanner.",
          "Inspect configuration, deployment, and runtime signals.",
          "Return findings and evidence paths.",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"workingNotes\": string[],",
          "  \"riskRegister\": array",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}"
        ].join("\n"),
        toolNames: CURSOR_RESEARCH_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_researcher_output", statePath: "state", stateMerge: true }
    },
    {
      id: "drift_delegate",
      label: "Delegate Drift Review",
      kind: "delegate",
      react: {
        systemPrompt: [
          "You are a drift analysis subagent.",
          "Review configs and code for environment mismatches and missing safeguards.",
          TOOL_PREFERENCE_GUIDANCE
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Working notes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: CURSOR_CORE_TOOLS,
        llmSelection: { provider: "azure" }
      },
      delegate: {
        mode: "react",
        summaryPrompt: [
          "Summarize drift risks and recommendations.",
          "Return strict JSON with keys:",
          "{",
          "  \"summary\": string,",
          "  \"driftFindings\": string[],",
          "  \"recommendations\": string[]",
          "}"
        ].join("\n")
      },
      output: { schemaId: "generic_json", statePath: "state.drift", stateMerge: true }
    },
    {
      id: "drift_report",
      label: "Drift Report",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Drift Reporter.",
          "Produce a concise report and next actions.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Drift findings: {{state.drift}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_done_output", statePath: "state", stateMerge: true }
    }
  ];

  const edges = [
    { id: "edge-drift-intake-scan", source: "drift_intake", target: "drift_scan" },
    { id: "edge-drift-scan-delegate", source: "drift_scan", target: "drift_delegate" },
    { id: "edge-drift-delegate-report", source: "drift_delegate", target: "drift_report" },
  ];

  return {
    name: "Drift Analysis (agent graph)",
    description: "Dedicated graph for drift analysis with delegate review.",
    category: "drift",
    nodes,
    edges,
    execution: { mode: "dag" }
  };
}

export function buildAutomationsGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "automation_brief",
      label: "Automation Brief",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Automation Brief agent.",
          "Capture objective, audience, and success metrics.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"goal\": string,",
          "  \"constraints\": string[],",
          "  \"acceptanceCriteria\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_spec_output", statePath: "state", stateMerge: true }
    },
    {
      id: "automation_plan",
      label: "Automation Plan",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Automation Planner.",
          "Create stages, deliverables, and a task queue.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"plan\": object,",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}",
          "Acceptance criteria: {{state.acceptanceCriteria}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_planner_output", statePath: "state", stateMerge: true }
    },
    {
      id: "automation_execute",
      label: "Automation Execution",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Automation Executor.",
          "Use tools to gather assets, update tasks, and produce deliverables.",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string,",
          "  \"workingNotes\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Plan: {{state.plan}}",
          "Task queue: {{state.taskQueue}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: CURSOR_CORE_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_coder_output", statePath: "state", stateMerge: true }
    },
    {
      id: "automation_report",
      label: "Automation Report",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Automation Reporter.",
          "Summarize deliverables, results, and next steps.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Working notes: {{state.workingNotes}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_done_output", statePath: "state", stateMerge: true }
    }
  ];

  const edges = [
    { id: "edge-automation-brief-plan", source: "automation_brief", target: "automation_plan" },
    { id: "edge-automation-plan-execute", source: "automation_plan", target: "automation_execute" },
    { id: "edge-automation-execute-report", source: "automation_execute", target: "automation_report" },
  ];

  return {
    name: "Automations (agent graph)",
    description: "Automation planning and execution graph with task tracking.",
    category: "automation",
    nodes,
    edges,
    execution: { mode: "dag" }
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
  "output_format",
  "write_todos"
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

const CURSOR_JSON_RULES = [
  "Return ONLY a JSON object.",
  "No markdown, no backticks, no extra text.",
  "Do not echo instructions or the schema.",
  "If unsure, use empty string/array/object (or null only if specified)."
].join("\n");

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
          "Inputs: the user mission.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"goal\": string,",
          "  \"constraints\": string[],",
          "  \"openQuestions\": string[],",
          "  \"nonGoals\": string[],",
          "  \"userInput\": string",
          "}",
          "",
          "Guidance:",
          "- goal: short verb phrase capturing the desired outcome.",
          "- constraints: concrete constraints (language, framework, perf, security, time).",
          "- openQuestions: only blockers that must be answered before planning.",
          "- nonGoals: explicitly out-of-scope items.",
          "- Use userInput = original mission."
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}",
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_intake_output", statePath: "state", stateMerge: true }
    },
    {
      id: "spec_acceptance",
      label: "Spec & Acceptance",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Spec & Acceptance agent.",
          "Goal: translate goal into acceptance criteria and definition of done.",
          "Inputs: goal, constraints, openQuestions, nonGoals.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"acceptanceCriteria\": string[],",
          "  \"definitionOfDone\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}",
          "Open questions: {{state.openQuestions}}",
          "Non-goals: {{state.nonGoals}}",
          "Mission: {{mission}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_spec_output", statePath: "state", stateMerge: true }
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
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
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
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Constraints: {{state.constraints}}",
          "Current repoSummary: {{state.repoSummary}}"
        ].join("\n"),
        toolNames: CURSOR_CORE_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_repo_scan_output", statePath: "state", stateMerge: true }
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
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"plan\": object,",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string,",
          "  \"riskRegister\": array",
          "}",
          "",
          "taskQueue format: array of { id, title, status: \"todo\" | \"done\" }.",
          "Ensure taskQueue is ordered and currentTaskId is the first task with status \"todo\" (or \"\" if none)."
        ].join("\n"),
        userPromptTemplate: [
          "Goal: {{state.goal}}",
          "Constraints: {{state.constraints}}",
          "Acceptance criteria: {{state.acceptanceCriteria}}",
          "Definition of done: {{state.definitionOfDone}}",
          "Repo summary: {{state.repoSummary}}",
          "Build commands: {{state.buildCommands}}",
          "Constraints detected: {{state.constraintsDetected}}",
          "Open questions: {{state.openQuestions}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_planner_output", statePath: "state", stateMerge: true }
    },
    {
      id: "route_prep",
      label: "Task Router Prep",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Task Router Prep agent.",
          "Goal: choose the next role based on state.",
          "Do NOT use tools. Decide a single next step deterministically.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"route\": {",
          "    \"next\": \"researcher\" | \"coder\" | \"reviewer\" | \"debugger\" | \"final_gate\",",
          "    \"reason\": string",
          "  }",
          "}",
          "",
          "Compute these booleans from state:",
          "- hasBlocker = blockedReason is not null OR consecutiveErrors >= 3",
          "- hasOpenQuestions = openQuestions.length > 0",
          "- needsResearch = workingNotes is empty AND (mission or goal implies analysis, audit, review, inconsistencies, or repo logic)",
          "- hasTasks = currentTaskId is non-empty OR taskQueue has any items",
          "- hasGateFailures = qualityGates.failed == true OR qualityGates.status == \"fail\"",
          "- needsReview = reviewFeedback is empty AND acceptanceCriteria has items",
          "",
          "Routing priority (apply in order, choose first match):",
          "1) if hasBlocker -> final_gate",
          "2) if hasOpenQuestions -> researcher",
          "3) if needsResearch -> researcher",
          "4) if hasTasks -> coder",
          "5) if hasGateFailures -> debugger",
          "6) if needsReview -> reviewer",
          "7) else -> final_gate"
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Goal: {{state.goal}}",
          "blockedReason: {{state.blockedReason}}",
          "consecutiveErrors: {{state.consecutiveErrors}}",
          "openQuestions: {{state.openQuestions}}",
          "currentTaskId: {{state.currentTaskId}}",
          "taskQueue: {{state.taskQueue}}",
          "qualityGates: {{state.qualityGates}}",
          "reviewFeedback: {{state.reviewFeedback}}",
          "acceptanceCriteria: {{state.acceptanceCriteria}}",
          "workingNotes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_route_output", statePath: "state", stateMerge: true }
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
          "If the mission is analysis or audit, produce concrete findings in workingNotes with file references.",
          TOOL_PREFERENCE_GUIDANCE,
          "",
          "CRITICAL ERROR HANDLING:",
          "If you encounter a CONFIGURATION ERROR (e.g., 'Working folder not configured'),",
          "or any UNRECOVERABLE ERROR that prevents tool usage, you MUST:",
          "1) Set blockedReason to describe the error (e.g., 'Working folder not configured')",
          "2) Clear openQuestions (set to empty array [])",
          "3) Increment consecutiveErrors",
          "4) Do NOT keep retrying the same failing tools",
          "",
          CURSOR_JSON_RULES,
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
          "Include short, source-backed findings in workingNotes (file paths, functions, or configs).",
          "If tools work successfully, set blockedReason to null and consecutiveErrors to 0."
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Open questions: {{state.openQuestions}}",
          "Repo summary: {{state.repoSummary}}"
        ].join("\n"),
        toolNames: CURSOR_RESEARCH_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_researcher_output", statePath: "state", stateMerge: true }
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
          "- Update taskQueue: mark the current task done or remove it.",
          "- If currentTaskId is empty, pick the first todo task in taskQueue.",
          "- Set currentTaskId to the next todo task id (or \"\" if none).",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"fileChanges\": array,",
          "  \"workingNotes\": string[],",
          "  \"taskQueue\": array,",
          "  \"currentTaskId\": string",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "CurrentTaskId: {{state.currentTaskId}}",
          "TaskQueue: {{state.taskQueue}}",
          "Plan: {{state.plan}}",
          "Constraints: {{state.constraints}}",
          "Repo summary: {{state.repoSummary}}",
          "Build commands: {{state.buildCommands}}",
          "Working notes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: CURSOR_CODER_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_coder_output", statePath: "state", stateMerge: true }
    },
    {
      id: "policy_gate",
      label: "Policy / Safety Gate",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Policy Gate.",
          "Goal: review last changes for safety/risk and decide next step.",
          CURSOR_JSON_RULES,
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
        userPromptTemplate: [
          "File changes: {{state.fileChanges}}",
          "Working notes: {{state.workingNotes}}",
          "Constraints: {{state.constraints}}"
        ].join("\n"),
        toolNames: ["git_diff", "search_code"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_policy_output", statePath: "state", stateMerge: true }
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
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"testResults\": object,",
          "  \"qualityGates\": object,",
          "  \"route\": {",
          "    \"next\": \"verify_full\" | \"debugger\",",
          "    \"reason\": string",
          "  }",
          "}",
          "",
          "qualityGates should include: { status: \"pass\" | \"fail\", failed: boolean, summary: string }."
        ].join("\n"),
        userPromptTemplate: [
          "Build commands: {{state.buildCommands}}",
          "Repo summary: {{state.repoSummary}}",
          "Constraints: {{state.constraints}}"
        ].join("\n"),
        toolNames: ["execute_bash", "read_file"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_verify_fast_output", statePath: "state", stateMerge: true }
    },
    {
      id: "verify_full",
      label: "Verify (Full)",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Full Verifier.",
          "Goal: run full test suite/integration and update gates.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"testResults\": object,",
          "  \"qualityGates\": object,",
          "  \"route\": {",
          "    \"next\": \"reviewer\" | \"debugger\",",
          "    \"reason\": string",
          "  }",
          "}",
          "",
          "qualityGates should include: { status: \"pass\" | \"fail\", failed: boolean, summary: string }."
        ].join("\n"),
        userPromptTemplate: [
          "Build commands: {{state.buildCommands}}",
          "Repo summary: {{state.repoSummary}}",
          "Constraints: {{state.constraints}}",
          "Fast test results: {{state.testResults}}"
        ].join("\n"),
        toolNames: ["execute_bash", "read_file"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_verify_full_output", statePath: "state", stateMerge: true }
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
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"reviewFeedback\": array,",
          "  \"taskQueue\": array,",
          "  \"workingNotes\": string[],",
          "  \"currentTaskId\": string,",
          "  \"route\": {",
          "    \"next\": \"coder\",",
          "    \"reason\": string",
          "  }",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Test results: {{state.testResults}}",
          "Quality gates: {{state.qualityGates}}",
          "File changes: {{state.fileChanges}}",
          "TaskQueue: {{state.taskQueue}}",
          "CurrentTaskId: {{state.currentTaskId}}"
        ].join("\n"),
        toolNames: ["read_file", "search_code", "git_diff", "execute_bash"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_debugger_output", statePath: "state", stateMerge: true }
    },
    {
      id: "reviewer",
      label: "Reviewer",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Reviewer.",
          "Goal: check spec, edge cases, security, and correctness.",
          CURSOR_JSON_RULES,
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
        userPromptTemplate: [
          "Acceptance criteria: {{state.acceptanceCriteria}}",
          "Definition of done: {{state.definitionOfDone}}",
          "Test results: {{state.testResults}}",
          "Quality gates: {{state.qualityGates}}",
          "File changes: {{state.fileChanges}}",
          "Working notes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: ["read_file", "git_diff", "search_code"],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_reviewer_output", statePath: "state", stateMerge: true }
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
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"fileChanges\": array,",
          "  \"workingNotes\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Review feedback: {{state.reviewFeedback}}",
          "File changes: {{state.fileChanges}}",
          "Working notes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: CURSOR_CODER_TOOLS,
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_refactor_output", statePath: "state", stateMerge: true }
    },
    {
      id: "final_gate",
      label: "Final Gate",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Final Gate.",
          "Goal: enforce definitionOfDone and decide if the run is complete.",
          "Synthesize finalSummary from workingNotes, repoSummary, and mission context.",
          "Do not repeat prompt instructions; focus on user-facing conclusions.",
          CURSOR_JSON_RULES,
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
        userPromptTemplate: [
          "Acceptance criteria: {{state.acceptanceCriteria}}",
          "Definition of done: {{state.definitionOfDone}}",
          "CurrentTaskId: {{state.currentTaskId}}",
          "TaskQueue: {{state.taskQueue}}",
          "Open questions: {{state.openQuestions}}",
          "Blocked reason: {{state.blockedReason}}",
          "Review feedback: {{state.reviewFeedback}}",
          "Test results: {{state.testResults}}",
          "Quality gates: {{state.qualityGates}}",
          "File changes: {{state.fileChanges}}",
          "Working notes: {{state.workingNotes}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_final_gate_output", statePath: "state", stateMerge: true }
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
          "Return the finalSummary and nextSteps as-is; do not add commentary.",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string,",
          "  \"nextSteps\": string[]",
          "}"
        ].join("\n"),
        userPromptTemplate: [
          "Final summary: {{state.finalSummary}}",
          "Next steps: {{state.nextSteps}}"
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" }
      },
      output: { schemaId: "cursor_done_output", statePath: "state", stateMerge: true }
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
    category: "graph",
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
      nonGoals: [],
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
      qualityGates: { status: "unknown", failed: false },
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
// SPECIALIZED AGENT GRAPHS (Coder, Explorer, Planner)
// Single-node ReAct graphs with tailored tool allowlists and system prompts
// ─────────────────────────────────────────────────────────────────────────────

const CODER_AGENT_TOOLS = [
  ...CURSOR_CORE_TOOLS,
  "write_file",
  "str_replace_editor",
];

const EXPLORER_AGENT_TOOLS = [
  ...CURSOR_RESEARCH_TOOLS,
  "todo_search",
  "bootstrap_context",
  "github_api",
];

const PLANNER_AGENT_TOOLS = [
  "list_files",
  "read_file",
  "read_file_range",
  "search_code",
  "structural_search",
  "symbols_list",
  "find_symbol",
  "go_to_definition",
  "references",
  "find_references",
  "repo_metrics",
  "dependency_info",
  "describe_structure",
  "git_log",
  "git_diff",
  "git_grep",
  "semantic_code_search",
  "write_todos",
  "output_format",
];

const CODER_SYSTEM_PROMPT = [
  "You are a Coder agent specialized in implementing code changes.",
  "Your role is to execute tasks from the task queue, write and edit code with minimal diffs, and update task status.",
  "Focus on: reading code to understand context, then making precise edits.",
  "Always update task status using write_todos as you progress.",
  "When writing code, follow existing patterns and conventions found in the repository.",
  "If the request is multi-step, create and maintain a task queue using write_todos.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");

const EXPLORER_SYSTEM_PROMPT = [
  "You are an Explorer agent specialized in codebase discovery and analysis.",
  "Your role is to investigate code, identify patterns, rules, conventions, and architectural decisions.",
  "Always provide concrete evidence: cite file paths, line numbers, function names, and code snippets.",
  "When answering questions, back every claim with specific references from the codebase.",
  "Discover and report: project structure, dependencies, coding patterns, naming conventions, design guidelines, and potential issues.",
  "Never modify files. Your output is knowledge, not code changes.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");

const PLANNER_SYSTEM_PROMPT = [
  "You are a Planner agent specialized in analyzing requests and producing detailed implementation plans.",
  "Your role is to: understand the user's request, analyze the relevant codebase, and produce a clear actionable plan.",
  "Always use write_todos to create a structured task list with specific, ordered tasks.",
  "Each task should reference concrete files, functions, or modules that need to be changed.",
  "Assess complexity, identify dependencies between tasks, and flag risks.",
  "Do NOT edit files or execute commands. Your output is a plan, not an implementation.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");

export function buildCoderAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "coder_react",
      label: "Coder Agent",
      react: {
        systemPrompt: CODER_SYSTEM_PROMPT,
        userPromptTemplate: "{{mission}}",
        toolNames: CODER_AGENT_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "conversational" },
    },
  ];

  return {
    name: "Coder Agent (agent graph)",
    description: "Specialized agent focused on executing tasks, analyzing code, and writing/editing files.",
    category: "graph",
    nodes,
    edges: [],
  };
}

export function buildExplorerAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "explorer_react",
      label: "Explorer Agent",
      react: {
        systemPrompt: EXPLORER_SYSTEM_PROMPT,
        userPromptTemplate: "{{mission}}",
        toolNames: EXPLORER_AGENT_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "conversational" },
    },
  ];

  return {
    name: "Explorer Agent (agent graph)",
    description: "Specialized agent focused on discovering code, identifying patterns, rules, and guidelines with concrete evidence.",
    category: "graph",
    nodes,
    edges: [],
  };
}

export function buildPlannerAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "planner_react",
      label: "Planner Agent",
      react: {
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        userPromptTemplate: "{{mission}}",
        toolNames: PLANNER_AGENT_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "conversational" },
    },
  ];

  return {
    name: "Planner Agent (agent graph)",
    description: "Specialized agent focused on preparing detailed plans and task lists by analyzing code and understanding requests.",
    category: "graph",
    nodes,
    edges: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION GENERATOR PRO GRAPH
// 6-phase pipeline: research → offer_analysis → structure → enrich → create → verify
// ─────────────────────────────────────────────────────────────────────────────
