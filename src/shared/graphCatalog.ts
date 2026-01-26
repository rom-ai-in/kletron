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
    description: "Standard agent with access to all registered tools.",
    phases: [
      {
        id: "main",
        label: "Main",
        summary: "Main execution loop",
        description: "The primary interaction loop for the agent.",
        systemPrompt: "You are a helpful AI assistant. You have access to a variety of tools. Use them to help the user.",
        toolNames: baseToolNames,
      },
    ],
    nodePrompts: [
      {
        id: "main",
        label: "Main",
        prompt: "You are a helpful AI assistant.",
      },
    ],
    toolNames: baseToolNames,
  },
];

