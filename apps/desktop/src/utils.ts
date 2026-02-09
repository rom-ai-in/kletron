// Shared utility functions for the Numezis Desktop application

import { structuredPatch } from "diff";
import type { DiffHunk, DiffRow, PreviewLine } from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

export const AUTH_STORAGE_KEY = "numezis.desktop.auth";
export const BACKEND_STORAGE_KEY = "numezis.desktop.backendUrl";
export const WORKSPACE_STORAGE_KEY = "numezis.desktop.workspace";
export const AUTH_LOGIN_TIMEOUT_MS = 6 * 60 * 1000;
export const MAX_TOOL_PAYLOAD_CHARS = 8000;
export const MAX_TOOL_PREVIEW_CHARS = 160;

export const DEFAULT_BACKEND_URL = "https://app.numezis.com";
export const DEV_BACKEND_URL = "http://localhost:3000";

export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "configuration", label: "Configuration" },
  { id: "personalization", label: "Personalization" },
  { id: "mcp", label: "MCP servers" },
  { id: "skills", label: "Skills" },
  { id: "automations", label: "Automations" },
  { id: "graphs", label: "Agent Graphs" },
  { id: "environments", label: "Environments" },
  { id: "worktrees", label: "Worktrees" },
  { id: "archived", label: "Archived threads" },
] as const;

// ─── URL Helpers ─────────────────────────────────────────────────────────────

export function getDefaultBackendUrl(): string {
  try {
    const env = (import.meta as any)?.env;
    if (env?.VITE_BACKEND_URL && typeof env.VITE_BACKEND_URL === "string") {
      return env.VITE_BACKEND_URL;
    }
    if (env?.DEV) return DEV_BACKEND_URL;
  } catch {
    // ignore env parsing issues
  }
  return DEFAULT_BACKEND_URL;
}

export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  const isLocal =
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("0.0.0.0") ||
    trimmed.startsWith("[::1]");
  const hasPort = /:\d+/.test(trimmed);
  const scheme = isLocal || hasPort ? "http://" : "https://";
  return `${scheme}${trimmed}`;
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

// ─── Content Helpers ─────────────────────────────────────────────────────────

export function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

export function truncatePayload(value: string): string {
  if (value.length <= MAX_TOOL_PAYLOAD_CHARS) return value;
  return `${value.slice(0, MAX_TOOL_PAYLOAD_CHARS)}\n… (truncated)`;
}

export function formatMaybeJson(value?: string): string {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return truncatePayload(JSON.stringify(parsed, null, 2));
  } catch {
    return truncatePayload(value);
  }
}

export function formatToolPreview(value?: string): string {
  if (!value) return "";
  const formatted = formatMaybeJson(value)
    .replace(/\s+/g, " ")
    .trim();
  if (!formatted) return "";
  if (formatted.length <= MAX_TOOL_PREVIEW_CHARS) return formatted;
  return `${formatted.slice(0, MAX_TOOL_PREVIEW_CHARS)}…`;
}

// ─── Diff Helpers ────────────────────────────────────────────────────────────

export function buildHunks(editId: string, filePath: string, baseContent: string, targetContent: string): DiffHunk[] {
  const patch = structuredPatch(filePath, filePath, baseContent, targetContent, "", "");
  return patch.hunks.map((hunk, index) => ({
    id: `${editId}-${index}`,
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: hunk.newStart,
    newLines: hunk.newLines,
    lines: hunk.lines,
  }));
}

export function applyHunksToContent(baseContent: string, hunks: DiffHunk[]): string {
  if (hunks.length === 0) return baseContent;
  let lines = baseContent.split("\n");
  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart);
  let offset = 0;

  for (const hunk of sorted) {
    const startIndex = hunk.oldStart - 1 + offset;
    const endIndex = startIndex + hunk.oldLines;
    const replacement: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("\\ No newline")) continue;
      const prefix = line[0];
      const text = line.slice(1);
      if (prefix === " " || prefix === "+") {
        replacement.push(text);
      }
    }

    lines = [...lines.slice(0, startIndex), ...replacement, ...lines.slice(endIndex)];
    offset += replacement.length - hunk.oldLines;
  }

  return lines.join("\n");
}

export function buildDiffRows(hunk: DiffHunk): DiffRow[] {
  const rows: DiffRow[] = [];
  let leftLine = hunk.oldStart;
  let rightLine = hunk.newStart;

  for (const line of hunk.lines) {
    if (line.startsWith("\\ No newline")) continue;
    const prefix = line[0];
    const text = line.slice(1);

    if (prefix === " ") {
      rows.push({ type: "context", leftNumber: leftLine++, rightNumber: rightLine++, leftText: text, rightText: text });
    } else if (prefix === "-") {
      rows.push({ type: "remove", leftNumber: leftLine++, rightNumber: null, leftText: text, rightText: "" });
    } else if (prefix === "+") {
      rows.push({ type: "add", leftNumber: null, rightNumber: rightLine++, leftText: "", rightText: text });
    }
  }

  return rows;
}

export function getPreviewLines(content: string, startLine: number, lineCount: number, context = 5): PreviewLine[] {
  const lines = content.split("\n");
  const safeStart = Math.max(1, startLine - context);
  const safeEnd = Math.min(lines.length, startLine + Math.max(lineCount, 1) + context);
  const slice = lines.slice(safeStart - 1, safeEnd);
  return slice.map((text, index) => ({ line: safeStart + index, text }));
}

// ─── Time Helpers ────────────────────────────────────────────────────────────

export function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function deriveWorkspaceName(rootPath?: string, fallback?: string) {
  // Always prefer the folder name from the path over generic backend names
  if (rootPath) {
    const parts = rootPath.split(/[\\/]/).filter(Boolean);
    const folderName = parts[parts.length - 1];
    if (folderName) return folderName;
  }
  if (fallback) return fallback;
  return "Workspace";
}

// ─── Language Detection ──────────────────────────────────────────────────────

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
  swift: "swift", kt: "kotlin", scala: "scala",
  html: "html", css: "css", scss: "scss", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  xml: "xml", svg: "xml",
  md: "markdown", mdx: "markdown",
  sh: "shell", bash: "shell", zsh: "shell",
  sql: "sql", graphql: "graphql", gql: "graphql",
  dockerfile: "dockerfile", makefile: "makefile",
  vue: "vue", svelte: "svelte",
  lua: "lua", php: "php", r: "r", dart: "dart",
};

export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  // Special filenames
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower.endsWith(".env") || lower.startsWith(".env")) return "plaintext";

  const ext = lower.split(".").pop() || "";
  return EXTENSION_LANGUAGE_MAP[ext] || "plaintext";
}
