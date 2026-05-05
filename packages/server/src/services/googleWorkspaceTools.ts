import { randomUUID } from "node:crypto";

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { findActiveIntegration, getIntegrationCredentials } from "./connectorsService";
import {
    buildGmailRawMessage,
    buildMultipartRelatedBody,
    calendarDefaultTimeZone,
    defaultDriveExportMimeType,
    extractGmailText,
    getGmailHeader,
    googleAuthorizedFetch,
    googleJson,
    googleText,
    probeGoogleWorkspaceConnection,
    truncateText,
    type GoogleWorkspaceAuth,
    type GoogleWorkspaceProviderId,
    toBase64Url,
} from "./googleWorkspaceApi";
import { getWorkspaceContext } from "../workspace/workspaceContext";

const GMAIL_BASE = "https://gmail.googleapis.com";
const GOOGLE_API_BASE = "https://www.googleapis.com";
const TOOL_MAX_TEXT_CHARS = 20_000;

const addressListSchema = z.union([z.string(), z.array(z.string())]);

function jsonResult(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function normalizeList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeAddressList(value?: string | string[]): string[] {
    return normalizeList(value);
}

function buildGoogleUrl(base: string, path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const url = new URL(path, base);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === "") continue;
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

export function resolveGoogleWorkspaceUrl(pathOrUrl: string): string {
    const trimmed = pathOrUrl.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${GOOGLE_API_BASE}${trimmed}`;
}

function resolveGoogleWorkspaceId(workspaceId?: string): string {
    const trimmed = workspaceId?.trim() ?? "";
    if (trimmed) return trimmed;
    return getWorkspaceContext()?.workspaceId?.trim() ?? "";
}

async function resolveGoogleAuth(workspaceId: string | undefined, providerId: GoogleWorkspaceProviderId): Promise<GoogleWorkspaceAuth> {
    const resolvedWorkspaceId = resolveGoogleWorkspaceId(workspaceId);
    if (!resolvedWorkspaceId) {
        throw new Error(`No active workspace context found for ${providerId}`);
    }
    const integration = await findActiveIntegration(resolvedWorkspaceId, providerId);
    if (!integration) {
        throw new Error(`No active ${providerId} integration found for this workspace`);
    }
    const creds = await getIntegrationCredentials(resolvedWorkspaceId, integration.id);
    if (!creds) {
        throw new Error(`Could not decrypt credentials for ${providerId}`);
    }
    const accessToken = typeof creds.accessToken === "string" ? creds.accessToken : undefined;
    const refreshToken = typeof creds.refreshToken === "string" ? creds.refreshToken : undefined;
    if (!accessToken && !refreshToken) {
        throw new Error(`Google credentials for ${providerId} are missing accessToken/refreshToken`);
    }
    return { accessToken, refreshToken };
}

async function gmailFetchMessage(auth: GoogleWorkspaceAuth, messageId: string, format: "full" | "metadata" = "full") {
    const headers = [
        "Subject",
        "From",
        "To",
        "Cc",
        "Bcc",
        "Date",
        "Message-ID",
        "Reply-To",
    ];
    const url = new URL(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`, GMAIL_BASE);
    url.searchParams.set("format", format);
    if (format === "metadata") {
        for (const header of headers) {
            url.searchParams.append("metadataHeaders", header);
        }
    }
    url.searchParams.set("fields", "id,threadId,labelIds,snippet,historyId,internalDate,payload");
    return await googleJson<Record<string, unknown>>(auth, url.toString());
}

async function gmailFetchReplyContext(auth: GoogleWorkspaceAuth, replyToMessageId: string): Promise<{
    threadId?: string;
    subject?: string;
    messageId?: string;
}> {
    const message = await gmailFetchMessage(auth, replyToMessageId, "full");
    const payload = (message.payload as Record<string, unknown> | undefined) ?? {};
    const headers = Array.isArray(payload.headers) ? (payload.headers as Array<{ name?: string; value?: string }>) : [];
    const subject = getGmailHeader(headers, "Subject");
    const messageId = getGmailHeader(headers, "Message-ID");
    const threadId = typeof message.threadId === "string" ? message.threadId : undefined;
    return { threadId, subject, messageId };
}

export type GmailMessageSummary = {
    id: string;
    threadId: string;
    labelIds: unknown[];
    snippet: string;
    historyId: string;
    internalDate: string;
    subject: string;
    from: string;
    to: string;
    date: string;
};

export type GmailLocalQuery = {
    labelIds: string[];
    fromTerms: string[];
    toTerms: string[];
    subjectTerms: string[];
    freeTextTerms: string[];
    newerThanDays?: number;
    unsupportedTokens: string[];
};

export function isGmailMetadataQueryScopeError(error: unknown): boolean {
    const message = (error as Error)?.message ?? String(error ?? "");
    return message.includes("Metadata scope does not support 'q' parameter");
}

