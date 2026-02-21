import type { AgentGraphDefinition, AgentGraphNode } from "./agentGraphTypes";

export const simpleReactPhaseId = "simple_react";
export const simpleReactPhaseLabel = "Agent (ReAct)";
const TOOL_PREFERENCE_GUIDANCE = [
  "Tooling guidance:",
  "- Prefer list_files/read_file/search_code/git_grep/semantic_code_search before execute_bash.",
  "- Use execute_bash only when a shell pipeline is truly required.",
  "- Avoid repeating commands; reuse prior outputs.",
  "- NEVER call write_todos with the same payload more than once. Create your plan, then execute it.",
  "- After gathering enough information, STOP gathering and produce your output/report.",
].join(" ");
export const simpleReactSystemPrompt = [
  "You are a helpful AI assistant.",
  "Use tools to answer the user's question accurately. Focus on the repository context if provided.",
  "If the request is multi-step, create a task queue using write_todos ONCE, then execute tasks using other tools.",
  "Update task status as you progress — but do NOT recreate the same task queue repeatedly.",
  "After gathering sufficient information, STOP gathering and produce your final output.",
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
          "If tools work successfully, set blockedReason to null and consecutiveErrors to 0.",
          "",
          "ANTI-LOOP: You already have repository access via tools. Do NOT ask the user for repo access.",
          "Do NOT re-create the same plan. If you have already gathered information, produce findings."
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
  "Update task status using write_todos as you progress — but only when status actually changes.",
  "When writing code, follow existing patterns and conventions found in the repository.",
  "If the request is multi-step, create a task queue using write_todos ONCE, then start executing.",
  "Do NOT repeatedly recreate the task queue with the same content.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");

const EXPLORER_SYSTEM_PROMPT = [
  "You are an Explorer agent specialized in codebase discovery and analysis.",
  "Your role is to investigate code, identify patterns, rules, conventions, and architectural decisions.",
  "Always provide concrete evidence: cite file paths, line numbers, function names, and code snippets.",
  "When answering questions, back every claim with specific references from the codebase.",
  "Discover and report: project structure, dependencies, coding patterns, naming conventions, design guidelines, and potential issues.",
  "Never modify files. Your output is knowledge, not code changes.",
  "You already have full repository access via tools — do NOT ask the user for repo access or URLs.",
  "Plan ONCE using write_todos, then gather data using tools, then produce your final report. Do NOT re-plan.",
  TOOL_PREFERENCE_GUIDANCE,
].join(" ");

