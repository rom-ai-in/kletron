import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

export type JsonRpcId = string | number;

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
};

export type CodexBridgeLogEntry = {
  at: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: unknown;
};

export type CodexBridgeOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  reconnect?: {
    enabled?: boolean;
    minDelayMs?: number;
    maxDelayMs?: number;
  };
  logger?: (entry: CodexBridgeLogEntry) => void;
  clientInfo?: {
    name: string;
    version: string;
  };
};

export type CodexBridgeServerRequest = JsonRpcRequest;
export type CodexBridgeNotification = JsonRpcNotification;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RECONNECT_MIN_MS = 500;
const DEFAULT_RECONNECT_MAX_MS = 10_000;

const SENSITIVE_KEYWORDS = [
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "auth.json",
];

function redactString(input: string): string {
  if (!input) return input;
  let output = input;
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (output.toLowerCase().includes(keyword)) {
      return "[REDACTED]";
    }
  }
  output = output.replace(/(access_token|refresh_token|authorization|cookie)\s*[:=]\s*([^\s"']+)/gi, "$1=[REDACTED]");
  return output;
}

function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[REDACTED_DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redactUnknown(entry, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = String(rawKey);
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = redactUnknown(rawValue, depth + 1);
  }
  return out;
}

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export class CodexBridge extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextRequestId = 1;
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest>();
  private readonly options: CodexBridgeOptions;
  private started = false;
  private stopping = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = DEFAULT_RECONNECT_MIN_MS;

  constructor(options: CodexBridgeOptions) {
    super();
    this.options = options;
    this.reconnectDelayMs = options.reconnect?.minDelayMs ?? DEFAULT_RECONNECT_MIN_MS;
  }

  get isRunning(): boolean {
    return Boolean(this.process && !this.process.killed);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.stopping = false;
    await this.spawnProcess();
    await this.initializeHandshake();
    this.started = true;
    this.log("info", "Codex bridge started", {
      command: this.options.command,
      args: this.options.args ?? [],
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.started = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new Error("Codex bridge stopped"));
    const child = this.process;
    this.process = null;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const finalize = () => resolve();
      child.once("exit", finalize);
      try {
        child.kill("SIGTERM");
      } catch {
        finalize();
      }
      setTimeout(() => {
        if (!child.killed) {
          try {
            child.kill("SIGKILL");
          } catch {
            // noop
          }
        }
      }, 1_000).unref();
    });
  }

  async call<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
    if (!this.process || !this.isRunning) {
      throw new Error("Codex bridge is not running");
    }
    const id = this.nextRequestId++;
    const message: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };
    this.writeMessage(message);
    const timeout = timeoutMs ?? this.options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Codex request timeout for method ${method}`));
      }, timeout);
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout: timer });
    });
  }

  sendNotification(method: string, params?: unknown): void {
    const message: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      ...(params === undefined ? {} : { params }),
    };
    this.writeMessage(message);
  }

  respondToServerRequest(id: JsonRpcId, result: unknown): void {
    const message: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };
    this.writeMessage(message);
  }

  respondToServerRequestError(id: JsonRpcId, error: JsonRpcError): void {
    const message: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error,
    };
    this.writeMessage(message);
  }

  private async spawnProcess(): Promise<void> {
    await this.cleanupProcess();
    const child = spawn(this.options.command, ["app-server", "--listen", "stdio://", ...(this.options.args ?? [])], {
      cwd: this.options.cwd,
      env: this.options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = child;

    const stdoutReader = readline.createInterface({ input: child.stdout });
    stdoutReader.on("line", (line) => {
      void this.handleStdoutLine(line);
    });

    child.stderr.on("data", (chunk) => {
      this.log("warn", "Codex stderr", { chunk: redactString(String(chunk)) });
    });
    child.on("error", (error) => {
      this.log("error", "Codex process error", { error: (error as Error).message });
      this.rejectAllPending(asError(error, "Codex process error"));
      this.emit("error", error);
    });
    child.on("exit", (code, signal) => {
      this.log("warn", "Codex process exited", { code, signal, stopping: this.stopping });
      this.process = null;
      this.rejectAllPending(new Error(`Codex process exited (${code ?? "null"}/${signal ?? "null"})`));
      this.emit("exit", { code, signal, stopping: this.stopping });
      if (!this.stopping && this.options.reconnect?.enabled !== false) {
        this.scheduleReconnect();
      }
    });
  }

  private async initializeHandshake(): Promise<void> {
    const clientInfo = this.options.clientInfo ?? { name: "kletron-codex-bridge", version: "0.1.0" };
    await this.call("initialize", {
      clientInfo,
    });
    this.sendNotification("initialized");
  }

  private async handleStdoutLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      this.log("warn", "Ignoring non-JSON stdout line", { line: redactString(trimmed.slice(0, 500)) });
      return;
    }
    const msg = parsed as Record<string, unknown>;
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      this.handleResponse(msg as JsonRpcResponse);
      return;
    }
    if (msg.id !== undefined && typeof msg.method === "string") {
      this.emit("server_request", msg as CodexBridgeServerRequest);
      return;
    }
    if (typeof msg.method === "string") {
      this.emit("notification", msg as CodexBridgeNotification);
      return;
    }
    this.log("debug", "Unknown JSON-RPC payload", { payload: redactUnknown(msg) });
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);
    if (response.error) {
      const err = new Error(response.error.message || "Codex request failed");
      (err as Error & { code?: number; data?: unknown }).code = response.error.code;
      (err as Error & { code?: number; data?: unknown }).data = response.error.data;
      pending.reject(err);
      return;
    }
    pending.resolve(response.result);
  }

  private writeMessage(message: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse): void {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error("Codex bridge stdin is not writable");
    }
    const serialized = JSON.stringify(message);
    this.log("debug", "→ codex", redactUnknown(message));
    this.process.stdin.write(`${serialized}\n`);
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const maxDelay = this.options.reconnect?.maxDelayMs ?? DEFAULT_RECONNECT_MAX_MS;
    const delay = Math.min(this.reconnectDelayMs, maxDelay);
    this.log("info", "Scheduling codex reconnect", { delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start().then(() => {
        this.reconnectDelayMs = this.options.reconnect?.minDelayMs ?? DEFAULT_RECONNECT_MIN_MS;
      }).catch((error) => {
        this.log("error", "Codex reconnect failed", { error: (error as Error).message });
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, maxDelay);
        this.scheduleReconnect();
      });
    }, delay);
    this.reconnectTimer.unref();
  }

  private async cleanupProcess(): Promise<void> {
    if (!this.process) return;
    const child = this.process;
    this.process = null;
    try {
      child.kill("SIGTERM");
    } catch {
      // noop
    }
  }

  private log(level: CodexBridgeLogEntry["level"], message: string, data?: unknown): void {
    const logger = this.options.logger;
    if (!logger) return;
    logger({
      at: new Date().toISOString(),
      level,
      message,
      ...(data === undefined ? {} : { data: redactUnknown(data) }),
    });
  }
}
