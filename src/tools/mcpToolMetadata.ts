export type McpToolMeta = {
  name: string;
  label: string;
  description: string;
  file: string;
  categories: string[];
};

export const mcpToolMetadata: McpToolMeta[] = [
  {
    name: "list_files",
    label: "List repository files",
    description: "Enumerates files under the configured repo root while skipping node_modules/.git/dist/build.",
    file: "github-mcp/tools/listFiles.js",
    categories: ["exploration", "fs"],
  },
  {
    name: "repo_metrics",
    label: "Compute repo metrics",
    description: "Returns language counts, top file sizes, and quick repo health signals.",
    file: "github-mcp/tools/repoMetrics.js",
    categories: ["insights"],
  },
  {
    name: "describe_structure",
    label: "Describe structure",
    description: "Summarizes package layout, entrypoints, and critical folders.",
    file: "github-mcp/tools/describeStructure.js",
    categories: ["mapping"],
  },
  {
    name: "search_code",
    label: "Search code",
    description: "Run textual/regex searches across source files with context lines.",
    file: "github-mcp/tools/searchCode.js",
    categories: ["search"],
  },
  {
    name: "read_file",
    label: "Read file",
    description: "Read the full contents of a file inside the repo root.",
    file: "github-mcp/tools/readFile.js",
    categories: ["fs"],
  },
  {
    name: "read_file_range",
    label: "Read file range",
    description: "Read a specific line range from a file for focused inspection.",
    file: "github-mcp/tools/readFileRange.js",
    categories: ["fs", "audit"],
  },
  {
    name: "git_log",
    label: "Git log",
    description: "Reads recent commits, optionally filtered to a path or ref.",
    file: "github-mcp/tools/gitLog.js",
    categories: ["vcs"],
  },
  {
    name: "git_diff",
    label: "Git diff",
    description: "Shows diffs between refs or working tree for diagnostic comparisons.",
    file: "github-mcp/tools/gitDiff.js",
    categories: ["vcs", "audit"],
  },
  {
    name: "git_blame",
    label: "Git blame",
    description: "Identifies recent owners of a line range (supports start/end line).",
    file: "github-mcp/tools/gitBlame.js",
    categories: ["investigation"],
  },
  {
    name: "git_grep",
    label: "Git grep",
    description: "Search tracked files using git grep with optional globs and regex.",
    file: "github-mcp/tools/gitGrep.js",
    categories: ["search", "vcs"],
  },
  {
    name: "todo_search",
    label: "TODO search",
    description: "Locate TODO/FIXME/HACK style markers across the repo.",
    file: "github-mcp/tools/todoSearch.js",
    categories: ["search", "insights"],
  },
  {
    name: "write_file",
    label: "Write file",
    description: "Writes or updates files inside the repo root (used in final report phase).",
    file: "github-mcp/tools/writeFile.js",
    categories: ["write"],
  },
];
