export type PhaseDefinition = {
  id: string;
  label: string;
  summary: string;
  description: string;
  systemPrompt: string;
  toolNames: string[];
};

export type GraphId = string;

export type GraphNodePrompt = {
  id: string;
  label: string;
  prompt: string;
};

// Core file operations and coding tools
const baseToolNames = [
  // File operations
  "list_files",
  "read_file",
  "read_file_range",
  "write_file",
  // Repo + code analysis
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
  "semantic_code_search",
  "github_api",
  "bootstrap_context",
  "locate_ui_feature",
  "execute_bash",
  "output_format",
  "write_todos",
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
    id: "universal-v1",
    name: "Universal Agent",
    description: "General coding agent for code changes, debugging, and GitHub-centric workflows.",
    phases: [
      {
        id: "main",
        label: "Main",
        summary: "Main execution loop",
        description: "The primary interaction loop for the agent.",
        systemPrompt: `You are a coding assistant focused on code changes, debugging, and GitHub-centric workflows.

## YOUR PRIMARY CAPABILITIES:
- Inspect and modify code in the local repository.
- Analyze diffs and recent changes.
- Use Git tooling to understand history and changes.
- Use GitHub API for repo metadata, issues, and releases.

## WORKING PRINCIPLES:
- Prefer concrete file references and diffs.
- When modifying files, keep changes minimal and explain why.
- Ask for clarification if repo scope or intent is ambiguous.`,
        toolNames: baseToolNames,
      },
    ],
    nodePrompts: [
      {
        id: "main",
        label: "Main",
        prompt: "You are a coding assistant focused on code changes and GitHub workflows.",
      },
    ],
    toolNames: baseToolNames,
  },
];

export type DeepResearchPhaseKey = "clarify" | "brief" | "plan" | "research" | "summary" | "report";

export const deepResearchPhaseOrder: DeepResearchPhaseKey[] = [
  "clarify",
  "brief",
  "plan",
  "research",
  "summary",
  "report"
];

export const deepResearchPhaseConfig: Record<DeepResearchPhaseKey, PhaseDefinition> = {
  clarify: {
    id: "clarify",
    label: "Clarify Question",
    summary: "Ensuring question clarity",
    description: "Asks the user for clarification if the request is ambiguous.",
    systemPrompt: "You are an expert researcher. Clarify the user request if needed.",
    toolNames: []
  },
  brief: {
    id: "brief",
    label: "Research Brief",
    summary: "Creating research brief",
    description: "Generates a detailed research brief based on the request.",
    systemPrompt: "You are a lead researcher. Create a comprehensive research brief.",
    toolNames: []
  },
  plan: {
    id: "plan",
    label: "Plan Research",
    summary: "Planning research steps",
    description: "Creates a step-by-step plan to execute the research.",
    systemPrompt: "You are a research planner. Break down the brief into actionable steps.",
    toolNames: []
  },
  research: {
    id: "research",
    label: "Researcher",
    summary: "Conducting research",
    description: "Executes specific research tasks using tools.",
    systemPrompt: "You are a code researcher. Use tools to find information.",
    toolNames: baseToolNames
  },
  summary: {
    id: "summary",
    label: "Summarize Findings",
    summary: "Synthesizing findings",
    description: "Aggregates all research findings into a summary.",
    systemPrompt: "Synthesize the gathered information into a coherent summary.",
    toolNames: []
  },
  report: {
    id: "report",
    label: "Action Report",
    summary: "Generating report",
    description: "Creates the final action report.",
    systemPrompt: "Write a final report based on the research findings.",
    toolNames: []
  }
};
