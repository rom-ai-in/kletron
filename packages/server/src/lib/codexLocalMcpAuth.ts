import { createHmac, timingSafeEqual } from "node:crypto";

import { getKletronSymmetricKeyBytes } from "./crypto/secrets";

const VERSION = 1 as const;

/** Hard cap so env misconfiguration cannot mint multi-year tokens. */
const MAX_TTL_SEC = 48 * 3600;

export type LocalMcpTokenPayload = {
    userId: string;
    workspaceId: string;
    exp: number;
};

function b64urlEncode(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function b64urlDecodeToBuffer(s: string): Buffer | null {
    const trimmed = s?.trim() ?? "";
    if (!trimmed) return null;
    const pad = 4 - (trimmed.length % 4);
    const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/") + (pad === 4 ? "" : "=".repeat(pad));
    try {
        return Buffer.from(b64, "base64");
    } catch {
        return null;
    }
}

/**
 * Short-lived bearer for `/api/mcp/workspace/[workspaceId]` (Streamable HTTP).
 * Signed with the same symmetric key as connector encryption ({@link getKletronSymmetricKeyBytes}).
 * {@link ttlSec} is clamped to 48h maximum regardless of caller.
 */
export function issueLocalMcpToken(input: { userId: string; workspaceId: string; ttlSec: number }): string {
    const { userId, workspaceId, ttlSec } = input;
    if (!userId?.trim() || !workspaceId?.trim() || !Number.isFinite(ttlSec) || ttlSec <= 0) {
        throw new Error("issueLocalMcpToken: userId, workspaceId and positive ttlSec are required");
    }
    const ttl = Math.min(Math.floor(ttlSec), MAX_TTL_SEC);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payload: LocalMcpTokenPayload = {
        userId: userId.trim(),
        workspaceId: workspaceId.trim(),
        exp,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = b64urlEncode(Buffer.from(payloadJson, "utf8"));
    const key = getKletronSymmetricKeyBytes();
    const mac = createHmac("sha256", key).update(`${VERSION}|${payloadB64}`, "utf8").digest();
    const sigB64 = b64urlEncode(mac);
    return `${VERSION}.${payloadB64}.${sigB64}`;
}

/** Parses and verifies a token from `Authorization: Bearer …`. Returns payload or null. */
export function verifyLocalMcpToken(token: string | undefined | null): LocalMcpTokenPayload | null {
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) return null;

    const withoutBearer = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
    const parts = withoutBearer.split(".");
    if (parts.length !== 3) return null;

    const [verStr, payloadB64, sigB64] = parts;
    if (verStr !== String(VERSION)) return null;

    const sigGot = b64urlDecodeToBuffer(sigB64 ?? "");
    if (!sigGot || sigGot.length === 0) return null;

    const key = getKletronSymmetricKeyBytes();
    const macExpected = createHmac("sha256", key).update(`${VERSION}|${payloadB64}`, "utf8").digest();
    if (sigGot.length !== macExpected.length || !timingSafeEqual(sigGot, macExpected)) {
        return null;
    }

    const payloadBuf = b64urlDecodeToBuffer(payloadB64 ?? "");
    if (!payloadBuf) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(payloadBuf.toString("utf8"));
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const userId = typeof o.userId === "string" ? o.userId.trim() : "";
    const workspaceId = typeof o.workspaceId === "string" ? o.workspaceId.trim() : "";
    const exp = typeof o.exp === "number" && Number.isFinite(o.exp) ? o.exp : 0;
    if (!userId || !workspaceId || !exp) return null;

    if (Math.floor(Date.now() / 1000) > exp) {
        return null;
    }

    return { userId, workspaceId, exp };
}
