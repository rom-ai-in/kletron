import { access, appendFile, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { execFile } from "node:child_process";

import { CodexBridge, type CodexBridgeNotification, type CodexBridgeServerRequest, type JsonRpcId } from "@kletron/codex-bridge";
import type { AgentEvent } from "@kletron/shared/types";
import { issueLocalMcpToken } from "../lib/codexLocalMcpAuth";
import { agentGraphRunService } from "./agentGraphRunService";
import { findActiveIntegration, getIntegrationCredentials } from "./connectorsService";
import {
  debugLogGoogleAccessTokenScopes,
  GMAIL_HOSTED_MCP_URL,
  gmailAccessTokenCanListMailbox,
  probeGoogleHostedGmailMcpSearchThreads,
  probeGoogleHostedGmailMcpToolsList,
  probeKletronLocalMcpToolsList,
  resolveGoogleHostedGmailMcpBearer,
  tryGetGoogleOAuthClientCredentials,
} from "./googleWorkspaceApi";

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
  method: string;
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

/** Codex child or SQLite state may reset (e.g. bridge respawn); persisted `codexThreadId` then becomes invalid. */
function isCodexThreadStaleError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("thread not found") || m.includes("unknown thread");
}

const KLETRON_GOOGLE_ADC_FILENAME = "kletron-google-adc.json";
/** Full `Authorization` header value for Codex MCP HTTP (`env_http_headers`); avoids flaky `bearer_token_env_var` path in some Codex builds. */
const KLETRON_GOOGLE_AUTHORIZATION_ENV = "KLETRON_GOOGLE_AUTHORIZATION";
/** Full `Authorization` header for Kletron’s local workspace MCP route (`/api/mcp/workspace/[id]`). */
const KLETRON_LOCAL_MCP_AUTH_ENV = "KLETRON_LOCAL_MCP_AUTH";
/** Bump when synced Codex `[mcp_servers.*]` Kletron blocks change so the Codex process restarts and reloads MCP. */
const KLETRON_CODEX_GMAIL_MCP_CONFIG_VERSION = 5;

const KLETRON_CODEX_TOML_MARK_BEGIN = "# BEGIN KLETRON SYNC";
const KLETRON_CODEX_TOML_MARK_END = "# END KLETRON SYNC";

/** Same inner names as Codex `config.toml` table headers (inside `[...]`). */
const CODEX_TOML_GMAIL_PLUGIN_HEADER = `plugins."gmail@openai-curated"`;
/** Single segment after `mcp_servers.` avoids some strict-TOML parsers choking on duplicate dotted paths. */
const CODEX_TOML_KLETRON_GMAIL_MCP_HEADER = "mcp_servers.kletron_gmail_kletron";
/** REST-backed Gmail/Calendar/Drive MCP exposed by this Next.js app (no Google hosted preview). */
const CODEX_TOML_KLETRON_WORKSPACE_MCP_HEADER = "mcp_servers.kletron_workspace";
const CODEX_TOML_LEGACY_KLETRON_GMAIL_MCP_HEADER = "mcp_servers.kletron-gmail-google-remote";
/** Codex ChatGPT Apps connector; tools are namespaced `mcp__codex_apps__gmail` — separate OAuth from Kletron Gmail. */
const CODEX_TOML_APPS_GMAIL_HEADER = "apps.gmail";

