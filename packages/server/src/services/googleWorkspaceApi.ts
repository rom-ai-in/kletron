import { createHash, randomUUID } from "node:crypto";

export type GoogleWorkspaceProviderId = "google-drive" | "google-calendar" | "gmail";

export interface GoogleWorkspaceAuth {
    accessToken?: string;
    refreshToken?: string;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_API_BASE = "https://www.googleapis.com";
const GMAIL_API_BASE = "https://gmail.googleapis.com";
/** Google-hosted Streamable HTTP Gmail MCP (Developer Preview). */
export const GMAIL_HOSTED_MCP_URL = "https://gmailmcp.googleapis.com/mcp/v1";
const DEFAULT_TIME_ZONE = "Europe/Zurich";

/** Set `KLETRON_DEBUG_GOOGLE_TOKEN_SCOPES=1` to log oauth2 tokeninfo (scopes only, no secrets) for Gmail debugging. */
export function shouldDebugGoogleTokenScopes(): boolean {
    return process.env.KLETRON_DEBUG_GOOGLE_TOKEN_SCOPES === "1";
}

/** Returns space-separated scope string from Google's tokeninfo endpoint (debug / diagnostics only). */
export async function fetchGoogleAccessTokenScopeSummary(
    accessToken: string
): Promise<{ scope: string; aud?: string } | null> {
    const trimmed = accessToken?.trim() ?? "";
    if (!trimmed) return null;
    const url = new URL(GOOGLE_TOKENINFO_URL);
    url.searchParams.set("access_token", trimmed);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const scope = typeof json.scope === "string" ? json.scope : "";
    const audRaw = json.audience ?? json.aud;
    const aud = typeof audRaw === "string" ? audRaw : undefined;
    return { scope, aud };
}

/**
 * Logs scope list from tokeninfo (safe: scopes are not secrets). No-op unless
 * `KLETRON_DEBUG_GOOGLE_TOKEN_SCOPES=1`.
 */
export async function debugLogGoogleAccessTokenScopes(label: string, accessToken: string): Promise<void> {
    if (!shouldDebugGoogleTokenScopes()) return;
    try {
        const summary = await fetchGoogleAccessTokenScopeSummary(accessToken);
        if (!summary?.scope) {
            console.warn(`[kletron-google-oauth] ${label} tokeninfo: empty or failed`);
            return;
        }
        const scopes = summary.scope.split(/\s+/).filter(Boolean);
        const hasGmailApi = scopes.some((s) => s.includes("gmail.") || s.endsWith("/auth/gmail.readonly"));
        console.warn(
            `[kletron-google-oauth] ${label} tokeninfo: ${scopes.length} scope(s), aud=${summary.aud ?? "?"}, hasGmailMailboxScope=${hasGmailApi} | ${scopes.join(" ")}`
        );
    } catch (error) {
        console.warn(`[kletron-google-oauth] ${label} tokeninfo error:`, (error as Error)?.message ?? error);
    }
}

export async function debugLogGoogleWorkspaceAuthScopes(label: string, auth: GoogleWorkspaceAuth): Promise<void> {
    if (!shouldDebugGoogleTokenScopes()) return;
    try {
        const refresh = auth.refreshToken?.trim() ?? "";
        const token = refresh
            ? await refreshGoogleAccessToken(refresh)
            : auth.accessToken?.trim() ?? "";
        if (!token) {
            console.warn(`[kletron-google-oauth] ${label} no access/refresh token to introspect`);
            return;
        }
        await debugLogGoogleAccessTokenScopes(label, token);
    } catch (error) {
        console.warn(`[kletron-google-oauth] ${label}`, (error as Error)?.message ?? error);
    }
}

function getGoogleClientCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials are missing from the environment");
    }
    return { clientId, clientSecret };
}