const PLANNER_SYSTEM_PROMPT = [
  "You are a Planner agent specialized in analyzing requests and producing detailed implementation plans.",
  "Your role is to: understand the user's request, analyze the relevant codebase, and produce a clear actionable plan.",
  "Use write_todos ONCE to create a structured task list with specific, ordered tasks.",
  "Each task should reference concrete files, functions, or modules that need to be changed.",
  "Assess complexity, identify dependencies between tasks, and flag risks.",
  "Do NOT edit files or execute commands. Your output is a plan, not an implementation.",
  "Do NOT call write_todos multiple times with the same content. Create the plan once, then finalize.",
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

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUOUS IMPROVEMENT GRAPH (STATE MACHINE)
// Automated codebase health scan → GitHub sync → triage → auto-fix → report
// Designed to run daily via cron to suggest and implement improvements
// ─────────────────────────────────────────────────────────────────────────────

const CI_DISCOVERY_TOOLS = [
  ...CURSOR_RESEARCH_TOOLS,
  "dependency_info",
  "describe_structure",
  "repo_metrics",
  "structural_search",
  "symbols_list",
  "git_grep",
  "git_blame",
];

const CI_IMPLEMENT_TOOLS = [
  ...CURSOR_CODER_TOOLS,
  "github_api",
];

export function buildContinuousImprovementGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "ci_discovery",
      label: "Discovery & Health Scan",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Continuous Improvement Discovery agent.",
          "Goal: scan the codebase for improvement opportunities across multiple dimensions.",
          "",
          "Load and follow these skills for guidance:",
          "- code-health-scanner: TODOs, complexity, churn, duplication, dead code",
          "- security-auditor: vulnerabilities, auth issues, secret exposure",
          "- ux-reviewer: missing states, accessibility, design system consistency",
          "- dependency-checker: outdated packages, CVEs, deprecated APIs",
          "",
          "Scan broadly first using repo_metrics and describe_structure, then deep-dive into problem areas.",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"findings\": array of { category, file, lineStart?, lineEnd?, description, severity, evidence, autoFixable, suggestedFix? },",
          "  \"summary\": { totalFindings, byCategory: object, hotspotFiles: string[] },",
          "  \"repoSummary\": string",
          "}",
          "",
          "findings.category must be one of: todo, complexity, churn, duplication, dead_code, inconsistency,",
          "injection, auth, secrets, validation, dependencies, cors, path_traversal, rate_limiting,",
          "loading_state, error_state, empty_state, accessibility, responsive, design_system, user_feedback,",
          "outdated, vulnerability, deprecated, peer_dependency, bundle_size, duplicate.",
          "",
          "Limit to the 40 most impactful findings. Focus on actionable items with evidence.",
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}",
        toolNames: CI_DISCOVERY_TOOLS,
        skillIds: ["code-health-scanner", "security-auditor", "ux-reviewer", "dependency-checker"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ci_github_sync",
      label: "GitHub Sync",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the GitHub Sync agent.",
          "Goal: fetch open GitHub issues and recent PR discussions, then correlate with codebase findings.",
          "",
          "Steps:",
          "1. Use github_api with resource='issues' to fetch open issues",
          "2. Use github_api with resource='pulls' to fetch open PRs",
          "3. Correlate issues/PRs with the codebase findings from the previous stage",
          "4. Identify any issues that match or relate to the discovered findings",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"githubIssues\": array of { number, title, labels, relatedFindings? },",
          "  \"githubPulls\": array of { number, title, state, staleDays? },",
          "  \"correlations\": array of { findingDescription, issueNumber, confidence }",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Codebase findings summary: {{state.summary}}",
          "Hotspot files: {{state.hotspotFiles}}",
        ].join("\n"),
        toolNames: ["github_api", "web_search"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ci_triage",
      label: "Triage & Prioritize",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Improvement Triager.",
          "Goal: categorize, score, and prioritize all findings into structured improvement suggestions.",
          "",
          "Load and follow the improvement-triager skill for scoring criteria and output format.",
          "",
          "Key responsibilities:",
          "- Categorize each finding: feature | bug | ux | perf | security | refactor | deps | docs | testing",
          "- Score priority: CRITICAL | HIGH | MEDIUM | LOW based on impact and effort",
          "- Estimate effort: XS | S | M | L | XL",
          "- Assess confidence: 0-100 (filter out < 50)",
          "- Determine autoFixable: true only for mechanical, low-risk changes",
          "- Correlate with GitHub issues when applicable",
          "- Deduplicate overlapping findings",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"suggestions\": array of ImprovementSuggestion objects,",
          "  \"triageSummary\": { total, autoFixable, byCategory: object, byPriority: object },",
          "  \"route\": { \"next\": \"ci_implement\" | \"ci_report\", \"reason\": string }",
          "}",
          "",
          "Route to ci_implement if there are autoFixable suggestions with priority CRITICAL or HIGH.",
          "Route to ci_report if there are no autoFixable items or all are LOW/MEDIUM priority.",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Codebase findings: {{state.findings}}",
          "GitHub issues: {{state.githubIssues}}",
          "GitHub correlations: {{state.correlations}}",
        ].join("\n"),
        toolNames: [],
        skillIds: ["improvement-triager"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ci_triage_router",
      label: "Triage Router",
      kind: "router",
      react: {
        systemPrompt: "Router node. Routes based on state.route.next.",
        userPromptTemplate: "",
        toolNames: [],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json" },
    },
    {
      id: "ci_implement",
      label: "Auto-Implement Fixes",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Continuous Improvement Coder.",
          "Goal: implement the highest-priority auto-fixable improvements from the triage results.",
          "",
          "Steps:",
          "1. Filter suggestions where autoFixable=true AND priority is CRITICAL or HIGH",
          "2. For each fixable suggestion (up to 5 max per run):",
          "   a. Read the affected file(s)",
          "   b. Implement the fix using write_file or str_replace_editor",
          "   c. Record what was changed",
          "3. After all fixes, use execute_bash to run lint/typecheck if available",
          "",
          "IMPORTANT SAFETY RULES:",
          "- Only make changes that are clearly correct and low-risk",
          "- Never modify core business logic or database schemas",
          "- Never remove tests or reduce test coverage",
          "- If unsure about a fix, skip it and mark as needs_human_review",
          "- Maximum 5 fixes per run to keep changes reviewable",
          "",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"implementedFixes\": array of { suggestionId, title, files, description, success },",
          "  \"skippedSuggestions\": array of { suggestionId, reason },",
          "  \"fileChanges\": array of { file, changeType, description }",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Auto-fixable suggestions: {{state.suggestions}}",
          "Repo summary: {{state.repoSummary}}",
        ].join("\n"),
        toolNames: CI_IMPLEMENT_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ci_verify",
      label: "Verify Changes",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Verification agent.",
          "Goal: verify that the auto-implemented changes are correct and don't break anything.",
          "",
          "Steps:",
          "1. Review the file changes using git_diff",
          "2. Run available checks: lint, typecheck, tests using execute_bash",
          "3. If any check fails, report which fixes need to be reverted",
          "4. Summarize verification results",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"verificationResults\": array of { suggestionId, passed, errors? },",
          "  \"allPassed\": boolean,",
          "  \"buildOutput\": string",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Implemented fixes: {{state.implementedFixes}}",
          "File changes: {{state.fileChanges}}",
          "Repo summary: {{state.repoSummary}}",
        ].join("\n"),
        toolNames: ["execute_bash", "read_file", "git_diff", "search_code"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ci_report",
      label: "Generate Report & Notify",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Continuous Improvement Reporter.",
          "Goal: generate a comprehensive improvement report and send notifications.",
          "",
          "Steps:",
          "1. Summarize all findings and suggestions from the triage",
          "2. If fixes were implemented, summarize what was changed and verification results",
          "3. List remaining suggestions that need human attention",
          "4. Create a GitHub issue with the report using github_api (resource='create_issue')",
          "   - Title: 'Continuous Improvement Report - [DATE]'",
          "   - Labels: ['continuous-improvement', 'automated']",
          "5. Optionally send a webhook notification using the notify tool",
          "",
          "Report format should be clear markdown with sections:",
          "- Executive Summary",
          "- Auto-Fixed Items (if any)",
          "- Suggestions Requiring Human Review (grouped by priority)",
          "- Statistics",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalSummary\": string (markdown report),",
          "  \"issueCreated\": { number?, url?, error? },",
          "  \"notificationSent\": { ok, error? },",
          "  \"stats\": { totalSuggestions, implemented, skipped, byCategory: object }",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Triage summary: {{state.triageSummary}}",
          "All suggestions: {{state.suggestions}}",
          "Implemented fixes: {{state.implementedFixes}}",
          "Skipped suggestions: {{state.skippedSuggestions}}",
          "Verification results: {{state.verificationResults}}",
        ].join("\n"),
        toolNames: ["github_api", "notify"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
  ];

  const edges = [
    // Linear flow: discovery → github sync → triage
    { id: "edge-ci-discovery-github", source: "ci_discovery", target: "ci_github_sync" },
    { id: "edge-ci-github-triage", source: "ci_github_sync", target: "ci_triage" },
    // Triage routes via router
    { id: "edge-ci-triage-router", source: "ci_triage", target: "ci_triage_router" },
    { id: "edge-ci-router-implement", source: "ci_triage_router", target: "ci_implement", condition: "state.route.next == \"ci_implement\"" },
    { id: "edge-ci-router-report", source: "ci_triage_router", target: "ci_report", condition: "state.route.next == \"ci_report\"" },
    // Implement → verify → report
    { id: "edge-ci-implement-verify", source: "ci_implement", target: "ci_verify" },
    { id: "edge-ci-verify-report", source: "ci_verify", target: "ci_report" },
  ];

  return {
    name: "Continuous Improvement (agent graph)",
    description:
      "Automated daily codebase health scan with GitHub sync, triage, auto-fix, and report generation. Designed for scheduled execution via cron.",
    category: "continuous_improvement",
    nodes,
    edges,
    execution: {
      mode: "state_machine",
      entryNodeId: "ci_discovery",
      maxIterations: 50,
      maxNodeRuns: 5,
    },
    stateDefaults: {
      findings: [],
      summary: {},
      repoSummary: "",
      githubIssues: [],
      githubPulls: [],
      correlations: [],
      suggestions: [],
      triageSummary: {},
      implementedFixes: [],
      skippedSuggestions: [],
      fileChanges: [],
      verificationResults: [],
      allPassed: false,
      buildOutput: "",
      finalSummary: "",
      issueCreated: {},
      notificationSent: {},
      stats: {},
      route: { next: "ci_report", reason: "default" },
    },
  };
}

