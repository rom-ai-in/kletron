import { resolveRepoPath } from "./pathUtils.js";
import { ensureGitRepo, runGit } from "./gitUtils.js";

function buildArgs({ query, regex, caseSensitive, wholeWord }) {
  const args = ["grep", "-n", "--column", "--no-color"];
  if (!caseSensitive) args.push("-i");
  if (wholeWord) args.push("-w");
  if (!regex) args.push("-F");
  args.push("--", query);
  return args;
}

export const gitGrep = {
  description: "Search tracked files using `git grep` and return file/line/snippet matches.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      query: { type: "string", description: "Text or regex pattern." },
      regex: { type: "boolean", description: "Interpret query as regex (default false => fixed string)." },
      caseSensitive: { type: "boolean" },
      wholeWord: { type: "boolean" },
      globs: {
        type: "array",
        items: { type: "string" },
        description: "Optional pathspec globs (e.g. ['*.ts','src/**']).",
      },
      maxResults: { type: "number" },
    },
    required: ["query"],
  },
  async run({ path: repoPath, query, regex = false, caseSensitive = false, wholeWord = false, globs, maxResults = 200 } = {}) {
    const root = resolveRepoPath(repoPath);
    await ensureGitRepo({ cwd: root });

    const args = buildArgs({ query, regex, caseSensitive, wholeWord });
    if (globs && globs.length) {
      args.push(...globs);
    }

    const stdout = await runGit({ cwd: root, args, timeoutMs: 20_000, maxBuffer: 2 * 1024 * 1024 });
    const lines = stdout.split("\n").filter(Boolean);

    const matches = [];
    for (const line of lines) {
      if (matches.length >= maxResults) break;
      const first = line.indexOf(":");
      const second = first >= 0 ? line.indexOf(":", first + 1) : -1;
      const third = second >= 0 ? line.indexOf(":", second + 1) : -1;
      if (first < 0 || second < 0 || third < 0) continue;
      const file = line.slice(0, first);
      const lineNumber = Number(line.slice(first + 1, second));
      const column = Number(line.slice(second + 1, third));
      const snippet = line.slice(third + 1);
      matches.push({ file, line: lineNumber, column, snippet });
    }

    return { matches, totalMatches: lines.length, truncated: matches.length >= maxResults };
  },
};

