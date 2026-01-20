import { resolveRepoPath } from "./pathUtils.js";
import { ensureGitRepo, runGit } from "./gitUtils.js";

export const gitLog = {
  description: "List recent Git commits (optionally filtered to a file).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      maxCount: { type: "number", description: "Maximum number of commits." },
      filePath: { type: "string", description: "Optional file path to filter history." },
      ref: { type: "string", description: "Optional ref (branch, tag, sha). Defaults to HEAD." },
    },
  },
  async run({ path: repoPath, maxCount = 20, filePath, ref } = {}) {
    const root = resolveRepoPath(repoPath);
    await ensureGitRepo({ cwd: root });

    const format = "%H%x1f%an%x1f%ae%x1f%ad%x1f%s";
    const args = ["log", "--date=iso-strict", `--pretty=format:${format}`, `--max-count=${Math.max(1, Math.trunc(maxCount))}`];
    if (ref) args.push(ref);
    if (filePath) args.push("--", filePath);

    const stdout = await runGit({ cwd: root, args, timeoutMs: 15_000 });
    const lines = stdout.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [hash, authorName, authorEmail, date, subject] = line.split("\u001f");
      return { hash, authorName, authorEmail, date, subject };
    });
  },
};

