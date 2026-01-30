import { resolveRepoPath } from "./pathUtils.js";
import { ensureGitRepo, runGit } from "./gitUtils.js";

function clampLine(value, min) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.trunc(value));
}

export const gitBlame = {
  description: "Get `git blame` for a file (porcelain parsed).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      filePath: { type: "string", description: "File path (relative to repo root)." },
      startLine: { type: "number", description: "1-based start line (inclusive)." },
      endLine: { type: "number", description: "1-based end line (inclusive)." },
      maxLines: { type: "number", description: "Safety cap for returned lines." },
    },
    required: ["filePath"],
  },
  async run({ path: repoPath, filePath, startLine, endLine, maxLines = 300 } = {}) {
    const root = resolveRepoPath(repoPath);
    await ensureGitRepo({ cwd: root });

    const start = startLine ? clampLine(startLine, 1) : undefined;
    const end = endLine ? clampLine(endLine, start ?? 1) : undefined;

    const args = ["blame", "-p"];
    if (start && end) args.push(`-L${start},${end}`);
    args.push("--", filePath);

    const stdout = await runGit({ cwd: root, args, timeoutMs: 25_000, maxBuffer: 2 * 1024 * 1024 });
    const lines = stdout.split("\n");

    const results = [];
    let current = null;
    let remaining = 0;
    let finalLine = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line) continue;

      if (!line.startsWith("\t") && /^[0-9a-f]{8,40} /.test(line)) {
        const [sha, , finalLineStr, numLinesStr] = line.split(" ");
        current = {
          sha,
          authorName: null,
          authorEmail: null,
          authorTime: null,
          summary: null,
        };
        finalLine = Number(finalLineStr);
        remaining = Number(numLinesStr);
        continue;
      }

      if (current && !line.startsWith("\t")) {
        const spaceIndex = line.indexOf(" ");
        const key = spaceIndex >= 0 ? line.slice(0, spaceIndex) : line;
        const value = spaceIndex >= 0 ? line.slice(spaceIndex + 1) : "";
        if (key === "author") current.authorName = value;
        if (key === "author-mail") current.authorEmail = value.replace(/^<|>$/g, "");
        if (key === "author-time") current.authorTime = Number(value);
        if (key === "summary") current.summary = value;
        continue;
      }

      if (current && line.startsWith("\t")) {
        const text = line.slice(1);
        results.push({
          file: filePath,
          line: finalLine,
          sha: current.sha,
          authorName: current.authorName,
          authorEmail: current.authorEmail,
          authorTime: current.authorTime,
          summary: current.summary,
          text,
        });
        finalLine += 1;
        remaining -= 1;
        if (results.length >= maxLines) break;
        if (remaining <= 0) {
          current = null;
        }
      }
    }

    return { lines: results, truncated: results.length >= maxLines };
  },
};

