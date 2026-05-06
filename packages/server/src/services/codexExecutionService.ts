import { access, appendFile, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { execFile } from "node:child_process";

import { CodexBridge, type CodexBridgeNotification, type CodexBridgeServerRequest, type JsonRpcId } from "@kletron/codex-bridge";
import type { AgentEvent } from "@kletron/shared/types";
import { agentGraphRunService } from "./agentGraphRunService";
import { findActiveIntegration, getIntegrationCredentials } from "./connectorsService";
import { tryGetGoogleOAuthClientCredentials } from "./googleWorkspaceApi";

export type ExecutionBackend = "langgraph" | "codex";
export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type CodexApprovalDecision = "accept" | "acceptForSession" | "decline";

type CodexApprovalMethod =
  | "item/commandExecution/requestApproval"
  | "item/fileChange/requestApproval"
  | "item/permissions/requestApproval";

type CodexPendingApprovalStatus = "pending" | "approved" | "rejected";

type CodexPendingApproval = {
  id: string;
  runId: string;
  userId: string;
  requestId: JsonRpcId;
  method: CodexApprovalMethod;
  threadId: string;
  turnId: string;
  itemId?: string;
  createdAt: string;
  status: CodexPendingApprovalStatus;
  toolName: string;
  description?: string;
  args: Record<string, unknown>;
};

export type CodexTurnStreamEvent =
  | { kind: "notification"; method: string; params: any }
  | { kind: "approval_pending"; approval: CodexPendingApproval }
  | { kind: "error"; message: string }
  /** Cumulative AgentEvent[] for this turn (copy); drives NDJSON `update` on the chat route. */
  | { kind: "event_snapshot"; events: AgentEvent[] };

export type CodexTurnStreamHandle = {
  threadId: string;
  turnId: string;
  events: AsyncIterable<CodexTurnStreamEvent>;
  completed: Promise<{
    threadId: string;
    turnId: string;
    status: string;
    error?: string | null;
    agentText: string;
    reasoningText: string;
    events: AgentEvent[];
  }>;
};

type ActiveTurn = {
  runId: string;
  userId: string;
  threadId: string;
  turnId: string;
};

type BridgeContext = {
  userId: string;
  codexHome: string;
  binaryPath: string;
  bridge: CodexBridge;
  /** Stable key for Kletron-injected Google MCP credentials (workspace + token fingerprint). */
  injectionKey: string;
  /** Last workspace id used for a Codex turn (respawn after crash with same injection). */
  lastWorkspaceId?: string;
};

type TurnCollector = {
  runId: string;
  threadId: string;
  turnId: string;
  userId: string;
  queue: AsyncQueue<CodexTurnStreamEvent>;
  events: AgentEvent[];
  toolCallByItemId: Map<string, AgentEvent>;
  assistantText: string;
  reasoningText: string;
  resolveCompleted: (value: {
    threadId: string;
    turnId: string;
    status: string;
    error?: string | null;
    agentText: string;
    reasoningText: string;
    events: AgentEvent[];
  }) => void;
  rejectCompleted: (error: Error) => void;
};

const LOG_ROOT = path.join(os.homedir(), ".kletron", "logs");
const APP_LOG_FILE = path.join(LOG_ROOT, "app.log");
const CODEX_EVENTS_LOG_FILE = path.join(LOG_ROOT, "codex-events.jsonl");
const DEFAULT_MODEL_LIMIT = 50;
const MODEL_CACHE_TTL_MS = 60_000;
const SENSITIVE_TOKENS = ["access_token", "refresh_token", "authorization", "cookie", "auth.json"];

class AsyncQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: Array<(value: IteratorResult<T>) => void> = [];
  private closed = false;
  private failure: Error | null = null;

  push(item: T): void {
    if (this.closed) return;
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ done: false, value: item });
      return;
    }
    this.items.push(item);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.({ done: true, value: undefined as never });
    }
  }

  fail(error: Error): void {
    this.failure = error;
    this.close();
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length > 0) {
          const value = this.items.shift()!;
          return Promise.resolve({ done: false, value });
        }
        if (this.failure) {
          return Promise.reject(this.failure);
        }
        if (this.closed) {
          return Promise.resolve({ done: true, value: undefined as never });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.waiters.push(resolve);
        });
      },
    };
  }
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

const KLETRON_GOOGLE_ADC_FILENAME = "kletron-google-adc.json";

