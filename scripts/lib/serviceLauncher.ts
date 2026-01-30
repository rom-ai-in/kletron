import "dotenv/config";

import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import { execFile, spawn, ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const execFileAsync = promisify(execFile);

// Path to the config.json file
const CONFIG_FILE = path.resolve(process.cwd(), "config", "config.json");

function getConfiguredRepoRoot(): string | undefined {
  // 1. First, try to read from config.json (UI-configured path)
  try {
    if (fsSync.existsSync(CONFIG_FILE)) {
      const raw = fsSync.readFileSync(CONFIG_FILE, "utf-8");
      const json = JSON.parse(raw);
      if (json.mcpDefaultDir && typeof json.mcpDefaultDir === "string" && json.mcpDefaultDir.trim()) {
        return path.resolve(json.mcpDefaultDir.trim());
      }
    }
  } catch (e) {
    // Ignore errors, fall through to env vars
  }

  // 2. Fall back to environment variables (for backwards compatibility during startup)
  const configuredRaw =
    process.env.GITHUB_MCP_DEFAULT_DIR ?? process.env.MCP_DEFAULT_DIR;
  const configured = configuredRaw?.trim();
  return configured ? path.resolve(configured) : undefined;
}

export function resolveTargetRepoRoot(): string {
  const resolved = getConfiguredRepoRoot();
  if (!resolved) {
    throw new Error(
      "Repository path not configured. Please configure it in the UI at Configuration > Repository Settings, or set GITHUB_MCP_DEFAULT_DIR in .env"
    );
  }
  return resolved;
}

export async function requireTargetRepoRoot() {
  const resolved = getConfiguredRepoRoot();
  if (!resolved) {
    throw new Error(
      "GITHUB_MCP_DEFAULT_DIR is not set. Add it to `.env` to point to your target repo (e.g. /Users/you/Desktop/numezis-1)."
    );
  }

  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(
      `GITHUB_MCP_DEFAULT_DIR points to a missing/non-directory path: ${resolved}`
    );
  }

  return resolved;
}

export type ServiceLaunchConfig = {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  stdio?: "inherit" | "pipe";
};

export async function freePort(port: number) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-ti", `:${port}`]);
    const pids = stdout
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!pids.length) {
      console.log(`✅ Port ${port} already free.`);
      return;
    }

    console.log(
      `🧹 Killing ${pids.length} process(es) holding port ${port}: ${pids.join(", ")}`
    );
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch (error) {
        console.warn(`⚠️ Failed to kill PID ${pid}: ${error}`);
      }
    }
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const code = err.code;
    const stdout = typeof err.stdout === "string" ? err.stdout.trim() : "";
    const stderr = typeof err.stderr === "string" ? err.stderr.trim() : "";
    if (String(code) === "1" || (!stdout && !stderr)) {
      console.log(`✅ No process found on port ${port}.`);
      return;
    }
    if (err.code === "ENOENT") {
      console.warn(`⚠️ Unable to free port ${port}: 'lsof' is not installed.`);
      return;
    }
    throw err;
  }
}

export async function ensurePortsFree(ports: number[]) {
  for (const port of ports) {
    await freePort(port);
  }
}

export async function waitForHttpOk(url: string, options?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const intervalMs = options?.intervalMs ?? 250;
  const startedAt = Date.now();

  while (true) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await delay(intervalMs);
  }
}