/** Strip one `[headerInner]` table block (standard tables only — lines until next top-level `[`). */
function stripTomlTableSection(content: string, headerInner: string): string {
  const headerLine = `[${headerInner}]`;
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let skip = false;
  for (const line of lines) {
    const t = line.trim();
    if (!skip && t === headerLine) {
      skip = true;
      continue;
    }
    if (skip) {
      if (t.startsWith("[") && t.endsWith("]")) {
        skip = false;
        if (t !== headerLine) out.push(line);
      }
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function stripAllTomlTableSections(content: string, headerInner: string): string {
  let prev = "";
  let out = content;
  while (prev !== out) {
    prev = out;
    out = stripTomlTableSection(out, headerInner);
  }
  return out;
}

/**
 * Keep the **last** occurrence of each top-level `[table]` header (TOML forbids duplicate headers).
 * Lines before the first `[` are treated as preamble and kept once at the top.
 */
function dedupeTomlTopLevelTableBlocks(content: string): string {
  const lines = content.split(/\r?\n/);
  type Block = { header: string; lines: string[] };
  const blocks: Block[] = [];
  let preamble: string[] = [];
  let curHeader: string | null = null;
  let curLines: string[] = [];

  const flush = () => {
    if (curHeader !== null) {
      blocks.push({ header: curHeader, lines: curLines });
      curHeader = null;
      curLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^\[(.+)\]\s*$/);
    if (m && trimmed.startsWith("[") && !trimmed.includes("#")) {
      flush();
      curHeader = m[1];
      curLines = [line];
    } else if (curHeader !== null) {
      curLines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  const seen = new Set<string>();
  const kept: Block[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (seen.has(b.header)) continue;
    seen.add(b.header);
    kept.unshift(b);
  }

  const out: string[] = [];
  while (preamble.length && !(preamble[preamble.length - 1] ?? "").trim()) {
    preamble.pop();
  }
  out.push(...preamble);
  if (out.length && kept.length && (out[out.length - 1] ?? "").trim()) {
    out.push("");
  }
  for (let i = 0; i < kept.length; i++) {
    if (i > 0 && (out[out.length - 1] ?? "").trim()) out.push("");
    out.push(...kept[i].lines);
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/** Avoid leaking the server's own ADC path into the Codex child; Kletron sets its own file per user CODEX_HOME. */
function cloneProcessEnvWithoutInheritedGoogleAdc(): NodeJS.ProcessEnv {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  delete env.KLETRON_GOOGLE_ACCESS_TOKEN;
  delete env[KLETRON_GOOGLE_AUTHORIZATION_ENV];
  delete env[KLETRON_LOCAL_MCP_AUTH_ENV];
  return env;
}

function mergeMarkedTomlSection(existing: string, blockBody: string): string {
  const pattern = new RegExp(
    `${KLETRON_CODEX_TOML_MARK_BEGIN}[\\s\\S]*?${KLETRON_CODEX_TOML_MARK_END}\\n?`,
    "m",
  );
  const trimmed = existing.replace(/\s+$/, "");
  if (!blockBody.trim()) {
    const stripped = trimmed.replace(pattern, "").replace(/\s+$/, "");
    return stripped ? `${stripped}\n` : "";
  }
  const insertion = `${KLETRON_CODEX_TOML_MARK_BEGIN}\n${blockBody.trim()}\n${KLETRON_CODEX_TOML_MARK_END}\n`;
  if (pattern.test(trimmed)) {
    return `${trimmed.replace(pattern, insertion).replace(/\s+$/, "")}\n`;
  }
  return trimmed ? `${trimmed}\n\n${insertion}` : insertion;
}

type KletronCodexGoogleMcpSyncMode = "none" | "hosted" | "local";

/**
 * OpenAI curated `gmail@openai-curated` uses ChatGPT app connectors — it ignores Kletron tokens.
 * Default: register Kletron’s **local** workspace MCP (`[mcp_servers.kletron_workspace]`) backed by REST tools.
 * Opt-in (`KLETRON_CODEX_USE_HOSTED_GMAIL_MCP=1`): Google’s hosted Gmail MCP preview instead.
 *
 * Set `KLETRON_CODEX_KEEP_APPS_MCP=1` on the server to skip disabling Apps MCP flags / cache clear if you need other Codex ChatGPT Apps connectors.
 */
async function syncKletronCodexConfigToml(
  codexHome: string,
  sync: { mode: KletronCodexGoogleMcpSyncMode; workspaceId: string },
): Promise<void> {
  const configPath = path.join(codexHome, "config.toml");
  let existing = "";
  try {
    existing = await readFile(configPath, "utf8");
  } catch {
    existing = "";
  }

  let blockBody = "";
  if (sync.mode === "hosted") {
    const lines = [
      `# Gmail: use Kletron workspace connector OAuth (Authorization via ${KLETRON_GOOGLE_AUTHORIZATION_ENV}).`,
      `# Disable OpenAI connector Gmail — it uses separate ChatGPT credentials and causes ACCESS_TOKEN_SCOPE_INSUFFICIENT.`,
      `[plugins."gmail@openai-curated"]`,
      `enabled = false`,
      ``,
      `# Codex Apps Gmail (tool prefix mcp__codex_apps__gmail) uses ChatGPT OAuth — conflicts with Kletron bearer.`,
      `[apps.gmail]`,
      `enabled = false`,
      ``,
      `[mcp_servers.kletron_gmail_kletron]`,
      `url = "${GMAIL_HOSTED_MCP_URL}"`,
      `# Prefer env_http_headers over bearer_token_env_var: probe proves token OK while Codex still failed with bearer_token_env_var-only.`,
      `env_http_headers = { Authorization = "${KLETRON_GOOGLE_AUTHORIZATION_ENV}" }`,
      `startup_timeout_sec = 45`,
      `enabled = true`,
    ];
    if (process.env.KLETRON_CODEX_KEEP_APPS_MCP !== "1") {
      lines.push(
        ``,
        `# Disable ChatGPT Apps (mcp__codex_apps__* incl. gmail_search_emails — ChatGPT OAuth, not Kletron tokens).`,
        `# Need both: enable_mcp_apps alone left Gmail Apps tools registered per codex_apps_tools cache.`,
        `[features]`,
        `apps = false`,
        `enable_mcp_apps = false`,
      );
    }
    blockBody = lines.join("\n");
  } else if (sync.mode === "local") {
    const base = (process.env.KLETRON_LOCAL_MCP_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
    const wid = sync.workspaceId.trim();
    const lines = [
      `# Local Kletron MCP — Gmail/Calendar/Drive REST in-process (no Workspace Developer Preview required).`,
      `[plugins."gmail@openai-curated"]`,
      `enabled = false`,
      ``,
      `# Codex Apps Gmail (ChatGPT OAuth) conflicts with Kletron workspace tools.`,
      `[apps.gmail]`,
      `enabled = false`,
      ``,
      `[${CODEX_TOML_KLETRON_WORKSPACE_MCP_HEADER}]`,
      `url = "${base}/api/mcp/workspace/${wid}"`,
      `env_http_headers = { Authorization = "${KLETRON_LOCAL_MCP_AUTH_ENV}" }`,
      `startup_timeout_sec = 30`,
      `enabled = true`,
    ];
    if (process.env.KLETRON_CODEX_KEEP_APPS_MCP !== "1") {
      lines.push(
        ``,
        `[features]`,
        `apps = false`,
        `enable_mcp_apps = false`,
      );
    }
    blockBody = lines.join("\n");
  }

  // Remove old Kletron block, then strip tables we (re)declare — avoids TOML "duplicate key" if the user
  // already had `[plugins."gmail@openai-curated"]` above our synced section.
  let working = mergeMarkedTomlSection(existing, "").replace(/\s+$/, "");
  working = stripAllTomlTableSections(working, CODEX_TOML_LEGACY_KLETRON_GMAIL_MCP_HEADER);
  working = stripAllTomlTableSections(working, CODEX_TOML_KLETRON_GMAIL_MCP_HEADER);
  working = stripAllTomlTableSections(working, CODEX_TOML_KLETRON_WORKSPACE_MCP_HEADER);
  if (sync.mode === "hosted" || sync.mode === "local") {
    working = stripAllTomlTableSections(working, CODEX_TOML_GMAIL_PLUGIN_HEADER);
    working = stripAllTomlTableSections(working, CODEX_TOML_APPS_GMAIL_HEADER);
  }

  const merged = mergeMarkedTomlSection(working, blockBody).replace(/\n{3,}/g, "\n\n").trimEnd();
  const next = merged ? dedupeTomlTopLevelTableBlocks(merged).trimEnd() : "";
  const normalizedOut = next ? `${next}\n` : "";
  const normalizedExisting = existing.replace(/\s+$/, "");
  if (normalizedOut.replace(/\r\n/g, "\n") === `${normalizedExisting}\n`) return;
  await writeFile(configPath, normalizedOut, { encoding: "utf8", mode: 0o600 });
}

/**
 * Writes Google user OAuth as ADC-style JSON (`authorized_user`) for tooling that uses google-auth-library,
 * configures Codex MCP: **local** Kletron workspace MCP by default, or Google hosted Gmail MCP when
 * `KLETRON_CODEX_USE_HOSTED_GMAIL_MCP=1` and a mailbox-capable bearer is available.
 */
async function prepareCodexGoogleInjection(
  userId: string,
  workspaceId: string | undefined,
  codexHome: string,
): Promise<{ injectionKey: string; env: NodeJS.ProcessEnv; injectKletronGmailRemote: boolean }> {
  const base = cloneProcessEnvWithoutInheritedGoogleAdc();
  const adcPath = path.join(codexHome, KLETRON_GOOGLE_ADC_FILENAME);
  const ws = workspaceId?.trim() ?? "";

  const syncNone = async () => {
    await syncKletronCodexConfigToml(codexHome, { mode: "none", workspaceId: ws });
  };

  if (!ws) {
    await unlink(adcPath).catch(() => undefined);
    await syncNone();
    return {
      injectionKey: "none",
      env: base,
      injectKletronGmailRemote: false,
    };
  }

  const oauth = tryGetGoogleOAuthClientCredentials();
  const integration = await findActiveIntegration(ws, "gmail");
  if (!oauth || !integration) {
    await unlink(adcPath).catch(() => undefined);
    await syncNone();
    return {
      injectionKey: `ws:${ws}:no-gmail`,
      env: base,
      injectKletronGmailRemote: false,
    };
  }

  const creds = await getIntegrationCredentials(ws, integration.id);
  const credRecord = (creds ?? {}) as Record<string, string>;
  const refreshToken = typeof credRecord.refreshToken === "string" ? credRecord.refreshToken.trim() : "";
  const accessStored = typeof credRecord.accessToken === "string" ? credRecord.accessToken.trim() : "";

  if (!refreshToken && !accessStored) {
    await unlink(adcPath).catch(() => undefined);
    await syncNone();
    return {
      injectionKey: `ws:${ws}:no-google-tokens`,
      env: base,
      injectKletronGmailRemote: false,
    };
  }

  const fingerprint = shortHash(`${integration.id}:${refreshToken}:${accessStored.slice(0, 24)}`);

  const env = { ...base };
  env.KLETRON_CODEX_WORKSPACE_ID = ws;
  if (refreshToken) {
    const adcPayload = {
      type: "authorized_user",
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: refreshToken,
    };
    await writeFile(adcPath, `${JSON.stringify(adcPayload)}\n`, { encoding: "utf8", mode: 0o600 });
    env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  } else {
    await unlink(adcPath).catch(() => undefined);
  }

  const useHosted =
    process.env.KLETRON_CODEX_USE_HOSTED_GMAIL_MCP === "1";

  /** Hosted Gmail MCP only — skip token refresh + Gmail probes when using local Kletron MCP (default). */
  let mailboxBearer: string | null = null;
  if (useHosted) {
    try {
      mailboxBearer = await resolveGoogleHostedGmailMcpBearer(credRecord);
      if (mailboxBearer) {
        env.KLETRON_GOOGLE_ACCESS_TOKEN = mailboxBearer;
        env[KLETRON_GOOGLE_AUTHORIZATION_ENV] = `Bearer ${mailboxBearer}`;
        await debugLogGoogleAccessTokenScopes(
          `codex-gmail-mcp workspaceId=${ws} integration=${String(integration.id).slice(0, 8)}…`,
          mailboxBearer,
        );
      } else {
        console.warn(
          "[codexExecutionService] Gmail: no bearer with Gmail API scopes (check merged refresh token / reconnect Gmail).",
        );
      }
    } catch (error) {
      console.warn(
        "[codexExecutionService] Gmail access token resolution failed:",
        (error as Error)?.message ?? error,
      );
    }
  }

  /** Google hosted `gmailmcp.googleapis.com` (Workspace Developer Preview). */
  const injectHosted = Boolean(useHosted && mailboxBearer);
  /** Kletron Next.js `/api/mcp/workspace/*` using the same REST tools as LangGraph. */
  const injectLocal = !injectHosted;

  if (injectLocal) {
    env[KLETRON_LOCAL_MCP_AUTH_ENV] = `Bearer ${issueLocalMcpToken({
      userId,
      workspaceId: ws,
      ttlSec: 6 * 3600,
    })}`;
  }

  // Hosted Gmail MCP + explicit bearer: drop ADC so MCP stack does not mint a different access token.
  if (injectHosted && env.KLETRON_GOOGLE_ACCESS_TOKEN) {
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  await syncKletronCodexConfigToml(codexHome, {
    mode: injectHosted ? "hosted" : injectLocal ? "local" : "none",
    workspaceId: ws,
  });

  if ((injectHosted || injectLocal) && process.env.KLETRON_CODEX_KEEP_APPS_MCP !== "1") {
    await rm(path.join(codexHome, "cache", "codex_apps_tools"), { recursive: true, force: true }).catch(
      () => undefined,
    );
  }

  // Diagnostics: hosted vs local MCP endpoint Codex will use.
  if (injectHosted && typeof mailboxBearer === "string" && mailboxBearer.length > 0) {
    const labelsProbeOk = await gmailAccessTokenCanListMailbox(mailboxBearer);
    const mcpProbe = await probeGoogleHostedGmailMcpToolsList(mailboxBearer);
    const stProbe = await probeGoogleHostedGmailMcpSearchThreads(mailboxBearer);
    const mcpCallFailed = !stProbe.ok;
    const previewMismatchLikely =
      labelsProbeOk &&
      mcpCallFailed &&
      (stProbe.bodyHasPermissionDenied || stProbe.mcpToolResultIsError);
    if (labelsProbeOk && mcpCallFailed) {
      console.warn(
        `[codexExecutionService] Hosted Gmail MCP probe failed (tools/list ok=${String(mcpProbe.ok)} tools/call search_threads ok=${String(stProbe.ok)} jsonRpcError=${String(stProbe.jsonRpcError)} http=${stProbe.status}).`,
      );
    }
    if (previewMismatchLikely) {
      console.warn(
        "[codexExecutionService] Hosted Gmail MCP may require Workspace Developer Preview enrollment — https://developers.google.com/workspace/preview — Consider unsetting KLETRON_CODEX_USE_HOSTED_GMAIL_MCP to use Kletron local MCP instead.",
      );
    }
  } else if (injectLocal) {
    const baseUrl = (process.env.KLETRON_LOCAL_MCP_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
    const localUrl = `${baseUrl}/api/mcp/workspace/${encodeURIComponent(ws)}`;
    const authHdr = env[KLETRON_LOCAL_MCP_AUTH_ENV];
    // Do not block Codex spawn on a self-HTTP probe; Codex will hit the same URL immediately after.
    void probeKletronLocalMcpToolsList(localUrl, typeof authHdr === "string" ? authHdr : "").then((probe) => {
      if (!probe.ok) {
        console.warn(
          `[codexExecutionService] Kletron local MCP tools/list probe failed (http=${probe.status}). Is the web app reachable at ${baseUrl}?`,
        );
      }
    });
  }

  return {
    injectionKey: `ws:${ws}:${fingerprint}:mcpv${KLETRON_CODEX_GMAIL_MCP_CONFIG_VERSION}`,
    env,
    injectKletronGmailRemote: injectHosted,
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

function pickTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function notificationThreadId(note: CodexBridgeNotification): string | null {
  const params = (note.params ?? {}) as Record<string, unknown>;
  const fromRoot = pickTrimmedString(params.threadId);
  if (fromRoot) return fromRoot;
  const thread = params.thread as Record<string, unknown> | undefined;
  const fromThread = pickTrimmedString(thread?.id);
  if (fromThread) return fromThread;
  const item = params.item as Record<string, unknown> | undefined;
  if (item) {
    const fromItem = pickTrimmedString(item.threadId);
    if (fromItem) return fromItem;
    const itemThread = item.thread as Record<string, unknown> | undefined;
    const fromItemThread = pickTrimmedString(itemThread?.id);
    if (fromItemThread) return fromItemThread;
  }
  return null;
}

/** Codex sometimes omits top-level turnId on item/completed; also check nested item.turn / item.turnId. */
function notificationTurnId(note: CodexBridgeNotification): string | null {
  const params = (note.params ?? {}) as Record<string, unknown>;
  const fromRoot = pickTrimmedString(params.turnId);
  if (fromRoot) return fromRoot;
  const turn = params.turn as Record<string, unknown> | undefined;
  const fromTurn = pickTrimmedString(turn?.id);
  if (fromTurn) return fromTurn;
  const item = params.item as Record<string, unknown> | undefined;
  if (item) {
    const fromItem = pickTrimmedString(item.turnId);
    if (fromItem) return fromItem;
    const itemTurn = item.turn as Record<string, unknown> | undefined;
    const fromItemTurn = pickTrimmedString(itemTurn?.id);
    if (fromItemTurn) return fromItemTurn;
  }
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

function hashEnvToken(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "no-token";
  return shortHash(value);
}

function computeEffectiveInjectionKey(
  injectionKey: string,
  injectKletronGmailRemote: boolean,
  hostedBearer: unknown,
): string {
  if (!injectKletronGmailRemote) return injectionKey;
  return `${injectionKey}:hostedBearer:${hashEnvToken(hostedBearer)}`;
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
  const resolvedToolName =
    type === "mcpToolCall" || type === "dynamicToolCall"
      ? String(item.tool ?? type)
      : type;
  return {
    id: `codex-tool-result-${itemId}`,
    phaseId: "tool",
    phaseLabel: "Tool result",
    kind: "tool",
    role: "tool",
    toolName: resolvedToolName,
    toolCallId: itemId,
    content: summarizeToolResult(item),
    timestamp: now,
  };
}

function mapApprovalToolName(method: string): string {
  if (method === "execCommandApproval") return "commandExecution";
  if (method === "applyPatchApproval") return "fileChange";
  if (method.includes("commandExecution")) return "commandExecution";
  if (method.includes("fileChange")) return "fileChange";
  if (method.includes("permissions")) return "permissions";
  return "permissions";
}

function mapApprovalDescription(method: string, params: Record<string, unknown>): string {
  if (method === "execCommandApproval") {
    const cmd = Array.isArray(params.command)
      ? (params.command as unknown[]).filter((v): v is string => typeof v === "string").join(" ")
      : "";
    return `Approve command: ${cmd || "command"}`;
  }
  if (method === "applyPatchApproval") {
    const root = typeof params.grantRoot === "string" ? params.grantRoot : "workspace";
    return `Approve file write access: ${root}`;
  }
  if (method.includes("commandExecution")) {
    const command = typeof params.command === "string" ? params.command : "command";
    return `Approve command: ${command}`;
  }
  if (method.includes("fileChange")) {
    const root = typeof params.grantRoot === "string" ? params.grantRoot : "workspace";
    return `Approve file write access: ${root}`;
  }
  if (method.includes("permissions")) {
    const reason = typeof params.reason === "string" ? params.reason : "permission request";
    return `Approve permissions: ${reason}`;
  }
  const reason = typeof params.reason === "string" ? params.reason : "permission request";
  return `Approve permissions: ${reason}`;
}

function isApprovalRequestMethod(method: string): boolean {
  if (method === "applyPatchApproval" || method === "execCommandApproval") return true;
  return method.endsWith("/requestApproval") || method.includes("requestApproval");
}

function isMcpElicitationRequestMethod(method: string): boolean {
  return method === "mcpServer/elicitation/request" || method === "elicitation/create";
}

function isPermissionsApprovalMethod(method: string, params: Record<string, unknown>): boolean {
  if (method.includes("permissions")) return true;
  const perms = params.permissions;
  return typeof perms === "object" && perms !== null;
}

function buildApprovalPayloadForMethodPure(
  method: string,
  params: Record<string, unknown>,
  decision: CodexApprovalDecision,
): unknown {
  if (method === "applyPatchApproval" || method === "execCommandApproval") {
    return {
      decision: decision === "decline" ? "denied" : decision === "acceptForSession" ? "approved_for_session" : "approved",
    };
  }
  if (isPermissionsApprovalMethod(method, params)) {
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
    const requested = (params.permissions ?? {}) as Record<string, unknown>;
    return {
      permissions: requested,
      scope: decision === "acceptForSession" ? "session" : "turn",
    };
  }
  return {
    decision: decision === "decline" ? "decline" : decision,
  };
}

function enumPrimitiveValues(values: unknown): Array<string | number | boolean> {
  if (!Array.isArray(values)) return [];
  return values.filter((v): v is string | number | boolean =>
    typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
}

function chooseEnumValue(
  key: string,
  values: Array<string | number | boolean>,
): string | number | boolean | null {
  if (values.length === 0) return null;
  const lowered = values.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
  const findPreferred = (candidates: string[]) => {
    for (const candidate of candidates) {
      const idx = lowered.findIndex((v) => typeof v === "string" && v === candidate);
      if (idx >= 0) return values[idx]!;
    }
    return null;
  };
  const k = key.toLowerCase();
  if (k.includes("decision") || k.includes("action")) {
    return findPreferred(["accept", "approve", "allow", "yes"]) ?? values[0]!;
  }
  if (k.includes("persist") || k.includes("scope")) {
    return findPreferred(["session", "always", "turn"]) ?? values[0]!;
  }
  return values[0]!;
}

function defaultPrimitiveForSchema(
  key: string,
  schema: Record<string, unknown>,
): string | number | boolean {
  const enumVals = enumPrimitiveValues(schema.enum);
  const fromEnum = chooseEnumValue(key, enumVals);
  if (fromEnum !== null) return fromEnum;

  const t = typeof schema.type === "string" ? schema.type : "";
  if (t === "boolean") return true;
  if (t === "number" || t === "integer") {
    const min = typeof schema.minimum === "number" ? schema.minimum : 0;
    return Number.isFinite(min) ? min : 0;
  }
  if (key.toLowerCase().includes("decision") || key.toLowerCase().includes("action")) return "accept";
  if (key.toLowerCase().includes("persist") || key.toLowerCase().includes("scope")) return "session";
  return "yes";
}

function buildMcpElicitationAcceptContent(params: Record<string, unknown>): Record<string, unknown> {
  const schema = (params.requestedSchema ?? null) as Record<string, unknown> | null;
  if (!schema || schema.type !== "object") return {};
  const props = (schema.properties ?? null) as Record<string, unknown> | null;
  if (!props || typeof props !== "object") return {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  const out: Record<string, unknown> = {};
  const requiredKeys = required.length > 0 ? required : Object.keys(props);
  for (const key of requiredKeys) {
    const rawDef = props[key];
    if (!rawDef || typeof rawDef !== "object" || Array.isArray(rawDef)) continue;
    out[key] = defaultPrimitiveForSchema(key, rawDef as Record<string, unknown>);
  }

  const meta = (params.meta ?? null) as Record<string, unknown> | null;
  const approvalKind = typeof meta?.codex_approval_kind === "string" ? meta.codex_approval_kind : "";
  if (approvalKind === "mcp_tool_call") {
    if (typeof out.decision !== "string") out.decision = "accept";
    if (out.persist == null) {
      const persist = meta?.persist;
      if (typeof persist === "string") out.persist = persist;
      if (Array.isArray(persist)) {
        const s = persist.find((v) => typeof v === "string");
        if (typeof s === "string") out.persist = s;
      }
    }
  }
  return out;
}

function buildMcpElicitationResult(params: Record<string, unknown>): Record<string, unknown> {
  const mode = typeof params.mode === "string" ? params.mode : "";
  if (mode === "form") {
    return {
      action: "accept",
      content: buildMcpElicitationAcceptContent(params),
      _meta: null,
    };
  }
  if (mode === "url") {
    // Headless backend cannot complete browser URL elicitation safely.
    return {
      action: "decline",
      content: null,
      _meta: null,
    };
  }
  return {
    action: "cancel",
    content: null,
    _meta: null,
  };
}

function buildToolRequestUserInputAutoResponse(params: Record<string, unknown>): Record<string, unknown> {
  const questions = Array.isArray(params.questions) ? (params.questions as unknown[]) : [];
  const answers: Record<string, { answers: string[] }> = {};
  for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    const question = q as Record<string, unknown>;
    const id = typeof question.id === "string" ? question.id.trim() : "";
    if (!id) continue;
    const options = Array.isArray(question.options) ? (question.options as unknown[]) : [];
    const firstLabel = options
      .map((opt) => (opt && typeof opt === "object" ? (opt as Record<string, unknown>).label : null))
      .find((label): label is string => typeof label === "string" && label.trim().length > 0);
    answers[id] = { answers: [firstLabel ?? "No preference"] };
  }
  return { answers };
}

function buildUnsupportedDynamicToolCallResponse(params: Record<string, unknown>): Record<string, unknown> {
  const tool = typeof params.tool === "string" ? params.tool : "dynamicTool";
  return {
    success: false,
    contentItems: [
      {
        type: "inputText",
        text: `Dynamic tool call not supported by bridge client: ${tool}`,
      },
    ],
  };
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
    /** When set, Kletron injects the workspace Gmail integration (`KLETRON_GOOGLE_AUTHORIZATION` + raw token for probes; ADC file may be written but is omitted from env when bearer is set). */
    workspaceId?: string;
  }): Promise<CodexTurnStreamHandle> {
    const ctx = await this.ensureBridgeForTurn(options.userId, options.workspaceId);
    const sandboxMode = options.sandboxMode ?? "read-only";
    let threadId = await this.ensureThreadId(ctx, options.threadId ?? null, options.cwd, options.model, sandboxMode);

    let turnResponse: any;
    try {
      turnResponse = await ctx.bridge.call<any>("turn/start", {
        threadId,
        input: buildTurnInput(options.message),
        ...(options.model ? { model: options.model } : {}),
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      if (options.threadId?.trim() && isCodexThreadStaleError(msg)) {
        console.warn(
          `[codexExecutionService] turn/start stale thread ${String(options.threadId).slice(0, 12)}… (${msg.slice(0, 120)}) — creating a new Codex thread.`,
        );
        threadId = await this.ensureThreadId(ctx, null, options.cwd, options.model, sandboxMode);
        turnResponse = await ctx.bridge.call<any>("turn/start", {
          threadId,
          input: buildTurnInput(options.message),
          ...(options.model ? { model: options.model } : {}),
        });
      } else {
        throw err;
      }
    }

    const userEvent = buildUserEvent(options.message);
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

  /**
   * Resolve stream collector when Codex omits turnId on some notifications (notably item/completed).
   * Falls back to the sole active collector for the same Codex threadId.
   */
  private resolveCollectorForCodexTurn(turnId: string | null, threadId: string | null): TurnCollector | null {
    if (turnId) {
      const direct = this.collectorsByTurn.get(turnId);
      if (direct) return direct;
    }
    if (!threadId) return null;
    const matches = [...this.collectorsByTurn.values()].filter((c) => c.threadId === threadId);
    if (matches.length === 1) return matches[0]!;
    return null;
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
    const patch: Record<string, unknown> = {};
    const tid = pickTrimmedString(metadata.codexThreadId ?? null);
    const tur = pickTrimmedString(metadata.codexTurnId ?? null);
    if (tid) patch.codexThreadId = tid;
    if (tur) patch.codexTurnId = tur;
    const cm = pickTrimmedString(metadata.codexModel ?? null);
    if (cm) patch.codexModel = cm;
    if (metadata.codexSandboxMode) patch.codexSandboxMode = metadata.codexSandboxMode;
    if (metadata.executionBackend) patch.executionBackend = metadata.executionBackend;
    await agentGraphRunService.updateRunStatus(runId, run.status, patch as any);
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

    const { injectionKey, env: injectionEnv, injectKletronGmailRemote } = await prepareCodexGoogleInjection(
      userId,
      workspaceId,
      codexHome,
    );
    const effectiveInjectionKey = computeEffectiveInjectionKey(
      injectionKey,
      injectKletronGmailRemote,
      injectionEnv.KLETRON_GOOGLE_ACCESS_TOKEN,
    );
    const existing = this.bridgeByUser.get(userId);
    const reusingExisting = Boolean(existing?.bridge.isRunning && existing.injectionKey === effectiveInjectionKey);
    console.log("[codexExecutionService] Gmail MCP injection", {
      injectionKey,
      effectiveInjectionKey,
      injectKletronGmailRemote,
      hasHostedBearer: typeof injectionEnv.KLETRON_GOOGLE_ACCESS_TOKEN === "string" && injectionEnv.KLETRON_GOOGLE_ACCESS_TOKEN.length > 0,
      reusingExisting,
    });
    if (reusingExisting && existing) {
      return existing;
    }

    if (existing) {
      await existing.bridge.stop();
      this.bridgeByUser.delete(userId);
    }

    const childEnv = { ...injectionEnv, CODEX_HOME: codexHome };

    const bridge = new CodexBridge({
      command: binaryPath,
      // Isolate config discovery: Codex merges project `.codex/config.toml` layers from cwd→git root;
      // defaulting cwd to the server repo could pull extra MCP/plugins. CODEX_HOME already holds our config.toml.
      cwd: codexHome,
      env: childEnv as NodeJS.ProcessEnv,
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
      injectionKey: effectiveInjectionKey,
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
    const needsInteractiveApprovals = sandboxMode !== "read-only";
    const startResponse = await ctx.bridge.call<any>("thread/start", {
      cwd,
      ...(model ? { model } : {}),
      sandbox: codexSandboxToThreadSandbox(sandboxMode),
      approvalPolicy: needsInteractiveApprovals ? "on-request" : "never",
      ...(needsInteractiveApprovals ? { approvalsReviewer: "user" } : {}),
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

    if (method === "item/started" || method === "item/completed") {
      const collector = this.resolveCollectorForCodexTurn(turnId, threadId);
      const item = ((note.params as Record<string, unknown>)?.item ?? null) as Record<string, unknown> | null;
      if (!collector || !item) {
        return;
      }

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

    if (method === "turn/completed") {
      const collector = this.resolveCollectorForCodexTurn(turnId, threadId);
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
      const mapKey = collector.turnId;
      this.collectorsByTurn.delete(mapKey);
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

    if (method === "error") {
      const collector = this.resolveCollectorForCodexTurn(turnId, threadId);
      if (!collector) return;
      const params = (note.params ?? {}) as Record<string, unknown>;
      const message = typeof params.message === "string" ? params.message : "Codex error";
      collector.queue.push({ kind: "error", message });
      // Do not queue.fail + rejectCompleted: fail() rejects the async iterator while rejectCompleted()
      // rejects `completed` — if the for-await loop exits on iterator rejection first, nobody awaits
      // `completed` and Node reports an unhandled rejection. Mirror turn/completed instead.
      collector.queue.close();
      this.collectorsByTurn.delete(collector.turnId);
      this.activeTurnsByRun.delete(collector.runId);
      collector.resolveCompleted({
        threadId: collector.threadId,
        turnId: collector.turnId,
        status: "failed",
        error: message,
        agentText: collector.assistantText,
        reasoningText: collector.reasoningText,
        events: collector.events,
      });
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
    const method = req.method as string;
    const params = (req.params ?? {}) as Record<string, unknown>;
    console.warn(
      `[codexExecutionService] server request method=${method} turnId=${String(params.turnId ?? "none")} threadId=${String(params.threadId ?? "none")}`,
    );

    if (isMcpElicitationRequestMethod(method)) {
      const ctx = this.bridgeByUser.get(userId);
      if (!ctx) return;
      const result = buildMcpElicitationResult(params);
      ctx.bridge.respondToServerRequest(req.id, result);
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      if (turnId) {
        const collector = this.collectorsByTurn.get(turnId);
        if (collector) {
          collector.queue.push({ kind: "notification", method, params: req.params });
        }
      }
      await this.writeCodexEventLog("server_request", {
        userId: shortHash(userId),
        method,
        params: redact(params),
        resolvedWith: redact(result),
      });
      return;
    }

    if (method === "item/tool/requestUserInput") {
      const ctx = this.bridgeByUser.get(userId);
      if (!ctx) return;
      const result = buildToolRequestUserInputAutoResponse(params);
      ctx.bridge.respondToServerRequest(req.id, result);
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      if (turnId) {
        const collector = this.collectorsByTurn.get(turnId);
        if (collector) {
          collector.queue.push({ kind: "notification", method, params: req.params });
        }
      }
      await this.writeCodexEventLog("server_request", {
        userId: shortHash(userId),
        method,
        params: redact(params),
        resolvedWith: redact(result),
      });
      return;
    }

    if (method === "item/tool/call") {
      const ctx = this.bridgeByUser.get(userId);
      if (!ctx) return;
      const result = buildUnsupportedDynamicToolCallResponse(params);
      ctx.bridge.respondToServerRequest(req.id, result);
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      if (turnId) {
        const collector = this.collectorsByTurn.get(turnId);
        if (collector) {
          collector.queue.push({ kind: "notification", method, params: req.params });
        }
      }
      await this.writeCodexEventLog("server_request", {
        userId: shortHash(userId),
        method,
        params: redact(params),
        resolvedWith: redact(result),
      });
      return;
    }

    if (!isApprovalRequestMethod(method)) {
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      if (turnId) {
        const collector = this.collectorsByTurn.get(turnId);
        if (collector) {
          collector.queue.push({ kind: "notification", method, params: req.params });
        }
      }
      const ctx = this.bridgeByUser.get(userId);
      ctx?.bridge.respondToServerRequestError(req.id, {
        code: -32601,
        message: `Unhandled server request method: ${method}`,
      });
      await this.writeCodexEventLog("server_request_unhandled", {
        userId: shortHash(userId),
        method,
        params: redact(params),
      });
      return;
    }

    console.warn(
      `[codexExecutionService] approval request method=${method} turnId=${String(params.turnId ?? "none")} threadId=${String(params.threadId ?? "none")}`,
    );
    const threadId = String(params.threadId ?? "");
    const turnId = String(params.turnId ?? "");
    if (!threadId || !turnId) {
      const ctx = this.bridgeByUser.get(userId);
      ctx?.bridge.respondToServerRequest(
        req.id,
        this.buildApprovalPayloadForMethod(method, params, "decline"),
      );
      return;
    }
    const collector = this.collectorsByTurn.get(turnId);
    if (!collector) {
      const ctx = this.bridgeByUser.get(userId);
      ctx?.bridge.respondToServerRequest(
        req.id,
        this.buildApprovalPayloadForMethod(method, params, "decline"),
      );
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
    return this.buildApprovalPayloadForMethod(entry.method, entry.args, decision);
  }

  private buildApprovalPayloadForMethod(
    method: string,
    params: Record<string, unknown>,
    decision: CodexApprovalDecision,
  ): unknown {
    return buildApprovalPayloadForMethodPure(method, params, decision);
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

export const __codexExecutionServiceTestables = {
  hashEnvToken,
  computeEffectiveInjectionKey,
  isApprovalRequestMethod,
  mapApprovalToolName,
  mapApprovalDescription,
  buildMcpElicitationAcceptContent,
  buildMcpElicitationResult,
  buildToolRequestUserInputAutoResponse,
  buildUnsupportedDynamicToolCallResponse,
  buildApprovalPayloadForMethodPure,
};