/** Avoid leaking the server's own ADC path into the Codex child; Kletron sets its own file per user CODEX_HOME. */
function cloneProcessEnvWithoutInheritedGoogleAdc(): NodeJS.ProcessEnv {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  return env;
}

/**
 * Writes Google user OAuth as ADC-style JSON (`authorized_user`) so MCP stacks using google-auth-library pick up
 * the same refresh token as Kletron Connectors (gmail integration).
 */
async function prepareCodexGoogleInjection(
  workspaceId: string | undefined,
  codexHome: string,
): Promise<{ injectionKey: string; env: NodeJS.ProcessEnv }> {
  const base = cloneProcessEnvWithoutInheritedGoogleAdc();
  const adcPath = path.join(codexHome, KLETRON_GOOGLE_ADC_FILENAME);
  const ws = workspaceId?.trim() ?? "";

  if (!ws) {
    await unlink(adcPath).catch(() => undefined);
    return {
      injectionKey: "none",
      env: base,
    };
  }

  const oauth = tryGetGoogleOAuthClientCredentials();
  const integration = await findActiveIntegration(ws, "gmail");
  if (!oauth || !integration) {
    await unlink(adcPath).catch(() => undefined);
    return {
      injectionKey: `ws:${ws}:no-gmail`,
      env: base,
    };
  }

  const creds = await getIntegrationCredentials(ws, integration.id);
  const refreshToken = typeof creds?.refreshToken === "string" ? creds.refreshToken.trim() : "";
  if (!refreshToken) {
    await unlink(adcPath).catch(() => undefined);
    return {
      injectionKey: `ws:${ws}:no-refresh`,
      env: base,
    };
  }

  const fingerprint = shortHash(`${integration.id}:${refreshToken}`);
  const adcPayload = {
    type: "authorized_user",
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: refreshToken,
  };
  await writeFile(adcPath, `${JSON.stringify(adcPayload)}\n`, { encoding: "utf8", mode: 0o600 });

  const env = { ...base };
  env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

  return {
    injectionKey: `ws:${ws}:${fingerprint}`,
    env,
  };
}

function cloneAgentEventSnapshot(events: AgentEvent[]): AgentEvent[] {
  return structuredClone(events);
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (SENSITIVE_TOKENS.some((token) => lower.includes(token))) return "[REDACTED]";
    return value.replace(/(access_token|refresh_token|authorization|cookie)\s*[:=]\s*([^\s"']+)/gi, "$1=[REDACTED]");
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_TOKENS.some((token) => key.toLowerCase().includes(token))) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = redact(raw, depth + 1);
  }
  return out;
}

function codexSandboxToThreadSandbox(mode: CodexSandboxMode): "read-only" | "workspace-write" | "danger-full-access" {
  if (mode === "workspace-write") return "workspace-write";
  if (mode === "danger-full-access") return "danger-full-access";
  return "read-only";
}

function buildTurnInput(message: string) {
  return [{ type: "text", text: message }];
}

function notificationThreadId(note: CodexBridgeNotification): string | null {
  const params = (note.params ?? {}) as Record<string, unknown>;
  if (typeof params.threadId === "string") return params.threadId;
  const thread = params.thread as Record<string, unknown> | undefined;
  if (thread && typeof thread.id === "string") return thread.id;
  return null;
}

function notificationTurnId(note: CodexBridgeNotification): string | null {
  const params = (note.params ?? {}) as Record<string, unknown>;
  if (typeof params.turnId === "string") return params.turnId;
  const turn = params.turn as Record<string, unknown> | undefined;
  if (turn && typeof turn.id === "string") return turn.id;
  return null;
}

function serializeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function summarizeToolResult(item: Record<string, unknown>): string {
  const type = String(item.type ?? "");
  if (type === "commandExecution") {
    const output = typeof item.aggregatedOutput === "string" ? item.aggregatedOutput : "";
    if (output.trim()) return output;
    const status = String(item.status ?? "unknown");
    const exitCode = item.exitCode == null ? "?" : String(item.exitCode);
    return `Command ${status} (exit: ${exitCode})`;
  }
  if (type === "fileChange") {
    const status = String(item.status ?? "unknown");
    const changes = Array.isArray(item.changes) ? item.changes.length : 0;
    return `File change ${status} (${changes} change${changes === 1 ? "" : "s"})`;
  }
  if (type === "mcpToolCall") {
    const status = String(item.status ?? "unknown");
    const result = (item.result ?? null) as Record<string, unknown> | null;
    if (result && Array.isArray(result.content)) {
      const texts = result.content
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const text = (entry as Record<string, unknown>).text;
          return typeof text === "string" ? text : "";
        })
        .filter(Boolean);
      if (texts.length > 0) return texts.join("\n");
    }
    return `Tool call ${status}`;
  }
  if (type === "dynamicToolCall") {
    const status = String(item.status ?? "unknown");
    return `Dynamic tool call ${status}`;
  }
  return serializeUnknown(item).slice(0, 1_000);
}