/** Same client id/secret as {@link getGoogleClientCredentials}, but returns null when unset (optional injection paths). */
export function tryGetGoogleOAuthClientCredentials(): { clientId: string; clientSecret: string } | null {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

export function isGoogleWorkspaceProviderId(providerId: string): providerId is GoogleWorkspaceProviderId {
    return providerId === "google-drive" || providerId === "google-calendar" || providerId === "gmail";
}

/** True if Google's tokeninfo `scope` string lists any Gmail REST API scope (mailbox access). */
export function googleScopeStringHasGmailMailboxApi(scope: string): boolean {
    if (!scope || typeof scope !== "string") return false;
    return scope
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .some((s) => s.includes("googleapis.com/auth/gmail."));
}

/**
 * True if this bearer can call Gmail `users.labels.list` — the same capability MCP needs.
 * Prefer this over tokeninfo alone (scope strings can be incomplete or misleading).
 */
export async function gmailAccessTokenCanListMailbox(accessToken: string): Promise<boolean> {
    const trimmed = accessToken?.trim() ?? "";
    if (!trimmed) return false;
    try {
        const res = await fetch(`${GMAIL_API_BASE}/gmail/v1/users/me/labels?maxResults=1`, {
            headers: { Authorization: `Bearer ${trimmed}` },
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Calls Gmail hosted MCP `tools/list` with the same Bearer Kletron injects for Codex.
 * Compare with {@link gmailAccessTokenCanListMailbox}: if REST succeeds but this fails,
 * the gateway `gmailmcp.googleapis.com` rejects the token or Codex is not forwarding auth.
 */
export async function probeGoogleHostedGmailMcpToolsList(accessToken: string): Promise<{
    status: number;
    ok: boolean;
    bodyHasScopeError: boolean;
}> {
    const trimmed = accessToken?.trim() ?? "";
    if (!trimmed) return { status: 0, ok: false, bodyHasScopeError: false };
    try {
        const res = await fetch(GMAIL_HOSTED_MCP_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${trimmed}`,
                Accept: "application/json, text/event-stream",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });
        const text = await res.text();
        return {
            status: res.status,
            ok: res.ok,
            bodyHasScopeError: text.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"),
        };
    } catch {
        return { status: 0, ok: false, bodyHasScopeError: false };
    }
}

/**
 * Calls Kletron’s local workspace MCP (`/api/mcp/workspace/[id]`) `tools/list` with the same
 * `Authorization` header Codex sends (`KLETRON_LOCAL_MCP_AUTH`).
 */
export async function probeKletronLocalMcpToolsList(mcpUrl: string, authorizationHeader: string): Promise<{
    status: number;
    ok: boolean;
    bodyHasScopeError: boolean;
}> {
    const url = mcpUrl?.trim() ?? "";
    const rawAuth = authorizationHeader?.trim() ?? "";
    if (!url || !rawAuth) return { status: 0, ok: false, bodyHasScopeError: false };
    const auth = rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth : `Bearer ${rawAuth}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: auth,
                Accept: "application/json, text/event-stream",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });
        const text = await res.text();
        return {
            status: res.status,
            ok: res.ok,
            bodyHasScopeError: text.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"),
        };
    } catch {
        return { status: 0, ok: false, bodyHasScopeError: false };
    }
}

/**
 * Calls hosted Gmail MCP `tools/call` for `search_threads` (same path Codex uses for inbox search).
 * If Gmail REST works but this call fails with PERMISSION_DENIED, causes include: Gmail MCP API not enabled,
 * or (common for preview features) the OAuth client’s GCP project not yet **registered** in the
 * Google Workspace Developer Preview Program — see https://developers.google.com/workspace/preview
 */
/** Streamable HTTP MCP may return HTTP 200 while JSON-RPC `error` is in the body — do not use `res.ok` alone. */
function parseMcpHttpResponseBodies(text: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const line of text.split(/\n/)) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const raw = t.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
            const j = JSON.parse(raw) as Record<string, unknown>;
            if (j && typeof j === "object") out.push(j);
        } catch {
            continue;
        }
    }
    if (out.length === 0) {
        try {
            const j = JSON.parse(text.trim()) as Record<string, unknown>;
            if (j && typeof j === "object") out.push(j);
        } catch {
            /* empty */
        }
    }
    return out;
}

/**
 * Hosted Gmail MCP often returns tool failures as JSON-RPC **result** with MCP `isError: true` and text in
 * `content[]` — not a top-level JSON-RPC `error`. Codex surfaces the same text as "permission denied".
 */
function summarizeMcpCallToolResultPayload(result: unknown, depth = 0): { isError: boolean; text: string } {
    if (depth > 14) return { isError: false, text: "" };
    if (result === null || typeof result !== "object") return { isError: false, text: "" };
    if (Array.isArray(result)) {
        let acc = "";
        for (const x of result) {
            const s = summarizeMcpCallToolResultPayload(x, depth + 1);
            if (s.isError) return s;
            acc += s.text;
        }
        return { isError: false, text: acc };
    }
    const o = result as Record<string, unknown>;
    if (o.isError === true) {
        let text = "";
        const content = o.content;
        if (Array.isArray(content)) {
            for (const c of content) {
                if (c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string") {
                    text += (c as Record<string, unknown>).text as string;
                }
            }
        }
        if (typeof o.message === "string" && !text) text = o.message;
        return { isError: true, text };
    }
    for (const v of Object.values(o)) {
        if (typeof v === "string" && v.includes("\"error\"")) {
            try {
                const inner = JSON.parse(v) as Record<string, unknown>;
                const err = inner.error as Record<string, unknown> | undefined;
                if (err && typeof err.message === "string") {
                    return { isError: true, text: err.message };
                }
            } catch {
                /* ignore */
            }
        }
    }
    let combined = "";
    let childError: { isError: boolean; text: string } | null = null;
    for (const v of Object.values(o)) {
        const s = summarizeMcpCallToolResultPayload(v, depth + 1);
        if (s.isError) {
            childError = s;
            break;
        }
        combined += s.text;
    }
    if (childError?.isError) return childError;
    return { isError: false, text: combined };
}

function summarizeHostedGmailMcpToolsCallText(text: string): {
    bodyHasPermissionDenied: boolean;
    bodyHasScopeError: boolean;
    jsonRpcError: boolean;
    mcpToolResultIsError: boolean;
    errorMessagePrefix?: string;
} {
    const lower = text.toLowerCase();
    const bodyHasPermissionDenied =
        lower.includes("permission_denied") ||
        lower.includes("the caller does not have permission") ||
        lower.includes('"status": "permission_denied"');
    const bodyHasScopeError = text.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT");
    let jsonRpcError = false;
    let mcpToolResultIsError = false;
    let errorMessagePrefix: string | undefined;
    for (const j of parseMcpHttpResponseBodies(text)) {
        if (typeof j.error === "object" && j.error !== null) {
            jsonRpcError = true;
            const err = j.error as Record<string, unknown>;
            const msg = typeof err.message === "string" ? err.message : "";
            if (msg) errorMessagePrefix = msg.slice(0, 100);
        }
        if ("result" in j && j.result !== undefined) {
            const tr = summarizeMcpCallToolResultPayload(j.result);
            if (tr.isError) {
                mcpToolResultIsError = true;
                const slice = tr.text.trim().slice(0, 160);
                if (slice && !errorMessagePrefix) errorMessagePrefix = slice;
            }
        }
    }
    return {
        bodyHasPermissionDenied,
        bodyHasScopeError,
        jsonRpcError,
        mcpToolResultIsError,
        errorMessagePrefix,
    };
}

export async function probeGoogleHostedGmailMcpSearchThreads(accessToken: string): Promise<{
    status: number;
    /** True only when HTTP succeeds and the payload is not a JSON-RPC error and has no permission/scope denial text. */
    ok: boolean;
    bodyHasPermissionDenied: boolean;
    bodyHasScopeError: boolean;
    jsonRpcError: boolean;
    /** MCP `tools/call` returned `result` with `isError: true` (tool-level failure). */
    mcpToolResultIsError: boolean;
    errorMessagePrefix?: string;
}> {
    const trimmed = accessToken?.trim() ?? "";
    if (!trimmed) {
        return {
            status: 0,
            ok: false,
            bodyHasPermissionDenied: false,
            bodyHasScopeError: false,
            jsonRpcError: false,
            mcpToolResultIsError: false,
        };
    }
    try {
        const res = await fetch(GMAIL_HOSTED_MCP_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${trimmed}`,
                Accept: "application/json, text/event-stream",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                    name: "search_threads",
                    arguments: { query: "in:inbox newer_than:7d", pageSize: 1 },
                },
            }),
        });
        const text = await res.text();
        const s = summarizeHostedGmailMcpToolsCallText(text);
        const logicalFailure =
            s.bodyHasPermissionDenied ||
            s.bodyHasScopeError ||
            s.jsonRpcError ||
            s.mcpToolResultIsError ||
            !res.ok;
        return {
            status: res.status,
            ok: res.ok && !logicalFailure,
            bodyHasPermissionDenied: s.bodyHasPermissionDenied,
            bodyHasScopeError: s.bodyHasScopeError,
            jsonRpcError: s.jsonRpcError,
            mcpToolResultIsError: s.mcpToolResultIsError,
            errorMessagePrefix: s.errorMessagePrefix,
        };
    } catch {
        return {
            status: 0,
            ok: false,
            bodyHasPermissionDenied: false,
            bodyHasScopeError: false,
            jsonRpcError: false,
            mcpToolResultIsError: false,
        };
    }
}

/**
 * Bearer for Google's hosted Gmail MCP (Codex).
 *
 * 1. Prefer the stored `access_token` first—after incremental consent it often has mailbox scopes before
 *    a refresh-issued token does.
 * 2. Fall back to an access token from `refresh_token`.
 * Validation uses a live Gmail labels probe (not only oauth2 tokeninfo).
 */
export async function resolveGoogleHostedGmailMcpBearer(creds: Record<string, string>): Promise<string | null> {
    const rt = typeof creds.refreshToken === "string" ? creds.refreshToken.trim() : "";
    const at = typeof creds.accessToken === "string" ? creds.accessToken.trim() : "";

    if (at) {
        if (await gmailAccessTokenCanListMailbox(at)) {
            if (shouldDebugGoogleTokenScopes()) {
                await debugLogGoogleAccessTokenScopes("gmail-mcp: stored access_token (labels probe ok)", at);
            }
            return at;
        }
        if (shouldDebugGoogleTokenScopes()) {
            const sum = await fetchGoogleAccessTokenScopeSummary(at);
            console.warn(
                `[kletron-google-oauth] gmail-mcp: stored access_token failed labels probe. tokeninfo scope=${sum?.scope ?? "?"}`
            );
        }
    }

    if (rt) {
        try {
            const fromRt = await refreshGoogleAccessToken(rt);
            if (await gmailAccessTokenCanListMailbox(fromRt)) {
                if (shouldDebugGoogleTokenScopes()) {
                    await debugLogGoogleAccessTokenScopes("gmail-mcp: token from refresh (labels probe ok)", fromRt);
                }
                return fromRt;
            }
            if (shouldDebugGoogleTokenScopes()) {
                const sum = await fetchGoogleAccessTokenScopeSummary(fromRt);
                console.warn(
                    `[kletron-google-oauth] gmail-mcp: refresh bearer failed labels probe. tokeninfo scope=${sum?.scope ?? "?"}`
                );
            }
        } catch (error) {
            if (shouldDebugGoogleTokenScopes()) {
                console.warn(`[kletron-google-oauth] gmail-mcp: refresh failed`, (error as Error)?.message ?? error);
            }
        }
    }

    return null;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = getGoogleClientCredentials();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }).toString(),
        signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(`Google token refresh failed (${response.status}): ${raw.slice(0, 200)}`);
    }
    const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const accessToken = typeof json.access_token === "string" ? json.access_token.trim() : "";
    if (!accessToken) {
        throw new Error("Google token refresh did not return an access token");
    }
    return accessToken;
}

async function resolveAccessToken(auth: GoogleWorkspaceAuth): Promise<string> {
    const accessToken = auth.accessToken?.trim() ?? "";
    if (accessToken) return accessToken;
    const refreshToken = auth.refreshToken?.trim() ?? "";
    if (!refreshToken) {
        throw new Error("Google access token is missing and no refresh token is available");
    }
    return await refreshGoogleAccessToken(refreshToken);
}

/** One in-flight Gmail API call per Google account (avoids 429 "Too many concurrent requests for user"). */
const gmailRequestTailByKey = new Map<string, Promise<unknown>>();

function gmailRequestLockKey(auth: GoogleWorkspaceAuth): string {
    const rt = auth.refreshToken?.trim() ?? "";
    if (rt) return `rt:${createHash("sha256").update(rt).digest("hex").slice(0, 24)}`;
    const at = auth.accessToken?.trim() ?? "";
    if (at) return `at:${createHash("sha256").update(at).digest("hex").slice(0, 24)}`;
    return "gmail:empty";
}

async function withGmailApiConcurrencyLock<T>(auth: GoogleWorkspaceAuth, run: () => Promise<T>): Promise<T> {
    const key = gmailRequestLockKey(auth);
    const tail = (gmailRequestTailByKey.get(key) ?? Promise.resolve()) as Promise<unknown>;
    const out = tail.then(() => run());
    gmailRequestTailByKey.set(key, out.then(
        () => undefined,
        () => undefined,
    ));
    return out;
}

function isGmailApiUrl(url: string): boolean {
    return url.includes("gmail.googleapis.com");
}

/** Avoid indefinite hangs on stalled Gmail TLS/connect — unblocks Codex MCP tools/call + item/completed. */
const GMAIL_FETCH_TIMEOUT_MS = 120_000;

function gmailOutboundSignal(parent: AbortSignal | undefined): AbortSignal {
    const timeoutSig = AbortSignal.timeout(GMAIL_FETCH_TIMEOUT_MS);
    if (!parent) return timeoutSig;
    const anyFn = (AbortSignal as typeof AbortSignal & { any?: (signals: AbortSignal[]) => AbortSignal }).any;
    if (typeof anyFn === "function") return anyFn([parent, timeoutSig]);
    return timeoutSig;
}

export async function googleAuthorizedFetch(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<Response> {
    const refreshToken = auth.refreshToken?.trim() ?? "";
    const headers = new Headers(init.headers ?? {});
    const accessToken = await resolveAccessToken(auth);
    headers.set("Authorization", `Bearer ${accessToken}`);

    const outboundSignal = isGmailApiUrl(url)
        ? gmailOutboundSignal(init.signal as AbortSignal | undefined)
        : init.signal;

    const first = await fetch(url, { ...init, headers, signal: outboundSignal });
    if ((first.status === 401 || first.status === 403) && refreshToken) {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        headers.set("Authorization", `Bearer ${refreshed}`);
        const retrySignal = isGmailApiUrl(url)
            ? gmailOutboundSignal(init.signal as AbortSignal | undefined)
            : init.signal;
        return await fetch(url, { ...init, headers, signal: retrySignal });
    }
    return first;
}

function formatGoogleApiHttpError(status: number, text: string): string {
    let detail = text.slice(0, 500);
    if (detail.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
        detail +=
            " — The access token is missing Gmail mailbox scopes (e.g. gmail.readonly). Note: hosted Gmail MCP `gmail_get_profile` may still return name/email from OpenID-style identity; that does not prove mailbox access. Reconnect the Gmail connector after revoking Kletron at myaccount.google.com/permissions. Set KLETRON_DEBUG_GOOGLE_TOKEN_SCOPES=1 and check server logs for tokeninfo scope list. In Google Cloud OAuth consent, include Gmail scopes; enable Gmail API on the OAuth client project.";
    }
    return `Google API request failed (${status}): ${detail}`;
}

async function googleJsonOnce<T>(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<T> {
    const response = await googleAuthorizedFetch(auth, url, init);
    const text = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(formatGoogleApiHttpError(response.status, text));
    }
    if (!text) {
        return {} as T;
    }
    return JSON.parse(text) as T;
}

export async function googleJson<T>(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<T> {
    if (isGmailApiUrl(url)) {
        return withGmailApiConcurrencyLock(auth, () => googleJsonOnce<T>(auth, url, init));
    }
    return googleJsonOnce<T>(auth, url, init);
}

async function googleTextOnce(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<{ text: string; contentType: string; response: Response }> {
    const response = await googleAuthorizedFetch(auth, url, init);
    const text = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(formatGoogleApiHttpError(response.status, text));
    }
    return {
        text,
        contentType: response.headers.get("content-type") ?? "",
        response,
    };
}

export async function googleText(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<{ text: string; contentType: string; response: Response }> {
    if (isGmailApiUrl(url)) {
        return withGmailApiConcurrencyLock(auth, () => googleTextOnce(auth, url, init));
    }
    return googleTextOnce(auth, url, init);
}

export function toBase64Url(raw: string): string {
    return Buffer.from(raw, "utf8").toString("base64url");
}

export function fromBase64Url(raw: string): string {
    return Buffer.from(raw, "base64url").toString("utf8");
}

export function stripHtmlToText(rawHtml: string): string {
    return rawHtml
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

type GmailPayload = {
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailPayload[];
    headers?: Array<{ name?: string; value?: string }>;
};

export function extractGmailText(payload?: GmailPayload | null): string {
    if (!payload) return "";
    const mimeType = String(payload.mimeType ?? "").toLowerCase();
    if (Array.isArray(payload.parts) && payload.parts.length > 0) {
        const fragments = payload.parts
            .map((part) => extractGmailText(part))
            .filter((part) => part.trim().length > 0);
        if (fragments.length > 0) return fragments.join("\n\n");
    }
    const data = typeof payload.body?.data === "string" ? payload.body.data : "";
    if (!data) return "";
    const text = fromBase64Url(data);
    if (mimeType.includes("text/html")) return stripHtmlToText(text);
    return text.trim();
}

export function getGmailHeader(
    headers: Array<{ name?: string; value?: string }> | undefined,
    wanted: string
): string {
    const target = wanted.trim().toLowerCase();
    const hit = headers?.find((header) => String(header.name ?? "").trim().toLowerCase() === target);
    return String(hit?.value ?? "");
}

export function buildGmailRawMessage(input: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    inReplyTo?: string;
    references?: string[];
    contentType?: "text/plain" | "text/html";
}): string {
    const lines: string[] = [];
    const appendHeader = (name: string, value?: string | string[]) => {
        const normalized = Array.isArray(value)
            ? value.map((item) => item.trim()).filter(Boolean).join(", ")
            : String(value ?? "").trim();
        if (normalized) lines.push(`${name}: ${normalized}`);
    };

    appendHeader("To", input.to);
    appendHeader("Cc", input.cc);
    appendHeader("Bcc", input.bcc);
    appendHeader("Subject", input.subject);
    appendHeader("Reply-To", input.replyTo);
    appendHeader("In-Reply-To", input.inReplyTo);
    if (input.references?.length) {
        appendHeader("References", input.references.join(" "));
    }
    lines.push('MIME-Version: 1.0');
    lines.push(`Content-Type: ${input.contentType ?? "text/plain"}; charset="UTF-8"`);
    lines.push("");
    lines.push(input.body ?? "");
    return lines.join("\r\n");
}

export function defaultDriveExportMimeType(fileMimeType: string): string | null {
    const normalized = fileMimeType.trim().toLowerCase();
    if (normalized === "application/vnd.google-apps.document") return "text/markdown";
    if (normalized === "application/vnd.google-apps.spreadsheet") return "text/csv";
    if (normalized === "application/vnd.google-apps.presentation") return "text/plain";
    if (normalized === "application/vnd.google-apps.drawing") return "image/png";
    if (normalized === "application/vnd.google-apps.vid") return "video/mp4";
    return null;
}

export async function probeGoogleWorkspaceConnection(
    providerId: GoogleWorkspaceProviderId,
    auth: GoogleWorkspaceAuth
): Promise<{ ok: boolean; message: string }> {
    try {
        if (providerId === "gmail") {
            await debugLogGoogleWorkspaceAuthScopes("probe-googleWorkspace:gmail", auth);
            const labels = await googleJson<{ labels?: Array<{ id?: string; name?: string }> }>(
                auth,
                `${GMAIL_API_BASE}/gmail/v1/users/me/labels?maxResults=1`
            );
            const messages = await googleJson<{
                messages?: Array<{ id?: string; threadId?: string }>;
            }>(
                auth,
                `${GMAIL_API_BASE}/gmail/v1/users/me/messages?maxResults=1&includeSpamTrash=false`
            );
            return {
                ok: true,
                message: `Gmail connection ok (${Array.isArray(labels.labels) ? labels.labels.length : 0} label(s) and ${Array.isArray(messages.messages) ? messages.messages.length : 0} message(s) fetched).`,
            };
        }
        if (providerId === "google-calendar") {
            const data = await googleJson<{ items?: Array<{ id?: string; summary?: string }> }>(
                auth,
                `${GOOGLE_API_BASE}/calendar/v3/users/me/calendarList?maxResults=1`
            );
            const now = new Date();
            const later = new Date(now.getTime() + 15 * 60 * 1000);
            await googleJson<Record<string, unknown>>(auth, `${GOOGLE_API_BASE}/calendar/v3/freeBusy`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    timeMin: now.toISOString(),
                    timeMax: later.toISOString(),
                    items: [{ id: "primary" }],
                }),
            });
            return {
                ok: true,
                message: `Google Calendar connection ok (${Array.isArray(data.items) ? data.items.length : 0} calendar(s) fetched).`,
            };
        }
        const data = await googleJson<{ files?: Array<{ id?: string; name?: string }> }>(
            auth,
            `${GOOGLE_API_BASE}/drive/v3/files?pageSize=1&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`
        );
        return {
            ok: true,
            message: `Google Drive connection ok (${Array.isArray(data.files) ? data.files.length : 0} file(s) fetched).`,
        };
    } catch (error) {
        return {
            ok: false,
            message: (error as Error)?.message ?? String(error),
        };
    }
}

export function buildMultipartRelatedBody(parts: Array<{ contentType: string; body: string }>): {
    body: string;
    boundary: string;
} {
    const boundary = `kletron-${randomUUID()}`;
    const chunks: string[] = [];
    for (const part of parts) {
        chunks.push(`--${boundary}`);
        chunks.push(`Content-Type: ${part.contentType}`);
        chunks.push("");
        chunks.push(part.body);
    }
    chunks.push(`--${boundary}--`);
    chunks.push("");
    return {
        boundary,
        body: chunks.join("\r\n"),
    };
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
    const limit = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 20000;
    if (text.length <= limit) return { text, truncated: false };
    return { text: text.slice(0, limit), truncated: true };
}

export function parseResponseTextMaybeJson(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) return "";
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return text;
        }
    }
    return text;
}

export function calendarDefaultTimeZone(): string {
    return DEFAULT_TIME_ZONE;
}
