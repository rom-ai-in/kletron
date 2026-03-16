import { execFile } from "child_process";
import { promisify } from "util";
import { resolveRepoPath } from "./pathUtils.js";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT = 100_000; // 100KB max capture
const DEFAULT_TIMEOUT = 120_000; // 120s default
const MAX_TIMEOUT = 300_000; // 5min hard cap

export const executeBash = {
  description:
    "Execute a bash command in the workspace directory. Captures stdout/stderr with timeout. Use for running tests, builds, linters, and shell operations that other tools cannot perform.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The bash command to run.",
      },
      path: {
        type: "string",
        description: "Working directory (defaults to repo root).",
      },
      timeoutMs: {
        type: "number",
        description:
          "Timeout in ms (default: 120000, max: 300000).",
      },
    },
    required: ["command"],
  },
  async run({ command, path: repoPath, timeoutMs } = {}) {
    const cwd = resolveRepoPath(repoPath);
    const timeout = Math.min(
      Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT),
      MAX_TIMEOUT
    );

    try {
      const { stdout, stderr } = await execFileAsync(
        "/bin/bash",
        ["-c", command],
        {
          cwd,
          timeout,
          maxBuffer: MAX_OUTPUT,
          env: { ...process.env, TERM: "dumb" },
        }
      );

      const combined = [
        stdout ? stdout.trimEnd() : "",
        stderr ? `\n[stderr]\n${stderr.trimEnd()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        ok: true,
        exitCode: 0,
        output: combined.slice(0, MAX_OUTPUT),
        truncated: combined.length > MAX_OUTPUT,
      };
    } catch (err) {
      const exitCode =
        err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
          ? null
          : (err.exitCode ?? err.code ?? 1);
      const stdout = err.stdout ? err.stdout.trimEnd() : "";
      const stderr = err.stderr ? err.stderr.trimEnd() : "";
      const combined = [
        stdout,
        stderr ? `\n[stderr]\n${stderr}` : "",
        err.killed ? "\n[killed: timeout exceeded]" : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        ok: false,
        exitCode,
        output: combined.slice(0, MAX_OUTPUT),
        truncated: combined.length > MAX_OUTPUT,
        killed: !!err.killed,
      };
    }
  },
};
