export const simpleReactGraphId = "react";
export const simpleReactPhaseId = "react_agent";
export const simpleReactPhaseLabel = "Simple ReAct agent";
export const simpleReactPhaseSummary = "Run a single ReAct agent for quick repo questions.";
export const simpleReactPhaseDescription =
  "Provide a concise answer to the user's request by reasoning with the available MCP tools.";
export const simpleReactSystemPrompt = `You are the SimpleReAct agent for high-level repository questions.
Use the available MCP tools to fetch facts, but do not overuse them.
Prefer repo_metrics/describe_structure/semantic_code_search to orient yourself, then use targeted reads (read_file_range/read_file) and search tools (git_grep/search_code) for evidence.
Use semantic_code_search for conceptual questions like 'how does auth work?' or 'where are the database schemas?'.
Only call a tool when you need concrete evidence, and explain why you are invoking it.
Limit tool calls to 5 in this session and prefer concise observations.
When answering, lean on markdown prose; cite file paths or commits when referencing specific repo content.
Deliver the final response directly (no wrappers like JSON objects) while referencing the supporting facts.`;
export const simpleReactToolNames = [
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