export function parseGmailLocalQuery(rawQuery?: string): GmailLocalQuery {
    const query = (rawQuery ?? "in:inbox").trim();
    const tokens = query.split(/\s+/).filter(Boolean);
    const parsed: GmailLocalQuery = {
        labelIds: [],
        fromTerms: [],
        toTerms: [],
        subjectTerms: [],
        freeTextTerms: [],
        unsupportedTokens: [],
    };

    const pushLabel = (value: string) => {
        if (value && !parsed.labelIds.includes(value)) parsed.labelIds.push(value);
    };

    for (const token of tokens) {
        const lower = token.toLowerCase();
        if (lower === "in:inbox") {
            pushLabel("INBOX");
        } else if (lower === "in:sent") {
            pushLabel("SENT");
        } else if (lower === "in:drafts") {
            pushLabel("DRAFT");
        } else if (lower === "in:trash") {
            pushLabel("TRASH");
        } else if (lower === "in:spam") {
            pushLabel("SPAM");
        } else if (lower === "is:unread") {
            pushLabel("UNREAD");
        } else if (lower === "is:starred") {
            pushLabel("STARRED");
        } else if (lower === "is:important") {
            pushLabel("IMPORTANT");
        } else if (lower.startsWith("from:")) {
            parsed.fromTerms.push(token.slice(5));
        } else if (lower.startsWith("to:")) {
            parsed.toTerms.push(token.slice(3));
        } else if (lower.startsWith("subject:")) {
            parsed.subjectTerms.push(token.slice(8));
        } else if (/^newer_than:\d+d$/i.test(token)) {
            parsed.newerThanDays = Number.parseInt(token.slice("newer_than:".length, -1), 10);
        } else if (
            lower.startsWith("label:") ||
            lower.startsWith("after:") ||
            lower.startsWith("before:") ||
            lower.startsWith("older_than:")
        ) {
            parsed.unsupportedTokens.push(token);
        } else {
            parsed.freeTextTerms.push(token);
        }
    }

    return parsed;
}

function matchesAllTerms(haystack: string, terms: string[]): boolean {
    const lower = haystack.toLowerCase();
    return terms.every((term) => lower.includes(term.toLowerCase()));
}

export function filterGmailMessagesLocally(messages: GmailMessageSummary[], rawQuery?: string) {
    const parsed = parseGmailLocalQuery(rawQuery);
    const now = Date.now();
    const filtered = messages.filter((message) => {
        if (parsed.fromTerms.length > 0 && !matchesAllTerms(message.from, parsed.fromTerms)) return false;
        if (parsed.toTerms.length > 0 && !matchesAllTerms(message.to, parsed.toTerms)) return false;
        if (parsed.subjectTerms.length > 0 && !matchesAllTerms(message.subject, parsed.subjectTerms)) return false;
        if (
            parsed.freeTextTerms.length > 0 &&
            !matchesAllTerms(
                [message.subject, message.from, message.to, message.snippet].join(" "),
                parsed.freeTextTerms
            )
        ) {
            return false;
        }
        if (parsed.newerThanDays !== undefined) {
            const internalDateMs = Number.parseInt(message.internalDate, 10);
            if (Number.isFinite(internalDateMs)) {
                const ageMs = now - internalDateMs;
                if (ageMs > parsed.newerThanDays * 24 * 60 * 60 * 1000) return false;
            }
        }
        return true;
    });

    const warnings: string[] = [];
    if (parsed.unsupportedTokens.length > 0) {
        warnings.push(
            `Local Gmail fallback ignored unsupported query tokens: ${parsed.unsupportedTokens.join(", ")}`
        );
    }

    return {
        filtered,
        labelIds: parsed.labelIds,
        warnings,
    };
}

async function gmailListMessageIds(
    auth: GoogleWorkspaceAuth,
    input: {
        query?: string;
        maxResults?: number;
        labelIds?: string[];
        includeSpamTrash?: boolean;
        pageToken?: string;
    },
    mode: "query" | "fallback"
) {
    const url = new URL("/gmail/v1/users/me/messages", GMAIL_BASE);
    if (mode === "query") {
        url.searchParams.set("q", input.query ?? "in:inbox");
        url.searchParams.set("maxResults", String(input.maxResults ?? 10));
    } else {
        const filtered = filterGmailMessagesLocally([], input.query);
        const fallbackLabels = [
            ...(input.labelIds ?? []),
            ...filtered.labelIds,
        ];
        const uniqueLabels = Array.from(new Set(fallbackLabels.filter(Boolean)));
        url.searchParams.set(
            "maxResults",
            String(Math.min(Math.max((input.maxResults ?? 10) * 5, 20), 50))
        );
        for (const labelId of uniqueLabels) {
            url.searchParams.append("labelIds", labelId);
        }
    }
    url.searchParams.set("includeSpamTrash", String(input.includeSpamTrash ?? false));
    if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
    for (const labelId of input.labelIds ?? []) {
        if (mode === "query") {
            url.searchParams.append("labelIds", labelId);
        }
    }
    return await googleJson<{
        messages?: Array<{ id?: string; threadId?: string }>;
        nextPageToken?: string;
        resultSizeEstimate?: number;
    }>(auth, url.toString());
}

async function gmailHydrateMessageRows(
    auth: GoogleWorkspaceAuth,
    messages: Array<{ id?: string; threadId?: string }>,
    limit: number
): Promise<GmailMessageSummary[]> {
    const rows = await Promise.all(
        messages.slice(0, limit).map(async (message) => {
            if (!message.id) return null;
            const full = await gmailFetchMessage(auth, message.id, "metadata");
            const payload = (full.payload as Record<string, unknown> | undefined) ?? {};
            const headers = Array.isArray(payload.headers) ? (payload.headers as Array<{ name?: string; value?: string }>) : [];
            return {
                id: message.id,
                threadId: typeof full.threadId === "string" ? full.threadId : message.threadId ?? "",
                labelIds: Array.isArray(full.labelIds) ? full.labelIds : [],
                snippet: typeof full.snippet === "string" ? full.snippet : "",
                historyId: typeof full.historyId === "string" ? full.historyId : "",
                internalDate: typeof full.internalDate === "string" ? full.internalDate : "",
                subject: getGmailHeader(headers, "Subject"),
                from: getGmailHeader(headers, "From"),
                to: getGmailHeader(headers, "To"),
                date: getGmailHeader(headers, "Date"),
            };
        })
    );
    return rows.filter(Boolean) as GmailMessageSummary[];
}

