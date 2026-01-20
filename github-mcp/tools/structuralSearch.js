import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

import { resolveRepoPath } from "./pathUtils.js";

function getSgBinaryPath() {
  const __filename = fileURLToPath(import.meta.url);
  const toolsDir = path.dirname(__filename);
  const binName = process.platform === "win32" ? "sg.cmd" : "sg";
  return path.resolve(toolsDir, "..", "node_modules", ".bin", binName);
}

export const structuralSearch = {
  description:
    "Search code structurally using ast-grep (AST pattern matching). Requires a language (e.g. 'ts', 'tsx', 'js').",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      pattern: { type: "string", description: "ast-grep pattern (e.g. 'console.log($A)')" },
      lang: { type: "string", description: "Language id for the pattern (e.g. ts, tsx, js, jsx, py)." },
      globs: {
        type: "array",
        items: { type: "string" },
        description: "Optional ast-grep --globs filters (supports ! exclusions).",
      },
      contextLines: { type: "number", description: "Context lines around each match." },
      maxResults: { type: "number", description: "Maximum number of matches to return." },
      timeoutMs: { type: "number", description: "Timeout for the scan." },
    },
    required: ["pattern", "lang"],
  },
  async run({
    path: repoPath,
    pattern,
    lang,
    globs,
    contextLines = 0,
    maxResults = 200,
    timeoutMs = 30_000,
  } = {}) {
    const root = resolveRepoPath(repoPath);
    const sgPath = getSgBinaryPath();

    const args = [
      "run",
      "--pattern",
      pattern,
      "--lang",
      lang,
      "--json=stream",
      "--heading",
      "never",
      "--context",
      String(Math.max(0, Math.trunc(contextLines))),
      ".",
    ];

    if (globs && globs.length) {
      for (const g of globs) {
        args.splice(args.length - 1, 0, "--globs", g);
      }
    }

    const matches = [];
    const child = spawn(sgPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    let stdoutBuffer = "";
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    const stop = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    };

    const onAbort = () => stop();
    abortController.signal.addEventListener("abort", onAbort, { once: true });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const start = json?.range?.start;
          matches.push({
            file: json?.file ?? null,
            line: Number.isFinite(start?.line) ? start.line + 1 : null,
            column: Number.isFinite(start?.column) ? start.column + 1 : null,
            snippet: json?.lines ?? json?.text ?? null,
            metaVariables: json?.metaVariables ?? null,
          });
        } catch {
          // ignore parse errors
        }

        if (matches.length >= maxResults) {
          stop();
          break;
        }
      }
    });

    const exitCode = await new Promise((resolve) => {
      child.on("close", (code) => resolve(code ?? 0));
      child.on("error", () => resolve(1));
    });

    clearTimeout(timeout);
    abortController.signal.removeEventListener("abort", onAbort);

    if (abortController.signal.aborted) {
      return { matches, truncated: true, error: "Timeout" };
    }
    if (exitCode !== 0 && !matches.length) {
      throw new Error(stderr.trim() || "ast-grep failed.");
    }

    return { matches, truncated: matches.length >= maxResults };
  },
};