// ---------------------------------------------------------------------------
// Business Analyst Graph
// ---------------------------------------------------------------------------

const BA_DISCOVERY_TOOLS = [
  "list_files",
  "read_file",
  "read_file_range",
  "search_code",
  "describe_structure",
  "repo_metrics",
  "dependency_info",
  "semantic_code_search",
  "symbols_list",
  "find_symbol",
];

const BA_WEB_TOOLS = [
  "web_search",
  "fetch_url",
];

export function buildBusinessAnalystGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: "ba_context_loader",
      label: "Context & Strategy Review",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Business Analyst Context Loader.",
          "Goal: Load and analyze the product's Business Context and Document Context to establish a strategic baseline.",
          "",
          "Steps:",
          "1. Read and analyze the repository structure using describe_structure and list_files",
          "2. Identify the tech stack, architecture patterns, and existing features",
          "3. Summarize the product vision, target personas, competitors, and strategic positioning",
          "4. Identify the current state of the product and key strengths",
          "",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"productSummary\": string (comprehensive product description),",
          "  \"techStack\": array of string,",
          "  \"existingFeatures\": array of { name, description, maturity },",
          "  \"architecturePattern\": string,",
          "  \"productStrengths\": array of string,",
          "  \"productWeaknesses\": array of string,",
          "  \"personas\": array of { name, role, goals, painPoints },",
          "  \"competitors\": array of { name, description, strengths, weaknesses },",
          "  \"strategicPosition\": string",
          "}",
        ].join("\n"),
        userPromptTemplate: "Mission:\n{{mission}}\n\nBusiness Context:\n{{state.businessContext}}",
        toolNames: BA_DISCOVERY_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_market_scanner",
      label: "Market Scanning",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Market Scanner agent.",
          "Goal: Analyze current market trends, emerging technologies, and industry movements relevant to this product's domain.",
          "",
          "Steps:",
          "1. Use web_search to research current market trends in the product's domain",
          "2. Identify emerging technologies and paradigms",
          "3. Look for industry reports and analyst opinions",
          "4. Identify market size and growth indicators",
          "5. Spot opportunities and threats in the market",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"marketSize\": string,",
          "  \"growthTrend\": string,",
          "  \"keyTrends\": array of string,",
          "  \"emergingTech\": array of string,",
          "  \"opportunities\": array of string,",
          "  \"threats\": array of string,",
          "  \"industryInsights\": array of { topic, insight, relevance }",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Product summary: {{state.productSummary}}",
          "Tech stack: {{state.techStack}}",
          "Strategic position: {{state.strategicPosition}}",
        ].join("\n"),
        toolNames: BA_WEB_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_competitive_analyzer",
      label: "Competitive Analysis",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Competitive Analysis agent.",
          "Goal: Deep-dive into each competitor. Build a feature-by-feature competitive matrix. Identify gaps and opportunities.",
          "",
          "Steps:",
          "1. For each competitor, research their product features, pricing, and market position",
          "2. Build a feature matrix comparing our product vs each competitor",
          "3. Score each feature area: absent | basic | good | excellent",
          "4. Identify competitive gaps (features they have that we don't)",
          "5. Identify our advantages (features we have that they don't or do better)",
          "6. Suggest strategic differentiators",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"competitiveMatrix\": array of { featureArea, ourStatus, competitors: Record<string, status>, gap, opportunity },",
          "  \"competitiveAdvantages\": array of string,",
          "  \"competitiveGaps\": array of string,",
          "  \"marketGaps\": array of string,",
          "  \"strategicDifferentiators\": array of string,",
          "  \"competitiveScore\": number (0-100)",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Product summary: {{state.productSummary}}",
          "Existing features: {{state.existingFeatures}}",
          "Competitors: {{state.competitors}}",
          "Market trends: {{state.keyTrends}}",
        ].join("\n"),
        toolNames: [...BA_WEB_TOOLS, "read_file", "search_code"],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_feature_generator",
      label: "Feature Discovery & Generation",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Feature Discovery agent.",
          "Goal: Generate comprehensive feature proposals based on context, market analysis, competitive gaps, and user persona needs.",
          "",
          "Generate features in these categories:",
          "- new_feature: Completely new functionality",
          "- improvement: Enhancement to existing features",
          "- fix: UX or functional issues to address",
          "- optimization: Performance, scalability improvements",
          "- innovation: Differentiation and cutting-edge features",
          "- competitive: Features to match or surpass competitors",
          "- technical_debt: Architectural improvements",
          "- compliance: Regulatory or standards compliance",
          "",
          "For each feature, provide ALL fields:",
          "- title: Short descriptive title",
          "- type: one of the categories above",
          "- summary: 1-2 sentence description",
          "- description: Detailed markdown description",
          "- userStory: 'As a X, I want Y, so that Z'",
          "- businessValue: CRITICAL | HIGH | MEDIUM | LOW",
          "- effort: XS | S | M | L | XL",
          "- priority: 0-100",
          "- confidenceScore: 0-100",
          "- innovationScore: 0-100",
          "- competitiveContext: How this compares to competitors",
          "- impactAreas: array of areas impacted (UX, Revenue, Retention, etc.)",
          "- risks: array of identified risks",
          "",
          "Generate at least 15-25 features across all categories.",
          "Explore the actual codebase to understand what exists and what's missing.",
          "",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"features\": array of feature objects with all fields listed above",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Product summary: {{state.productSummary}}",
          "Existing features: {{state.existingFeatures}}",
          "Product strengths: {{state.productStrengths}}",
          "Product weaknesses: {{state.productWeaknesses}}",
          "Personas: {{state.personas}}",
          "Market opportunities: {{state.opportunities}}",
          "Market threats: {{state.threats}}",
          "Competitive gaps: {{state.competitiveGaps}}",
          "Competitive matrix: {{state.competitiveMatrix}}",
          "Market gaps: {{state.marketGaps}}",
        ].join("\n"),
        toolNames: BA_DISCOVERY_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_requirements_drafter",
      label: "Requirements Drafting",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Requirements Drafting agent.",
          "Goal: For each feature proposal, draft detailed requirements with acceptance criteria, user stories, and implementation hints.",
          "",
          "For each feature:",
          "1. Refine the user story to be specific and testable",
          "2. Write 3-5 detailed acceptance criteria",
          "3. Identify dependencies on other features or technical prerequisites",
          "4. Explore the codebase to identify affected files and suggest an implementation approach",
          "5. Assess effort more precisely based on codebase complexity",
          "",
          TOOL_PREFERENCE_GUIDANCE,
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"features\": array of enriched feature objects with added acceptanceCriteria, dependencies, suggestedApproach, affectedFiles",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Features to enrich: {{state.features}}",
          "Tech stack: {{state.techStack}}",
          "Architecture: {{state.architecturePattern}}",
        ].join("\n"),
        toolNames: BA_DISCOVERY_TOOLS,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_scorer",
      label: "Prioritization & Scoring",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Feature Scoring agent.",
          "Goal: Final scoring pass. Re-score each feature on business value, effort, innovation, and competitive advantage.",
          "",
          "Steps:",
          "1. Review each feature against the product vision and persona needs",
          "2. Re-score priority (0-100) based on: business impact (40%), effort efficiency (20%), innovation (20%), competitive advantage (20%)",
          "3. Deduplicate overlapping features",
          "4. Sort by final priority score descending",
          "5. Assign final source: ai_generated, competitive, market, or innovation",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"features\": array of features with final scores,",
          "  \"quickWins\": array of feature titles with high value and low effort,",
          "  \"strategicRecommendations\": array of string",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "Features to score: {{state.features}}",
          "Competitive score: {{state.competitiveScore}}",
          "Market opportunities: {{state.opportunities}}",
          "Personas: {{state.personas}}",
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
    {
      id: "ba_report",
      label: "Final Report Generation",
      kind: "react",
      react: {
        systemPrompt: [
          "You are the Business Analyst Report Generator.",
          "Goal: Generate a comprehensive BA report in markdown format.",
          "",
          "Report structure:",
          "1. Executive Summary (key findings, top recommendations)",
          "2. Market Overview (trends, opportunities, threats)",
          "3. Competitive Landscape (matrix summary, gaps, advantages)",
          "4. Feature Proposals (grouped by type, sorted by priority)",
          "5. Quick Wins (high-value, low-effort features)",
          "6. Strategic Recommendations",
          "7. Innovation Opportunities",
          "8. Statistics (total features, by type, by priority)",
          "",
          CURSOR_JSON_RULES,
          "",
          "Write ONLY these keys:",
          "{",
          "  \"finalReport\": string (full markdown report),",
          "  \"stats\": { totalFeatures, byType: object, byPriority: object, avgInnovationScore, competitiveScore }",
          "}",
        ].join("\n"),
        userPromptTemplate: [
          "Mission: {{mission}}",
          "All features: {{state.features}}",
          "Quick wins: {{state.quickWins}}",
          "Strategic recommendations: {{state.strategicRecommendations}}",
          "Competitive matrix: {{state.competitiveMatrix}}",
          "Market trends: {{state.keyTrends}}",
          "Market opportunities: {{state.opportunities}}",
          "Market threats: {{state.threats}}",
          "Competitive score: {{state.competitiveScore}}",
        ].join("\n"),
        toolNames: [],
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json", statePath: "state", stateMerge: true },
    },
  ];

  const edges = [
    { id: "edge-ba-context-market", source: "ba_context_loader", target: "ba_market_scanner" },
    { id: "edge-ba-market-competitive", source: "ba_market_scanner", target: "ba_competitive_analyzer" },
    { id: "edge-ba-competitive-features", source: "ba_competitive_analyzer", target: "ba_feature_generator" },
    { id: "edge-ba-features-requirements", source: "ba_feature_generator", target: "ba_requirements_drafter" },
    { id: "edge-ba-requirements-scorer", source: "ba_requirements_drafter", target: "ba_scorer" },
    { id: "edge-ba-scorer-report", source: "ba_scorer", target: "ba_report" },
  ];

  return {
    name: "Business Analyst",
    description:
      "AI-powered business analysis: context review, market scanning, competitive analysis, feature discovery, requirements drafting, scoring, and report generation.",
    category: "business_analysis",
    nodes,
    edges,
    execution: {
      mode: "dag",
    },
    stateDefaults: {
      businessContext: {},
      productSummary: "",
      techStack: [],
      existingFeatures: [],
      architecturePattern: "",
      productStrengths: [],
      productWeaknesses: [],
      personas: [],
      competitors: [],
      strategicPosition: "",
      marketSize: "",
      growthTrend: "",
      keyTrends: [],
      emergingTech: [],
      opportunities: [],
      threats: [],
      industryInsights: [],
      competitiveMatrix: [],
      competitiveAdvantages: [],
      competitiveGaps: [],
      marketGaps: [],
      strategicDifferentiators: [],
      competitiveScore: 0,
      features: [],
      quickWins: [],
      strategicRecommendations: [],
      finalReport: "",
      stats: {},
    },
  };
}