async function gmailListMessages(auth: GoogleWorkspaceAuth, input: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    includeSpamTrash?: boolean;
    pageToken?: string;
}) {
    try {
        const data = await gmailListMessageIds(auth, input, "query");
        const messages = Array.isArray(data.messages) ? data.messages : [];
        const rows = await gmailHydrateMessageRows(auth, messages, input.maxResults ?? 10);
        return {
            query: input.query ?? "in:inbox",
            resultSizeEstimate: data.resultSizeEstimate ?? rows.length,
            nextPageToken: data.nextPageToken ?? null,
            messages: rows,
        };
    } catch (error) {
        if (!isGmailMetadataQueryScopeError(error)) {
            throw error;
        }

        const data = await gmailListMessageIds(auth, input, "fallback");
        const messages = Array.isArray(data.messages) ? data.messages : [];
        const hydrated = await gmailHydrateMessageRows(auth, messages, Math.min(Math.max((input.maxResults ?? 10) * 5, 20), 50));
        const filtered = filterGmailMessagesLocally(hydrated, input.query);
        const limited = filtered.filtered.slice(0, input.maxResults ?? 10);
        return {
            query: input.query ?? "in:inbox",
            resultSizeEstimate: limited.length,
            nextPageToken: data.nextPageToken ?? null,
            queryAppliedLocally: true,
            queryWarning: [
                "Gmail API rejected the query parameter for the current scope; fallback filtering was applied locally.",
                ...filtered.warnings,
            ].join(" "),
            messages: limited,
        };
    }
}

async function gmailSendOrDraftMessage(auth: GoogleWorkspaceAuth, input: {
    to: string | string[];
    subject?: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    threadId?: string;
    replyToMessageId?: string;
    contentType?: "text/plain" | "text/html";
    draft: boolean;
}) {
    const to = normalizeAddressList(input.to);
    if (to.length === 0) {
        throw new Error("At least one recipient is required");
    }

    const replyContext = input.replyToMessageId
        ? await gmailFetchReplyContext(auth, input.replyToMessageId)
        : null;
    const subject = input.subject?.trim() || (replyContext?.subject ? `Re: ${replyContext.subject.replace(/^Re:\s*/i, "")}` : "");
    if (!subject) {
        throw new Error("subject is required unless replyToMessageId can provide one");
    }

    const threadId = input.threadId?.trim() || replyContext?.threadId || undefined;
    const rawMessage = buildGmailRawMessage({
        to,
        cc: normalizeAddressList(input.cc),
        bcc: normalizeAddressList(input.bcc),
        subject,
        body: input.body,
        replyTo: undefined,
        inReplyTo: replyContext?.messageId,
        references: replyContext?.messageId ? [replyContext.messageId] : undefined,
        contentType: input.contentType ?? "text/plain",
    });

    const raw = toBase64Url(rawMessage);
    const body = input.draft
        ? {
              message: {
                  raw,
                  ...(threadId ? { threadId } : {}),
              },
          }
        : {
              raw,
              ...(threadId ? { threadId } : {}),
          };

    const url = input.draft
        ? `${GMAIL_BASE}/gmail/v1/users/me/drafts`
        : `${GMAIL_BASE}/gmail/v1/users/me/messages/send`;
    const method = input.draft ? "POST" : "POST";
    const result = await googleJson<Record<string, unknown>>(auth, url, {
        method,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    return {
        ok: true,
        draft: input.draft,
        threadId: typeof result.threadId === "string"
            ? result.threadId
            : threadId ?? null,
        id: typeof result.id === "string"
            ? result.id
            : typeof (result.message as Record<string, unknown> | undefined)?.id === "string"
              ? String((result.message as Record<string, unknown>).id)
              : null,
        labelIds: Array.isArray(result.labelIds) ? result.labelIds : undefined,
    };
}

async function gmailModifyLabels(auth: GoogleWorkspaceAuth, input: {
    messageId: string;
    addLabelIds?: string[];
    removeLabelIds?: string[];
}) {
    const url = `${GMAIL_BASE}/gmail/v1/users/me/messages/${encodeURIComponent(input.messageId)}/modify`;
    const result = await googleJson<Record<string, unknown>>(auth, url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            addLabelIds: input.addLabelIds ?? [],
            removeLabelIds: input.removeLabelIds ?? [],
        }),
    });
    return {
        ok: true,
        id: typeof result.id === "string" ? result.id : input.messageId,
        labelIds: Array.isArray(result.labelIds) ? result.labelIds : [],
    };
}

async function calendarJson<T>(auth: GoogleWorkspaceAuth, path: string, init: RequestInit = {}): Promise<T> {
    return await googleJson<T>(auth, resolveGoogleWorkspaceUrl(path), init);
}

function normalizeCalendarTimeBlock(input: string | Record<string, unknown>, fallbackTimeZone?: string) {
    if (typeof input === "string") {
        return {
            dateTime: input,
            ...(fallbackTimeZone ? { timeZone: fallbackTimeZone } : {}),
        };
    }
    const dateTime = typeof input.dateTime === "string" ? input.dateTime : undefined;
    const date = typeof input.date === "string" ? input.date : undefined;
    const timeZone = typeof input.timeZone === "string" ? input.timeZone : fallbackTimeZone;
    const out: Record<string, unknown> = {};
    if (dateTime) out.dateTime = dateTime;
    if (date) out.date = date;
    if (timeZone) out.timeZone = timeZone;
    return out;
}

