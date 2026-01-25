import { resolveRepoPath } from "./pathUtils.js";
import { ensureGitRepo, runGit } from "./gitUtils.js";

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

export const gitDiff = {
  description:
    "Show Git diff (working tree, staged, or between two refs). Returns unified diff text.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      from: { type: "string", description: "Base ref (e.g. HEAD~1)." },
      to: { type: "string", description: "Target ref (e.g. HEAD)." },
      staged: { type: "boolean", description: "Show staged changes." },
      filePath: { type: "string", description: "Optional file path filter." },
      contextLines: { type: "number", description: "Number of context lines (-U)." },
      maxChars: { type: "number", description: "Maximum diff characters returned." },
    },
  },
  async run({ path: repoPath, from, to, staged = false, filePath, contextLines = 3, maxChars = 200_000 } = {}) {
    const root = resolveRepoPath(repoPath);
    await ensureGitRepo({ cwd: root });

    const args = ["diff", `-U${Math.max(0, Math.trunc(contextLines))}`];
    if (staged) args.push("--staged");
    if (from && to) args.push(`${from}..${to}`);
    else if (from) args.push(from);
    if (filePath) args.push("--", filePath);

    const stdout = await runGit({ cwd: root, args, timeoutMs: 15_000, maxBuffer: 20 * 1024 * 1024 });
    const { text, truncated } = truncateText(stdout, Math.max(1_000, Math.trunc(maxChars)));
    return { diff: text, truncated };
  },
};

