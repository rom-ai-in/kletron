import { randomUUID } from "node:crypto";

export type GoogleWorkspaceProviderId = "google-drive" | "google-calendar" | "gmail";

export interface GoogleWorkspaceAuth {
    accessToken?: string;
    refreshToken?: string;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_BASE = "https://www.googleapis.com";
const GMAIL_API_BASE = "https://gmail.googleapis.com";
const DEFAULT_TIME_ZONE = "Europe/Zurich";

function getGoogleClientCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials are missing from the environment");
    }
    return { clientId, clientSecret };
}

export function isGoogleWorkspaceProviderId(providerId: string): providerId is GoogleWorkspaceProviderId {
    return providerId === "google-drive" || providerId === "google-calendar" || providerId === "gmail";
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

export async function googleAuthorizedFetch(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<Response> {
    const refreshToken = auth.refreshToken?.trim() ?? "";
    const headers = new Headers(init.headers ?? {});
    const accessToken = await resolveAccessToken(auth);
    headers.set("Authorization", `Bearer ${accessToken}`);

    const first = await fetch(url, { ...init, headers });
    if ((first.status === 401 || first.status === 403) && refreshToken) {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        headers.set("Authorization", `Bearer ${refreshed}`);
        return await fetch(url, { ...init, headers });
    }
    return first;
}

export async function googleJson<T>(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<T> {
    const response = await googleAuthorizedFetch(auth, url, init);
    const text = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(`Google API request failed (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!text) {
        return {} as T;
    }
    return JSON.parse(text) as T;
}

export async function googleText(
    auth: GoogleWorkspaceAuth,
    url: string,
    init: RequestInit = {}
): Promise<{ text: string; contentType: string; response: Response }> {
    const response = await googleAuthorizedFetch(auth, url, init);
    const text = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(`Google API request failed (${response.status}): ${text.slice(0, 200)}`);
    }
    return {
        text,
        contentType: response.headers.get("content-type") ?? "",
        response,
    };
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
            const data = await googleJson<{ labels?: Array<{ id?: string; name?: string }> }>(
                auth,
                `${GMAIL_API_BASE}/gmail/v1/users/me/labels?maxResults=1`
            );
            return {
                ok: true,
                message: `Gmail connection ok (${Array.isArray(data.labels) ? data.labels.length : 0} label(s) fetched).`,
            };
        }
        if (providerId === "google-calendar") {
            const data = await googleJson<{ items?: Array<{ id?: string; summary?: string }> }>(
                auth,
                `${GOOGLE_API_BASE}/calendar/v3/users/me/calendarList?maxResults=1`
            );
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