function buildUserEvent(message: string): AgentEvent {
  return {
    id: `codex-user-${randomUUID()}`,
    phaseId: "chat",
    phaseLabel: "User message",
    kind: "user",
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  };
}

function buildToolCallEvent(item: Record<string, unknown>): AgentEvent | null {
  const type = String(item.type ?? "");
  const itemId = typeof item.id === "string" ? item.id : randomUUID();
  const now = new Date().toISOString();
  if (type === "commandExecution") {
    return {
      id: `codex-tool-call-${itemId}`,
      phaseId: "tool",
      phaseLabel: "Command execution",
      kind: "assistant",
      role: "assistant",
      toolName: "commandExecution",
      name: "commandExecution",
      toolCallId: itemId,
      toolArgs: serializeUnknown({
        command: item.command,
        cwd: item.cwd,
      }),
      content: "",
      timestamp: now,
    };
  }
  if (type === "fileChange") {
    return {
      id: `codex-tool-call-${itemId}`,
      phaseId: "tool",
      phaseLabel: "File change",
      kind: "assistant",
      role: "assistant",
      toolName: "fileChange",
      name: "fileChange",
      toolCallId: itemId,
      toolArgs: serializeUnknown({
        changes: item.changes,
      }),
      content: "",
      timestamp: now,
    };
  }
  if (type === "mcpToolCall") {
    return {
      id: `codex-tool-call-${itemId}`,
      phaseId: "tool",
      phaseLabel: "MCP tool call",
      kind: "assistant",
      role: "assistant",
      toolName: String(item.tool ?? "mcpToolCall"),
      name: String(item.tool ?? "mcpToolCall"),
      toolCallId: itemId,
      toolArgs: serializeUnknown(item.arguments),
      content: "",
      timestamp: now,
    };
  }
  if (type === "dynamicToolCall") {
    return {
      id: `codex-tool-call-${itemId}`,
      phaseId: "tool",
      phaseLabel: "Dynamic tool call",
      kind: "assistant",
      role: "assistant",
      toolName: String(item.tool ?? "dynamicToolCall"),
      name: String(item.tool ?? "dynamicToolCall"),
      toolCallId: itemId,
      toolArgs: serializeUnknown(item.arguments),
      content: "",
      timestamp: now,
    };
  }
  return null;
}

function buildToolResultEvent(item: Record<string, unknown>): AgentEvent | null {
  const type = String(item.type ?? "");
  if (!["commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall"].includes(type)) return null;
  const itemId = typeof item.id === "string" ? item.id : randomUUID();
  const now = new Date().toISOString();
  return {
    id: `codex-tool-result-${itemId}`,
    phaseId: "tool",
    phaseLabel: "Tool result",
    kind: "tool",
    role: "tool",
    toolName: type,
    toolCallId: itemId,
    content: summarizeToolResult(item),
    timestamp: now,
  };
}

function mapApprovalToolName(method: CodexApprovalMethod): string {
  if (method === "item/commandExecution/requestApproval") return "commandExecution";
  if (method === "item/fileChange/requestApproval") return "fileChange";
  return "permissions";
}

function mapApprovalDescription(method: CodexApprovalMethod, params: Record<string, unknown>): string {
  if (method === "item/commandExecution/requestApproval") {
    const command = typeof params.command === "string" ? params.command : "command";
    return `Approve command: ${command}`;
  }
  if (method === "item/fileChange/requestApproval") {
    const root = typeof params.grantRoot === "string" ? params.grantRoot : "workspace";
    return `Approve file write access: ${root}`;
  }
  const reason = typeof params.reason === "string" ? params.reason : "permission request";
  return `Approve permissions: ${reason}`;
}

async function execFileUtf8(command: string, args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8", windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(typeof stdout === "string" ? stdout : String(stdout ?? ""));
    });
  });
}

/** Resolve `codex` on PATH (full path); never returns a bare command name. */
async function resolveCodexOnSystemPath(): Promise<string | null> {
  try {
    const tool = process.platform === "win32" ? "where" : "which";
    const stdout = await execFileUtf8(tool, ["codex"]);
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!first) return null;
    await access(first, constants.F_OK);
    return first;
  } catch {
    return null;
  }
}