export function spawnService(config: ServiceLaunchConfig): ChildProcess {
  console.log(`🚀 Starting ${config.name}: ${config.command} ${config.args.join(" ")}`);
  const child =
    config.stdio === "pipe"
      ? spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ["ignore", "pipe", "pipe"],
      })
      : spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: "inherit",
      });

  child.on("exit", (code, signal) => {
    console.log(
      `⚠️ ${config.name} exited (code=${code ?? "n/a"}, signal=${signal ?? "n/a"}).`
    );
  });

  child.on("error", (error) => {
    console.error(`❌ ${config.name} error:`, error);
  });

  if (config.stdio === "pipe" && child.stdout && child.stderr) {
    let emittedLink = false;
    const maybeEmitLink = (chunk: string) => {
      if (emittedLink) return;
      const match = chunk.match(/https?:\/\/[^\s)"]+/);
      if (match?.[0]) {
        const url = match[0];
        // Only emit Studio links (avoid spamming localhost API URLs).
        const looksLikeStudio =
          url.includes("smith.langchain.com/studio") || url.includes("/studio?baseUrl=");
        if (!looksLikeStudio) return;
        emittedLink = true;
        console.log(`🔗 LangSmith Studio: ${url}`);
      }
    };

    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      maybeEmitLink(text);
    });
    child.stderr.on("data", (buf) => {
      const text = buf.toString();
      process.stderr.write(text);
      maybeEmitLink(text);
    });
  }

  return child;
}

export function createMcpLauncher(rootDir: string, overrides: Record<string, string> = {}) {
  const mcpCommand = process.platform === "win32" ? "node.exe" : "node";
  const mcpArgs = [path.join("mcp-server", "server.js"), "--mcp"];
  return spawnService({
    name: "MCP Server",
    command: mcpCommand,
    args: mcpArgs,
    env: {
      ...overrides,
      MCP_TRANSPORT: overrides.MCP_TRANSPORT ?? "sse",
      GITHUB_MCP_TRANSPORT: overrides.GITHUB_MCP_TRANSPORT ?? "sse",
      MCP_DEFAULT_DIR: rootDir,
      GITHUB_MCP_DEFAULT_DIR: rootDir,
    },
  });
}

export type LangGraphLauncherOptions = {
  overrides?: Record<string, string>;
  watch?: boolean;
};

export function createLangGraphLauncher(options: LangGraphLauncherOptions = {}) {
  const { overrides = {}, watch = false } = options;
  const langGraphCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const langGraphArgs = watch
    ? ["tsx", "watch", "src/index.ts"]
    : ["tsx", "src/index.ts"];
  return spawnService({
    name: "LangGraph Agent",
    command: langGraphCommand,
    args: langGraphArgs,
    env: {
      ...overrides,
    },
  });
}

export function createWebLauncher(port: number = 3000) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnService({
    name: "Next.js UI",
    command,
    args: ["run", "dev:web"],
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: "pipe",
  });
}

export function createI18nProcessWorkerLauncher(options?: { watch?: boolean }) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const watch = options?.watch ?? false;
  return spawnService({
    name: "I18n Process Worker",
    command,
    args: watch ? ["tsx", "watch", "scripts/i18n-process-worker.ts"] : ["tsx", "scripts/i18n-process-worker.ts"],
    stdio: "pipe",
  });
}

export function createLangGraphDevServer(options: {
  port: number;
  configPath?: string;
  studioUrl?: string;
  extraArgs?: string[];
  env?: Record<string, string>;
}) {
  const cliCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = [
    "@langchain/langgraph-cli",
    "dev",
    "--port",
    String(options.port),
    "--no-browser",
  ];
  if (options.configPath) {
    args.push("--config", options.configPath);
  }
  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return spawnService({
    name: "LangGraph Dev Server",
    command: cliCommand,
    args,
    env: options.env ?? {},
    stdio: "pipe",
  });
}


export function createDriftAnalysisWorkerLauncher(options?: { watch?: boolean }) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const watch = options?.watch ?? false;
  return spawnService({
    name: "Drift Analysis Worker",
    command,
    args: watch ? ["tsx", "watch", "scripts/drift-analysis-worker.ts"] : ["tsx", "scripts/drift-analysis-worker.ts"],
    stdio: "pipe",
  });
}

export function createTerminalWorkerLauncher(options?: { watch?: boolean }) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const watch = options?.watch ?? false;
  return spawnService({
    name: "Terminal Worker",
    command,
    args: watch ? ["tsx", "watch", "scripts/terminal-worker.ts"] : ["tsx", "scripts/terminal-worker.ts"],
    stdio: "pipe",
  });
}