function normalizeCalendarEvent(event: Record<string, unknown>) {
    return {
        id: typeof event.id === "string" ? event.id : undefined,
        summary: typeof event.summary === "string" ? event.summary : "",
        description: typeof event.description === "string" ? event.description : "",
        location: typeof event.location === "string" ? event.location : "",
        status: typeof event.status === "string" ? event.status : "",
        htmlLink: typeof event.htmlLink === "string" ? event.htmlLink : "",
        start: event.start,
        end: event.end,
        updated: typeof event.updated === "string" ? event.updated : "",
        attendees: Array.isArray(event.attendees) ? event.attendees : [],
        organizer: event.organizer,
        creator: event.creator,
    };
}

function makeMultipartTextUpload(input: {
    name?: string;
    content: string;
    mimeType: string;
    parents?: string[];
}) {
    const metadata: Record<string, unknown> = {
        mimeType: input.mimeType,
    };
    if (input.name) metadata.name = input.name;
    if (input.parents?.length) metadata.parents = input.parents;
    const boundaryPayload = buildMultipartRelatedBody([
        {
            contentType: "application/json; charset=UTF-8",
            body: JSON.stringify(metadata),
        },
        {
            contentType: `${input.mimeType}; charset=UTF-8`,
            body: input.content,
        },
    ]);
    return boundaryPayload;
}

function parseDriveFileList(items: Array<Record<string, unknown>> | undefined) {
    return (items ?? []).map((file) => ({
        id: typeof file.id === "string" ? file.id : "",
        name: typeof file.name === "string" ? file.name : "",
        mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
        modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : "",
        size: typeof file.size === "string" ? file.size : "",
        parents: Array.isArray(file.parents) ? file.parents : [],
        webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : "",
        trashed: typeof file.trashed === "boolean" ? file.trashed : undefined,
    }));
}

async function driveListFiles(auth: GoogleWorkspaceAuth, input: {
    query?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
    includeTrashed?: boolean;
    corpora?: string;
}) {
    const data = await calendarJson<{
        files?: Array<Record<string, unknown>>;
        nextPageToken?: string;
        incompleteSearch?: boolean;
    }>(
        auth,
        "/drive/v3/files?" +
            new URLSearchParams({
                q: input.query ?? "",
                pageSize: String(input.pageSize ?? 10),
                pageToken: input.pageToken ?? "",
                orderBy: input.orderBy ?? "modifiedTime desc",
                trashed: input.includeTrashed ? "true" : "false",
                corpora: input.corpora ?? "user",
                includeItemsFromAllDrives: "true",
                supportsAllDrives: "true",
                fields: "files(id,name,mimeType,modifiedTime,size,parents,webViewLink,trashed),nextPageToken,incompleteSearch",
            }).toString()
    );
    return {
        nextPageToken: data.nextPageToken ?? null,
        incompleteSearch: data.incompleteSearch ?? false,
        files: parseDriveFileList(data.files),
    };
}

async function driveReadFile(auth: GoogleWorkspaceAuth, input: {
    fileId: string;
    exportMimeType?: string;
    maxChars?: number;
    includeMetadata?: boolean;
}) {
    const metadata = await calendarJson<Record<string, unknown>>(
        auth,
        `/drive/v3/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,modifiedTime,size,webViewLink,parents&supportsAllDrives=true`
    );
    const mimeType = typeof metadata.mimeType === "string" ? metadata.mimeType : "";
    const exportMimeType = input.exportMimeType?.trim() || defaultDriveExportMimeType(mimeType) || "";

    let content = "";
    let bodyMimeType = "";
    if (mimeType.startsWith("application/vnd.google-apps.")) {
        if (!exportMimeType) {
            return {
                metadata: input.includeMetadata === false ? undefined : metadata,
                warning: `No export MIME type available for ${mimeType}`,
                content: "",
                isTruncated: false,
            };
        }
        const exported = await googleText(
            auth,
            resolveGoogleWorkspaceUrl(
                `/drive/v3/files/${encodeURIComponent(input.fileId)}/export?mimeType=${encodeURIComponent(exportMimeType)}`
            ),
            {
                headers: {
                    Accept: exportMimeType,
                },
            }
        );
        content = exported.text;
        bodyMimeType = exported.contentType || exportMimeType;
    } else if (
        mimeType.startsWith("text/") ||
        mimeType.includes("json") ||
        mimeType.includes("xml") ||
        mimeType.includes("csv") ||
        mimeType.includes("markdown") ||
        mimeType.includes("yaml") ||
        mimeType.includes("yml")
    ) {
        const downloaded = await googleText(
            auth,
            resolveGoogleWorkspaceUrl(
                `/drive/v3/files/${encodeURIComponent(input.fileId)}?alt=media&supportsAllDrives=true`
            ),
            {}
        );
        content = downloaded.text;
        bodyMimeType = downloaded.contentType || mimeType;
    } else {
        return {
            metadata: input.includeMetadata === false ? undefined : metadata,
            warning: `Binary or unsupported file type (${mimeType}); use exportMimeType if available.`,
            content: "",
            isTruncated: false,
        };
    }

    const clipped = truncateText(content, input.maxChars ?? TOOL_MAX_TEXT_CHARS);
    return {
        metadata: input.includeMetadata === false ? undefined : metadata,
        exportMimeType: bodyMimeType || exportMimeType || mimeType,
        content: clipped.text,
        isTruncated: clipped.truncated,
    };
}

