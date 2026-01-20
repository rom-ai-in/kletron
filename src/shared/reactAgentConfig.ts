export const simpleReactGraphId = "react";
export const simpleReactPhaseId = "react_agent";
export const simpleReactPhaseLabel = "Simple ReAct agent";
export const simpleReactPhaseSummary = "Run a single ReAct agent for quick repo questions.";
export const simpleReactPhaseDescription =
  "Provide a concise answer to the user's request by reasoning with the available MCP tools.";
export const simpleReactSystemPrompt = `You are the SimpleReAct agent for high-level repository questions.
Use the available MCP tools (list_files, read_file, search_code, git_log, git_diff) to fetch facts, but do not overuse them.
Only call a tool when you need concrete evidence, and explain why you are invoking it.
Limit tool calls to 5 in this session and prefer concise observations.
When answering, lean on markdown prose; cite file paths or commits when referencing specific repo content.
Deliver the final response directly (no wrappers like JSON objects) while referencing the supporting facts.`;
export const simpleReactToolNames = [
  "list_files",
  "read_file",
  "search_code",
  "git_log",
  "git_diff",
];