function collectWorkspaceBinCandidates(): string[] {
  const win = process.platform === "win32";
  const names = win ? ["codex.cmd", "codex.ps1", "codex"] : ["codex"];
  const out: string[] = [];
  let dir = path.resolve(process.cwd());
  for (let depth = 0; depth < 14; depth++) {
    for (const name of names) {
      out.push(path.join(dir, "node_modules", ".bin", name));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

async function canExecuteCandidate(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.F_OK);
    if (process.platform !== "win32") {
      await access(candidate, constants.X_OK).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

export class CodexExecutionService {
  private readonly bridgeByUser = new Map<string, BridgeContext>();
  private readonly modelCacheByUser = new Map<string, { at: number; models: unknown }>();
  private readonly pendingApprovalsByRun = new Map<string, Map<string, CodexPendingApproval>>();
  private readonly pendingApprovalsById = new Map<string, CodexPendingApproval>();
  private readonly activeTurnsByRun = new Map<string, ActiveTurn>();
  private readonly collectorsByTurn = new Map<string, TurnCollector>();

  isEnabled(): boolean {
    return process.env.KLETRON_CODEX_BACKEND_DISABLED !== "1";
  }

  async getHealth(userId: string): Promise<{
    enabled: boolean;
    running: boolean;
    binaryPath: string | null;
    codexHome: string | null;
    error?: string;
  }> {
    if (!this.isEnabled()) {
      return { enabled: false, running: false, binaryPath: null, codexHome: null, error: "Codex backend disabled" };
    }
    try {
      const ctx = await this.ensureBridgeForAccount(userId);
      return {
        enabled: true,
        running: ctx.bridge.isRunning,
        binaryPath: ctx.binaryPath,
        codexHome: ctx.codexHome,
      };
    } catch (error) {
      const binaryPath = await this.resolveCodexBinary();
      return {
        enabled: true,
        running: false,
        binaryPath: binaryPath ?? null,
        codexHome: null,
        error: (error as Error)?.message ?? "Codex unavailable",
      };
    }
  }

  async readAccount(userId: string, refreshToken = false): Promise<any> {
    const bridge = await this.ensureBridgeForAccount(userId);
    return await bridge.bridge.call("account/read", { refreshToken });
  }

  async login(userId: string, type: "chatgpt" | "chatgptDeviceCode" | "apiKey", apiKey?: string): Promise<any> {
    const bridge = await this.ensureBridgeForAccount(userId);
    const params: Record<string, unknown> = { type };
    if (type === "apiKey" && apiKey) params.apiKey = apiKey;
    return await bridge.bridge.call("account/login/start", params);
  }

  async logout(userId: string): Promise<any> {
    const bridge = await this.ensureBridgeForAccount(userId);
    return await bridge.bridge.call("account/logout", {});
  }

  async listModels(userId: string): Promise<any> {
    const cached = this.modelCacheByUser.get(userId);
    if (cached && Date.now() - cached.at < MODEL_CACHE_TTL_MS) {
      return cached.models;
    }
    const bridge = await this.ensureBridgeForAccount(userId);
    const models = await bridge.bridge.call("model/list", {
      limit: DEFAULT_MODEL_LIMIT,
      includeHidden: false,
    });
    this.modelCacheByUser.set(userId, { at: Date.now(), models });
    return models;
  }

  async readRateLimits(userId: string): Promise<any> {
    const bridge = await this.ensureBridgeForAccount(userId);
    return await bridge.bridge.call("account/rateLimits/read", {});
  }

  async stopRun(runId: string): Promise<void> {
    const active = this.activeTurnsByRun.get(runId);
    if (!active) return;
    const ctx = await this.ensureBridgeForAccount(active.userId);
    await ctx.bridge.call("turn/interrupt", {
      threadId: active.threadId,
      turnId: active.turnId,
    }).catch(() => undefined);
  }

  listPendingApprovals(runId: string): CodexPendingApproval[] {
    const map = this.pendingApprovalsByRun.get(runId);
    if (!map) return [];
    return Array.from(map.values()).filter((entry) => entry.status === "pending");
  }

  async resolveApproval(runId: string, approvalId: string, decision: CodexApprovalDecision): Promise<boolean> {
    const entry = this.pendingApprovalsById.get(approvalId);
    if (!entry || entry.runId !== runId || entry.status !== "pending") {
      return false;
    }
    const ctx = await this.ensureBridgeForAccount(entry.userId);
    const payload = this.buildApprovalPayload(entry, decision);
    ctx.bridge.respondToServerRequest(entry.requestId, payload);
    entry.status = decision === "decline" ? "rejected" : "approved";
    await this.markApprovalInRunState(entry, decision);
    this.pendingApprovalsById.delete(approvalId);
    const byRun = this.pendingApprovalsByRun.get(runId);
    byRun?.delete(approvalId);
    return true;
  }

  async startTurnStream(options: {
    runId: string;
    userId: string;
    message: string;
    cwd: string;
    model?: string;
    threadId?: string | null;
    sandboxMode?: CodexSandboxMode;
    /** When set, Kletron injects the workspace Gmail integration into the Codex process (GOOGLE_APPLICATION_CREDENTIALS). */
    workspaceId?: string;
  }): Promise<CodexTurnStreamHandle> {
    const ctx = await this.ensureBridgeForTurn(options.userId, options.workspaceId);
    const threadId = await this.ensureThreadId(ctx, options.threadId ?? null, options.cwd, options.model, options.sandboxMode ?? "read-only");
    const userEvent = buildUserEvent(options.message);
    const turnResponse = await ctx.bridge.call<any>("turn/start", {
      threadId,
      input: buildTurnInput(options.message),
      ...(options.model ? { model: options.model } : {}),
    });
    const turnId = String(turnResponse?.turn?.id ?? "");
    if (!turnId) {
      throw new Error("Codex turn/start did not return a turn id");
    }

    const queue = new AsyncQueue<CodexTurnStreamEvent>();
    let resolveCompleted!: (value: {
      threadId: string;
      turnId: string;
      status: string;
      error?: string | null;
      agentText: string;
      reasoningText: string;
      events: AgentEvent[];
    }) => void;
    let rejectCompleted!: (error: Error) => void;
    const completed = new Promise<{
      threadId: string;
      turnId: string;
      status: string;
      error?: string | null;
      agentText: string;
      reasoningText: string;
      events: AgentEvent[];
    }>((resolve, reject) => {
      resolveCompleted = resolve;
      rejectCompleted = reject;
    });
    const collector: TurnCollector = {
      runId: options.runId,
      threadId,
      turnId,
      userId: options.userId,
      queue,
      events: [userEvent],
      toolCallByItemId: new Map<string, AgentEvent>(),
      assistantText: "",
      reasoningText: "",
      resolveCompleted,
      rejectCompleted,
    };
    this.collectorsByTurn.set(turnId, collector);
    this.activeTurnsByRun.set(options.runId, {
      runId: options.runId,
      userId: options.userId,
      threadId,
      turnId,
    });
    queue.push({ kind: "event_snapshot", events: cloneAgentEventSnapshot(collector.events) });
    return {
      threadId,
      turnId,
      events: queue,
      completed,
    };
  }

  private pushEventSnapshot(collector: TurnCollector): void {
    collector.queue.push({ kind: "event_snapshot", events: cloneAgentEventSnapshot(collector.events) });
  }

  async registerRunMetadata(runId: string, metadata: Partial<{
    codexThreadId: string;
    codexTurnId: string;
    codexModel: string;
    codexSandboxMode: CodexSandboxMode;
    executionBackend: ExecutionBackend;
  }>): Promise<void> {
    const run = await agentGraphRunService.getRun(runId);
    if (!run) return;
    await agentGraphRunService.updateRunStatus(runId, run.status, {
      ...(metadata.codexThreadId ? { codexThreadId: metadata.codexThreadId } : {}),
      ...(metadata.codexTurnId ? { codexTurnId: metadata.codexTurnId } : {}),
      ...(metadata.codexModel ? { codexModel: metadata.codexModel } : {}),
      ...(metadata.codexSandboxMode ? { codexSandboxMode: metadata.codexSandboxMode } : {}),
      ...(metadata.executionBackend ? { executionBackend: metadata.executionBackend } : {}),
    } as any);
  }

  /** Used for account/models/approvals: never downgrade an existing bridge that already has Gmail injection. */
  private async ensureBridgeForAccount(userId: string): Promise<BridgeContext> {
    const existing = this.bridgeByUser.get(userId);
    if (existing?.bridge.isRunning) return existing;
    const ws = existing?.lastWorkspaceId;
    return await this.spawnBridge(userId, ws);
  }

  /** Codex execution runs with Kletron connector credentials when `workspaceId` is provided. */
  private async ensureBridgeForTurn(userId: string, workspaceId?: string): Promise<BridgeContext> {
    return await this.spawnBridge(userId, workspaceId);
  }

  private async spawnBridge(userId: string, workspaceId: string | undefined): Promise<BridgeContext> {
    const binaryPath = await this.resolveCodexBinary();
    if (!binaryPath) {
      throw new Error(
        "Codex CLI not found. Install the OpenAI Codex CLI (e.g. npm install -g @openai/codex), ensure `codex` is on your PATH, or set KLETRON_CODEX_BINARY to the full path of the executable.",
      );
    }
    const codexHome = path.join(os.homedir(), ".kletron", "codex", shortHash(userId));
    await mkdir(codexHome, { recursive: true });
    await mkdir(LOG_ROOT, { recursive: true });

    const { injectionKey, env: injectionEnv } = await prepareCodexGoogleInjection(workspaceId, codexHome);
    const existing = this.bridgeByUser.get(userId);
    if (existing?.bridge.isRunning && existing.injectionKey === injectionKey) {
      return existing;
    }

    if (existing) {
      await existing.bridge.stop();
      this.bridgeByUser.delete(userId);
    }

    const childEnv = { ...injectionEnv, CODEX_HOME: codexHome };

    const bridge = new CodexBridge({
      command: binaryPath,
      env: childEnv,
      reconnect: { enabled: true, minDelayMs: 500, maxDelayMs: 10_000 },
      logger: (entry) => {
        void this.writeLocalLogs(entry);
      },
      clientInfo: {
        name: "kletron",
        version: "1.0.0",
      },
    });
    bridge.on("notification", (note) => {
      void this.handleNotification(userId, note as CodexBridgeNotification);
    });
    bridge.on("server_request", (req) => {
      void this.handleServerRequest(userId, req as CodexBridgeServerRequest);
    });
    bridge.on("error", (error) => {
      void this.writeLocalLogs({
        at: new Date().toISOString(),
        level: "error",
        message: "codex_bridge_error",
        data: { userId: shortHash(userId), error: (error as Error)?.message ?? String(error) },
      });
    });
    await bridge.start();

    const ctx: BridgeContext = {
      userId,
      codexHome,
      binaryPath,
      bridge,
      injectionKey,
      lastWorkspaceId: workspaceId?.trim() ? workspaceId.trim() : undefined,
    };
    this.bridgeByUser.set(userId, ctx);
    return ctx;
  }

  private async ensureThreadId(
    ctx: BridgeContext,
    existingThreadId: string | null,
    cwd: string,
    model: string | undefined,
    sandboxMode: CodexSandboxMode,
  ): Promise<string> {
    if (existingThreadId && existingThreadId.trim()) return existingThreadId.trim();
    const startResponse = await ctx.bridge.call<any>("thread/start", {
      cwd,
      ...(model ? { model } : {}),
      sandbox: codexSandboxToThreadSandbox(sandboxMode),
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      ephemeral: false,
    });
    const threadId = String(startResponse?.thread?.id ?? "");
    if (!threadId) throw new Error("Codex thread/start did not return a thread id");
    return threadId;
  }

  private async handleNotification(userId: string, note: CodexBridgeNotification): Promise<void> {
    const method = note.method;
    const threadId = notificationThreadId(note);
    const turnId = notificationTurnId(note);
    if (method === "item/agentMessage/delta" && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (collector) {
        const delta = String((note.params as Record<string, unknown>)?.delta ?? "");
        collector.assistantText += delta;
        collector.queue.push({ kind: "notification", method, params: note.params });
      }
      return;
    }
    if ((method === "item/reasoning/textDelta" || method === "item/reasoning/summaryTextDelta") && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (collector) {
        const delta = String((note.params as Record<string, unknown>)?.delta ?? "");
        collector.reasoningText += delta;
        collector.queue.push({ kind: "notification", method, params: note.params });
      }
      return;
    }

    if ((method === "item/started" || method === "item/completed") && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (!collector) return;
      const item = ((note.params as Record<string, unknown>)?.item ?? null) as Record<string, unknown> | null;
      if (!item) return;

      if (method === "item/started") {
        const callEvent = buildToolCallEvent(item);
        if (callEvent) {
          collector.events.push(callEvent);
          if (callEvent.toolCallId) collector.toolCallByItemId.set(callEvent.toolCallId, callEvent);
        }
      } else {
        const resultEvent = buildToolResultEvent(item);
        if (resultEvent) collector.events.push(resultEvent);
        if (String(item.type ?? "") === "agentMessage" && typeof item.text === "string") {
          collector.assistantText = String(item.text);
        }
      }

      this.pushEventSnapshot(collector);
      collector.queue.push({ kind: "notification", method, params: note.params });
      return;
    }

    if (method === "turn/completed" && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (!collector) return;
      const params = (note.params ?? {}) as Record<string, unknown>;
      const turn = (params.turn ?? {}) as Record<string, unknown>;
      const status = String(turn.status ?? "completed");
      const turnError = (turn.error ?? null) as Record<string, unknown> | null;
      const errorMessage = turnError && typeof turnError.message === "string" ? turnError.message : null;
      if (collector.assistantText.trim()) {
        collector.events.push({
          id: `codex-assistant-${randomUUID()}`,
          phaseId: "chat",
          phaseLabel: "Assistant",
          kind: "assistant",
          role: "assistant",
          content: collector.assistantText,
          ...(collector.reasoningText.trim() ? { thinking: collector.reasoningText } : {}),
          timestamp: new Date().toISOString(),
        });
      }

      this.pushEventSnapshot(collector);
      collector.queue.push({ kind: "notification", method, params: note.params });
      collector.queue.close();
      this.collectorsByTurn.delete(turnId);
      this.activeTurnsByRun.delete(collector.runId);
      collector.resolveCompleted({
        threadId: collector.threadId,
        turnId: collector.turnId,
        status,
        error: errorMessage,
        agentText: collector.assistantText,
        reasoningText: collector.reasoningText,
        events: collector.events,
      });
      return;
    }

    if (method === "error" && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (!collector) return;
      const params = (note.params ?? {}) as Record<string, unknown>;
      const message = typeof params.message === "string" ? params.message : "Codex error";
      collector.queue.push({ kind: "error", message });
      collector.queue.fail(new Error(message));
      this.collectorsByTurn.delete(turnId);
      this.activeTurnsByRun.delete(collector.runId);
      collector.rejectCompleted(new Error(message));
      return;
    }

    if (threadId && turnId) {
      const collector = this.collectorsByTurn.get(turnId);
      if (collector) {
        collector.queue.push({ kind: "notification", method, params: note.params });
      }
    }

    await this.writeCodexEventLog("notification", {
      userId: shortHash(userId),
      method,
      params: redact(note.params),
    });
  }

  private async handleServerRequest(userId: string, req: CodexBridgeServerRequest): Promise<void> {
    const method = req.method as CodexApprovalMethod | string;
    if (
      method !== "item/commandExecution/requestApproval" &&
      method !== "item/fileChange/requestApproval" &&
      method !== "item/permissions/requestApproval"
    ) {
      const turnId = typeof (req.params as Record<string, unknown>)?.turnId === "string"
        ? String((req.params as Record<string, unknown>).turnId)
        : null;
      if (turnId) {
        const collector = this.collectorsByTurn.get(turnId);
        if (collector) {
          collector.queue.push({ kind: "notification", method, params: req.params });
        }
      }
      return;
    }
    const params = (req.params ?? {}) as Record<string, unknown>;
    const threadId = String(params.threadId ?? "");
    const turnId = String(params.turnId ?? "");
    if (!threadId || !turnId) {
      const ctx = this.bridgeByUser.get(userId);
      ctx?.bridge.respondToServerRequest(req.id, { decision: "decline" });
      return;
    }
    const collector = this.collectorsByTurn.get(turnId);
    if (!collector) {
      const ctx = this.bridgeByUser.get(userId);
      ctx?.bridge.respondToServerRequest(req.id, { decision: "decline" });
      return;
    }

    const approvalId = `codex-approval-${randomUUID()}`;
    const approval: CodexPendingApproval = {
      id: approvalId,
      runId: collector.runId,
      userId,
      requestId: req.id,
      method,
      threadId,
      turnId,
      itemId: typeof params.itemId === "string" ? params.itemId : undefined,
      createdAt: new Date().toISOString(),
      status: "pending",
      toolName: mapApprovalToolName(method),
      description: mapApprovalDescription(method, params),
      args: {
        ...params,
        codexRequestId: req.id,
      },
    };

    let byRun = this.pendingApprovalsByRun.get(collector.runId);
    if (!byRun) {
      byRun = new Map<string, CodexPendingApproval>();
      this.pendingApprovalsByRun.set(collector.runId, byRun);
    }
    byRun.set(approval.id, approval);
    this.pendingApprovalsById.set(approval.id, approval);
    await this.addApprovalToRunState(approval);
    collector.queue.push({ kind: "approval_pending", approval });
  }

  private buildApprovalPayload(entry: CodexPendingApproval, decision: CodexApprovalDecision): unknown {
    if (entry.method === "item/permissions/requestApproval") {
      if (decision === "decline") {
        return {
          permissions: {
            fileSystem: {
              entries: [],
            },
            network: {
              enabled: false,
            },
          },
          scope: "turn",
        };
      }
      const requested = (entry.args.permissions ?? {}) as Record<string, unknown>;
      return {
        permissions: requested,
        scope: decision === "acceptForSession" ? "session" : "turn",
      };
    }
    return {
      decision: decision === "decline" ? "decline" : decision,
    };
  }

  private async addApprovalToRunState(approval: CodexPendingApproval): Promise<void> {
    const run = await agentGraphRunService.getRun(approval.runId);
    if (!run) return;
    const state = (run.state ?? { nodes: {} }) as any;
    const approvals = state.approvals ?? { pending: [], granted: [], rejected: [] };
    const pending = Array.isArray(approvals.pending) ? approvals.pending : [];
    pending.push({
      id: approval.id,
      toolName: approval.toolName,
      args: approval.args,
      status: "pending",
      createdAt: approval.createdAt,
      description: approval.description,
    });
    state.approvals = {
      pending,
      granted: Array.isArray(approvals.granted) ? approvals.granted : [],
      rejected: Array.isArray(approvals.rejected) ? approvals.rejected : [],
    };
    await agentGraphRunService.updateRunStatus(approval.runId, run.status, {
      state,
      codexApprovalState: {
        hasPending: pending.length > 0,
        pendingCount: pending.length,
        updatedAt: new Date().toISOString(),
      },
    } as any);
  }

  private async markApprovalInRunState(approval: CodexPendingApproval, decision: CodexApprovalDecision): Promise<void> {
    const run = await agentGraphRunService.getRun(approval.runId);
    if (!run) return;
    const state = (run.state ?? { nodes: {} }) as any;
    const approvals = state.approvals ?? { pending: [], granted: [], rejected: [] };
    const pending = Array.isArray(approvals.pending)
      ? approvals.pending.filter((item: any) => String(item?.id ?? "") !== approval.id)
      : [];
    const granted = Array.isArray(approvals.granted) ? approvals.granted : [];
    const rejected = Array.isArray(approvals.rejected) ? approvals.rejected : [];
    if (decision === "decline") {
      rejected.push({
        id: approval.id,
        toolName: approval.toolName,
        args: approval.args,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
      });
    } else {
      granted.push({
        id: approval.id,
        toolName: approval.toolName,
        args: approval.args,
        status: "approved",
        approvedAt: new Date().toISOString(),
        decision,
      });
    }
    state.approvals = { pending, granted, rejected };
    await agentGraphRunService.updateRunStatus(approval.runId, run.status, {
      state,
      codexApprovalState: {
        hasPending: pending.length > 0,
        pendingCount: pending.length,
        updatedAt: new Date().toISOString(),
      },
    } as any);
  }

  private async resolveCodexBinary(): Promise<string | null> {
    const fromEnv = process.env.KLETRON_CODEX_BINARY?.trim();
    if (fromEnv) {
      const resolved = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
      if (await canExecuteCandidate(resolved)) return resolved;
      return null;
    }

    for (const candidate of collectWorkspaceBinCandidates()) {
      if (await canExecuteCandidate(candidate)) return candidate;
    }

    return await resolveCodexOnSystemPath();
  }

  private async writeLocalLogs(entry: { at: string; level: string; message: string; data?: unknown }): Promise<void> {
    const line = `${entry.at} [${entry.level}] ${entry.message} ${entry.data ? serializeUnknown(redact(entry.data)) : ""}\n`;
    await appendFile(APP_LOG_FILE, line, "utf8").catch(() => undefined);
  }

  private async writeCodexEventLog(type: string, payload: Record<string, unknown>): Promise<void> {
    const redactedPayload = redact(payload);
    const safePayload =
      redactedPayload && typeof redactedPayload === "object" && !Array.isArray(redactedPayload)
        ? (redactedPayload as Record<string, unknown>)
        : { value: redactedPayload };
    const line = `${JSON.stringify({
      at: new Date().toISOString(),
      type,
      ...safePayload,
    })}\n`;
    await appendFile(CODEX_EVENTS_LOG_FILE, line, "utf8").catch(() => undefined);
  }
}

export const codexExecutionService = new CodexExecutionService();