async function driveWriteTextFile(auth: GoogleWorkspaceAuth, input: {
    fileId?: string;
    name?: string;
    content: string;
    mimeType?: string;
    parentFolderId?: string;
}) {
    const mimeType = input.mimeType?.trim() || "text/plain";
    const hasFileId = Boolean(input.fileId?.trim());
    if (!hasFileId && !input.name?.trim()) {
        throw new Error("name is required when creating a new Drive file");
    }
    const multipart = makeMultipartTextUpload({
        name: input.name?.trim(),
        content: input.content,
        mimeType,
        parents: input.parentFolderId?.trim() ? [input.parentFolderId.trim()] : undefined,
    });

    const path = hasFileId
        ? `/upload/drive/v3/files/${encodeURIComponent(input.fileId!.trim())}?uploadType=multipart&supportsAllDrives=true`
        : "/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";
    const method = hasFileId ? "PATCH" : "POST";
    const result = await calendarJson<Record<string, unknown>>(auth, path, {
        method,
        headers: {
            "Content-Type": `multipart/related; boundary=${multipart.boundary}`,
        },
        body: multipart.body,
    });
    return {
        ok: true,
        id: typeof result.id === "string" ? result.id : input.fileId ?? null,
        name: typeof result.name === "string" ? result.name : input.name ?? null,
        mimeType: typeof result.mimeType === "string" ? result.mimeType : mimeType,
        webViewLink: typeof result.webViewLink === "string" ? result.webViewLink : undefined,
    };
}

async function calendarListCalendars(auth: GoogleWorkspaceAuth, input: { maxResults?: number; showDeleted?: boolean; showHidden?: boolean }) {
    const data = await calendarJson<{ items?: Array<Record<string, unknown>>; nextPageToken?: string }>(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, "/calendar/v3/users/me/calendarList", {
            maxResults: input.maxResults ?? 20,
            showDeleted: input.showDeleted ?? false,
            showHidden: input.showHidden ?? false,
            fields: "items(id,summary,primary,accessRole,selected,hidden,timeZone,backgroundColor,foregroundColor,description),nextPageToken",
        })
    );
    return {
        nextPageToken: data.nextPageToken ?? null,
        calendars: (data.items ?? []).map((calendar) => ({
            id: typeof calendar.id === "string" ? calendar.id : "",
            summary: typeof calendar.summary === "string" ? calendar.summary : "",
            primary: typeof calendar.primary === "boolean" ? calendar.primary : false,
            accessRole: typeof calendar.accessRole === "string" ? calendar.accessRole : "",
            selected: typeof calendar.selected === "boolean" ? calendar.selected : undefined,
            hidden: typeof calendar.hidden === "boolean" ? calendar.hidden : undefined,
            timeZone: typeof calendar.timeZone === "string" ? calendar.timeZone : "",
            description: typeof calendar.description === "string" ? calendar.description : "",
        })),
    };
}

async function calendarFreeBusy(auth: GoogleWorkspaceAuth, input: {
    timeMin: string;
    timeMax: string;
    timeZone?: string;
    calendarIds?: string[];
}) {
    const result = await calendarJson<Record<string, unknown>>(auth, "/calendar/v3/freeBusy", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            timeMin: input.timeMin,
            timeMax: input.timeMax,
            timeZone: input.timeZone ?? calendarDefaultTimeZone(),
            items: (input.calendarIds?.length ? input.calendarIds : ["primary"]).map((id) => ({ id })),
        }),
    });
    return result;
}

async function calendarListEvents(auth: GoogleWorkspaceAuth, input: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
    showDeleted?: boolean;
    singleEvents?: boolean;
    orderBy?: "startTime" | "updated";
    eventTypes?: string[];
}) {
    const calendarId = input.calendarId?.trim() || "primary";
    const data = await calendarJson<{ items?: Array<Record<string, unknown>>; nextPageToken?: string }>(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            timeMin: input.timeMin,
            timeMax: input.timeMax,
            q: input.query,
            maxResults: input.maxResults ?? 20,
            showDeleted: input.showDeleted ?? false,
            singleEvents: input.singleEvents ?? true,
            orderBy: input.orderBy ?? "startTime",
            eventTypes: input.eventTypes?.length ? input.eventTypes.join(",") : undefined,
            fields: "items(id,summary,status,start,end,location,description,attendees,htmlLink,updated,creator,organizer,conferenceData),nextPageToken",
        })
    );
    return {
        calendarId,
        nextPageToken: data.nextPageToken ?? null,
        events: (data.items ?? []).map(normalizeCalendarEvent),
    };
}

async function calendarGetEvent(auth: GoogleWorkspaceAuth, input: { calendarId?: string; eventId: string }) {
    const calendarId = input.calendarId?.trim() || "primary";
    return await calendarJson<Record<string, unknown>>(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, {
            fields: "id,summary,status,start,end,location,description,attendees,htmlLink,updated,creator,organizer,conferenceData",
        })
    );
}

