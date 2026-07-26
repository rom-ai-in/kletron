import { execFile } from "child_process";
import { promisify } from "util";
import { resolveRepoPath } from "./pathUtils.js";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT = 100_000; // 100KB max capture
const DEFAULT_TIMEOUT = 120_000; // 120s default
const MAX_TIMEOUT = 300_000; // 5min hard cap

/**
 * Environment handed to the child shell.
 *
 * The parent process holds every credential the deployment is configured with
 * (LLM API keys, Mongo URI, NextAuth and MCP secrets, connector tokens). This
 * used to be forwarded wholesale, so a single `env` disclosed all of them to
 * whatever the agent was told to run. Only variables a build or test needs are
 * passed through now.
 */
const ENV_ALLOWLIST = new Set([
  // Shell / locale basics
  "PATH", "HOME", "USER", "LOGNAME", "SHELL", "PWD", "OLDPWD",
  "LANG", "LANGUAGE", "TZ", "TMPDIR", "TEMP", "TMP", "TERM", "COLORTERM",
  // Toolchain roots — needed for builds and test runners to resolve binaries
  "NODE_ENV", "CI",
  "JAVA_HOME", "GOPATH", "GOROOT", "GOCACHE",
  "CARGO_HOME", "RUSTUP_HOME", "NVM_DIR", "PYENV_ROOT",
  "VIRTUAL_ENV", "CONDA_PREFIX", "ANDROID_HOME",
  "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME",
  "SSL_CERT_FILE", "SSL_CERT_DIR",
]);

/** Locale variables (LC_ALL, LC_TIME, …) are safe and numerous — matched by prefix. */
const ENV_ALLOWED_PREFIXES = ["LC_"];

/**
 * Escape hatch for deployments whose builds need extra variables:
 * MCP_BASH_ENV_ALLOWLIST="FOO,BAR". Opt-in and explicit by design.
 */
function extraAllowedNames() {
  const raw = process.env.MCP_BASH_ENV_ALLOWLIST;
  if (!raw) return [];
  return raw.split(",").map((name) => name.trim()).filter(Boolean);
}

export function buildChildEnv(parentEnv = process.env) {
  const allowed = new Set([...ENV_ALLOWLIST, ...extraAllowedNames()]);
  const env = {};
  for (const [key, value] of Object.entries(parentEnv)) {
    if (value === undefined) continue;
    if (allowed.has(key) || ENV_ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      env[key] = value;
    }
  }
  // Keep tool output free of ANSI escapes regardless of the parent's TERM.
  env.TERM = "dumb";
  return env;
}

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
          env: buildChildEnv(),
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