async function calendarCreateEvent(auth: GoogleWorkspaceAuth, input: {
    calendarId?: string;
    summary: string;
    description?: string;
    location?: string;
    start: string | Record<string, unknown>;
    end: string | Record<string, unknown>;
    attendees?: string[];
    sendUpdates?: "all" | "externalOnly" | "none";
    transparency?: "opaque" | "transparent";
    visibility?: "default" | "public" | "private" | "confidential";
    recurrence?: string[];
    colorId?: string;
    conferenceData?: boolean;
    reminders?: { useDefault?: boolean; overrides?: Array<{ method: "email" | "popup"; minutes: number }> };
}) {
    const calendarId = input.calendarId?.trim() || "primary";
    const body: Record<string, unknown> = {
        summary: input.summary,
        start: normalizeCalendarTimeBlock(input.start, calendarDefaultTimeZone()),
        end: normalizeCalendarTimeBlock(input.end, calendarDefaultTimeZone()),
    };
    if (input.description) body.description = input.description;
    if (input.location) body.location = input.location;
    if (input.attendees?.length) body.attendees = input.attendees.map((email) => ({ email }));
    if (input.transparency) body.transparency = input.transparency;
    if (input.visibility) body.visibility = input.visibility;
    if (input.recurrence?.length) body.recurrence = input.recurrence;
    if (input.colorId) body.colorId = input.colorId;
    if (input.reminders) body.reminders = input.reminders;
    const query = {
        sendUpdates: input.sendUpdates ?? "all",
        conferenceDataVersion: input.conferenceData ? 1 : undefined,
    };
    if (input.conferenceData) {
        body.conferenceData = {
            createRequest: {
                requestId: `kletron-${randomUUID()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
            },
        };
    }
    const created = await calendarJson<Record<string, unknown>>(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, query),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
    );
    return normalizeCalendarEvent(created);
}

async function calendarUpdateEvent(auth: GoogleWorkspaceAuth, input: {
    calendarId?: string;
    eventId: string;
    patch: Record<string, unknown>;
    sendUpdates?: "all" | "externalOnly" | "none";
}) {
    const calendarId = input.calendarId?.trim() || "primary";
    const updated = await calendarJson<Record<string, unknown>>(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, {
            sendUpdates: input.sendUpdates ?? "all",
            conferenceDataVersion: input.patch.conferenceData ? 1 : undefined,
        }),
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input.patch),
        }
    );
    return normalizeCalendarEvent(updated);
}

async function calendarDeleteEvent(auth: GoogleWorkspaceAuth, input: {
    calendarId?: string;
    eventId: string;
    sendUpdates?: "all" | "externalOnly" | "none";
}) {
    const calendarId = input.calendarId?.trim() || "primary";
    const response = await googleAuthorizedFetch(
        auth,
        buildGoogleUrl(GOOGLE_API_BASE, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, {
            sendUpdates: input.sendUpdates ?? "all",
        }),
        {
            method: "DELETE",
        }
    );
    return {
        ok: true,
        calendarId,
        eventId: input.eventId,
        status: response.status,
    };
}

export function buildGoogleWorkspaceTools(workspaceId?: string): any[] {
    const buildAuth = async (providerId: GoogleWorkspaceProviderId) => resolveGoogleAuth(workspaceId, providerId);

    const gmailListLabelsTool = tool(
        async () => {
            const auth = await buildAuth("gmail");
            const result = await googleJson<Record<string, unknown>>(
                auth,
                `${GMAIL_BASE}/gmail/v1/users/me/labels?fields=labels(id,name,type,messageListVisibility,labelListVisibility)`
            );
            return jsonResult({
                labels: Array.isArray(result.labels)
                    ? result.labels.map((label) => ({
                          id: typeof label.id === "string" ? label.id : "",
                          name: typeof label.name === "string" ? label.name : "",
                          type: typeof label.type === "string" ? label.type : "",
                          messageListVisibility: typeof label.messageListVisibility === "string" ? label.messageListVisibility : "",
                          labelListVisibility: typeof label.labelListVisibility === "string" ? label.labelListVisibility : "",
                      }))
                    : [],
            });
        },
        {
            name: "gmail_list_labels",
            description: "List Gmail labels in the connected mailbox.",
            schema: z.object({}),
        }
    );

    const gmailSearchMessagesTool = tool(
        async (input: { query?: string; maxResults?: number; includeSpamTrash?: boolean; pageToken?: string }) => {
            const auth = await buildAuth("gmail");
            const result = await gmailListMessages(auth, {
                query: input.query,
                maxResults: input.maxResults ?? 10,
                includeSpamTrash: input.includeSpamTrash ?? false,
                pageToken: input.pageToken,
            });
            return jsonResult(result);
        },
        {
            name: "gmail_search_messages",
            description: "Search Gmail messages using Gmail query syntax and return concise message summaries.",
            schema: z.object({
                query: z.string().optional(),
                maxResults: z.number().int().positive().max(50).optional(),
                includeSpamTrash: z.boolean().optional(),
                pageToken: z.string().optional(),
            }),
        }
    );

    const gmailReadMessageTool = tool(
        async (input: { messageId: string; format?: "full" | "metadata" }) => {
            const auth = await buildAuth("gmail");
            const message = await gmailFetchMessage(auth, input.messageId, input.format ?? "full");
            const payload = (message.payload as Record<string, unknown> | undefined) ?? {};
            const headers = Array.isArray(payload.headers) ? (payload.headers as Array<{ name?: string; value?: string }>) : [];
            const bodyText = input.format === "metadata" ? "" : extractGmailText(payload as any);
            const clipped = truncateText(bodyText, TOOL_MAX_TEXT_CHARS);
            return jsonResult({
                id: typeof message.id === "string" ? message.id : input.messageId,
                threadId: typeof message.threadId === "string" ? message.threadId : "",
                labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
                snippet: typeof message.snippet === "string" ? message.snippet : "",
                historyId: typeof message.historyId === "string" ? message.historyId : "",
                internalDate: typeof message.internalDate === "string" ? message.internalDate : "",
                subject: getGmailHeader(headers, "Subject"),
                from: getGmailHeader(headers, "From"),
                to: getGmailHeader(headers, "To"),
                cc: getGmailHeader(headers, "Cc"),
                bcc: getGmailHeader(headers, "Bcc"),
                date: getGmailHeader(headers, "Date"),
                bodyText: clipped.text,
                bodyTruncated: clipped.truncated,
            });
        },
        {
            name: "gmail_read_message",
            description: "Read a Gmail message by id and return headers plus extracted body text.",
            schema: z.object({
                messageId: z.string().min(1),
                format: z.enum(["full", "metadata"]).optional(),
            }),
        }
    );

    const gmailModifyLabelsTool = tool(
        async (input: { messageId: string; addLabelIds?: string[]; removeLabelIds?: string[] }) => {
            const auth = await buildAuth("gmail");
            return jsonResult(
                await gmailModifyLabels(auth, {
                    messageId: input.messageId,
                    addLabelIds: input.addLabelIds ?? [],
                    removeLabelIds: input.removeLabelIds ?? [],
                })
            );
        },
        {
            name: "gmail_modify_message_labels",
            description: "Add or remove Gmail labels on a message.",
            schema: z.object({
                messageId: z.string().min(1),
                addLabelIds: z.array(z.string()).optional(),
                removeLabelIds: z.array(z.string()).optional(),
            }),
        }
    );

    const gmailSendMessageTool = tool(
        async (input: {
            to: string | string[];
            subject?: string;
            body: string;
            cc?: string | string[];
            bcc?: string | string[];
            threadId?: string;
            replyToMessageId?: string;
            contentType?: "text/plain" | "text/html";
        }) => {
            const auth = await buildAuth("gmail");
            return jsonResult(
                await gmailSendOrDraftMessage(auth, {
                    ...input,
                    draft: false,
                })
            );
        },
        {
            name: "gmail_send_message",
            description: "Send an email from Gmail. Provide recipients, subject, and body. Optionally reply in-thread.",
            schema: z.object({
                to: addressListSchema,
                subject: z.string().optional(),
                body: z.string().min(1),
                cc: addressListSchema.optional(),
                bcc: addressListSchema.optional(),
                threadId: z.string().optional(),
                replyToMessageId: z.string().optional(),
                contentType: z.enum(["text/plain", "text/html"]).optional(),
            }),
        }
    );

    const gmailCreateDraftTool = tool(
        async (input: {
            to: string | string[];
            subject?: string;
            body: string;
            cc?: string | string[];
            bcc?: string | string[];
            threadId?: string;
            replyToMessageId?: string;
            contentType?: "text/plain" | "text/html";
        }) => {
            const auth = await buildAuth("gmail");
            return jsonResult(
                await gmailSendOrDraftMessage(auth, {
                    ...input,
                    draft: true,
                })
            );
        },
        {
            name: "gmail_create_draft",
            description: "Create a Gmail draft. Provide recipients, subject, and body. Optionally reply in-thread.",
            schema: z.object({
                to: addressListSchema,
                subject: z.string().optional(),
                body: z.string().min(1),
                cc: addressListSchema.optional(),
                bcc: addressListSchema.optional(),
                threadId: z.string().optional(),
                replyToMessageId: z.string().optional(),
                contentType: z.enum(["text/plain", "text/html"]).optional(),
            }),
        }
    );

    const calendarListCalendarsTool = tool(
        async (input: { maxResults?: number; showDeleted?: boolean; showHidden?: boolean }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(
                await calendarListCalendars(auth, {
                    maxResults: input.maxResults ?? 20,
                    showDeleted: input.showDeleted ?? false,
                    showHidden: input.showHidden ?? false,
                })
            );
        },
        {
            name: "calendar_list_calendars",
            description: "List the connected Google Calendar calendars.",
            schema: z.object({
                maxResults: z.number().int().positive().max(100).optional(),
                showDeleted: z.boolean().optional(),
                showHidden: z.boolean().optional(),
            }),
        }
    );

    const calendarFreeBusyTool = tool(
        async (input: { timeMin: string; timeMax: string; timeZone?: string; calendarIds?: string[] }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(
                await calendarFreeBusy(auth, {
                    timeMin: input.timeMin,
                    timeMax: input.timeMax,
                    timeZone: input.timeZone,
                    calendarIds: input.calendarIds,
                })
            );
        },
        {
            name: "calendar_freebusy",
            description: "Query free/busy availability for one or more Google calendars.",
            schema: z.object({
                timeMin: z.string().min(1),
                timeMax: z.string().min(1),
                timeZone: z.string().optional(),
                calendarIds: z.array(z.string()).optional(),
            }),
        }
    );

    const calendarListEventsTool = tool(
        async (input: {
            calendarId?: string;
            timeMin?: string;
            timeMax?: string;
            maxResults?: number;
            query?: string;
            showDeleted?: boolean;
            singleEvents?: boolean;
            orderBy?: "startTime" | "updated";
            eventTypes?: string[];
        }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(await calendarListEvents(auth, input));
        },
        {
            name: "calendar_list_events",
            description: "List Google Calendar events for a calendar and time window.",
            schema: z.object({
                calendarId: z.string().optional(),
                timeMin: z.string().optional(),
                timeMax: z.string().optional(),
                maxResults: z.number().int().positive().max(100).optional(),
                query: z.string().optional(),
                showDeleted: z.boolean().optional(),
                singleEvents: z.boolean().optional(),
                orderBy: z.enum(["startTime", "updated"]).optional(),
                eventTypes: z.array(z.string()).optional(),
            }),
        }
    );

    const calendarGetEventTool = tool(
        async (input: { calendarId?: string; eventId: string }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(await calendarGetEvent(auth, input));
        },
        {
            name: "calendar_get_event",
            description: "Fetch a specific Google Calendar event by id.",
            schema: z.object({
                calendarId: z.string().optional(),
                eventId: z.string().min(1),
            }),
        }
    );

    const calendarCreateEventTool = tool(
        async (input: {
            calendarId?: string;
            summary: string;
            description?: string;
            location?: string;
            start: string | Record<string, unknown>;
            end: string | Record<string, unknown>;
            attendees?: string[];
            sendUpdates?: "all" | "externalOnly" | "none";
            transparency?: "opaque" | "transparent";
            visibility?: "default" | "public" | "private" | "confidential";
            recurrence?: string[];
            colorId?: string;
            conferenceData?: boolean;
            reminders?: { useDefault?: boolean; overrides?: Array<{ method: "email" | "popup"; minutes: number }> };
        }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(await calendarCreateEvent(auth, input));
        },
        {
            name: "calendar_create_event",
            description: "Create a Google Calendar event.",
            schema: z.object({
                calendarId: z.string().optional(),
                summary: z.string().min(1),
                description: z.string().optional(),
                location: z.string().optional(),
                start: z.union([
                    z.string(),
                    z.object({
                        dateTime: z.string().optional(),
                        date: z.string().optional(),
                        timeZone: z.string().optional(),
                    }),
                ]),
                end: z.union([
                    z.string(),
                    z.object({
                        dateTime: z.string().optional(),
                        date: z.string().optional(),
                        timeZone: z.string().optional(),
                    }),
                ]),
                attendees: z.array(z.string()).optional(),
                sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
                transparency: z.enum(["opaque", "transparent"]).optional(),
                visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
                recurrence: z.array(z.string()).optional(),
                colorId: z.string().optional(),
                conferenceData: z.boolean().optional(),
                reminders: z
                    .object({
                        useDefault: z.boolean().optional(),
                        overrides: z.array(
                            z.object({
                                method: z.enum(["email", "popup"]),
                                minutes: z.number().int().nonnegative(),
                            })
                        ).optional(),
                    })
                    .optional(),
            }),
        }
    );

    const calendarUpdateEventTool = tool(
        async (input: {
            calendarId?: string;
            eventId: string;
            patch: Record<string, unknown>;
            sendUpdates?: "all" | "externalOnly" | "none";
        }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(await calendarUpdateEvent(auth, input));
        },
        {
            name: "calendar_update_event",
            description: "Patch an existing Google Calendar event.",
            schema: z.object({
                calendarId: z.string().optional(),
                eventId: z.string().min(1),
                patch: z.record(z.any()),
                sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
            }),
        }
    );

    const calendarDeleteEventTool = tool(
        async (input: { calendarId?: string; eventId: string; sendUpdates?: "all" | "externalOnly" | "none" }) => {
            const auth = await buildAuth("google-calendar");
            return jsonResult(await calendarDeleteEvent(auth, input));
        },
        {
            name: "calendar_delete_event",
            description: "Delete a Google Calendar event.",
            schema: z.object({
                calendarId: z.string().optional(),
                eventId: z.string().min(1),
                sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
            }),
        }
    );

    const driveListFilesTool = tool(
        async (input: {
            query?: string;
            pageSize?: number;
            pageToken?: string;
            orderBy?: string;
            includeTrashed?: boolean;
            corpora?: string;
        }) => {
            const auth = await buildAuth("google-drive");
            return jsonResult(
                await driveListFiles(auth, {
                    query: input.query,
                    pageSize: input.pageSize ?? 10,
                    pageToken: input.pageToken,
                    orderBy: input.orderBy,
                    includeTrashed: input.includeTrashed ?? false,
                    corpora: input.corpora ?? "user",
                })
            );
        },
        {
            name: "drive_list_files",
            description: "List files in Google Drive and optionally filter with a Drive query.",
            schema: z.object({
                query: z.string().optional(),
                pageSize: z.number().int().positive().max(1000).optional(),
                pageToken: z.string().optional(),
                orderBy: z.string().optional(),
                includeTrashed: z.boolean().optional(),
                corpora: z.string().optional(),
            }),
        }
    );

    const driveReadFileTool = tool(
        async (input: {
            fileId: string;
            exportMimeType?: string;
            maxChars?: number;
            includeMetadata?: boolean;
        }) => {
            const auth = await buildAuth("google-drive");
            return jsonResult(
                await driveReadFile(auth, {
                    fileId: input.fileId,
                    exportMimeType: input.exportMimeType,
                    maxChars: input.maxChars ?? TOOL_MAX_TEXT_CHARS,
                    includeMetadata: input.includeMetadata ?? true,
                })
            );
        },
        {
            name: "drive_read_file",
            description: "Read a Google Drive file. Workspace docs are exported to text when possible.",
            schema: z.object({
                fileId: z.string().min(1),
                exportMimeType: z.string().optional(),
                maxChars: z.number().int().positive().max(100_000).optional(),
                includeMetadata: z.boolean().optional(),
            }),
        }
    );

    const driveWriteTextFileTool = tool(
        async (input: {
            fileId?: string;
            name?: string;
            content: string;
            mimeType?: string;
            parentFolderId?: string;
        }) => {
            const auth = await buildAuth("google-drive");
            return jsonResult(await driveWriteTextFile(auth, input));
        },
        {
            name: "drive_write_text_file",
            description: "Create or update a text-based file in Google Drive.",
            schema: z.object({
                fileId: z.string().optional(),
                name: z.string().optional(),
                content: z.string().min(1),
                mimeType: z.string().optional(),
                parentFolderId: z.string().optional(),
            }),
        }
    );

    return [
        gmailListLabelsTool,
        gmailSearchMessagesTool,
        gmailReadMessageTool,
        gmailModifyLabelsTool,
        gmailCreateDraftTool,
        gmailSendMessageTool,
        calendarListCalendarsTool,
        calendarFreeBusyTool,
        calendarListEventsTool,
        calendarGetEventTool,
        calendarCreateEventTool,
        calendarUpdateEventTool,
        calendarDeleteEventTool,
        driveListFilesTool,
        driveReadFileTool,
        driveWriteTextFileTool,
    ];
}

export { probeGoogleWorkspaceConnection };
