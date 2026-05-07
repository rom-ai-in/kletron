// AES-256-GCM secret encryption helper.
// Used to encrypt connector credentials at rest in MongoDB.
//
// Key resolution:
//   1. KLETRON_ENCRYPTION_KEY env var (32-byte key, hex or base64).
//   2. NEXTAUTH_SECRET as a fallback (hashed to 32 bytes), so existing dev
//      installs without an explicit key still get deterministic encryption.
//
// Wire format: { v: 1, iv, tag, ciphertext } as base64url strings.

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 1;

let cachedKey: Buffer | null = null;

function decodeKeyMaterial(raw: string): Buffer | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // hex (64 chars)
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, "hex");
    }
    // base64 (44 chars padded, 43 unpadded for 32 bytes)
    try {
        const buf = Buffer.from(trimmed, "base64");
        if (buf.length === KEY_BYTES) return buf;
    } catch {
        // ignore
    }
    return null;
}

/** Same 32-byte material as {@link encryptSecret} — also used for HMAC signing (e.g. local MCP bearer tokens). */
export function getKletronSymmetricKeyBytes(): Buffer {
    return getKey();
}

function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const explicit = process.env.KLETRON_ENCRYPTION_KEY;
    if (explicit) {
        const decoded = decodeKeyMaterial(explicit);
        if (decoded) {
            cachedKey = decoded;
            return cachedKey;
        }
        // Fall back: hash arbitrary string into a 32-byte key.
        cachedKey = createHash("sha256").update(explicit).digest();
        return cachedKey;
    }
    const fallback = process.env.NEXTAUTH_SECRET;
    if (fallback) {
        cachedKey = createHash("sha256").update(`kletron-secrets:${fallback}`).digest();
        return cachedKey;
    }
    throw new Error(
        "Encryption key not configured. Set KLETRON_ENCRYPTION_KEY (32-byte hex or base64) or NEXTAUTH_SECRET."
    );
}

export interface EncryptedSecret {
    v: number;
    iv: string;
    tag: string;
    ct: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
    const key = getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
        v: VERSION,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ct: ct.toString("base64"),
    };
}

export function decryptSecret(payload: EncryptedSecret): string {
    if (!payload || payload.v !== VERSION) {
        throw new Error(`Unsupported encrypted secret version: ${payload?.v}`);
    }
    const key = getKey();
    const iv = Buffer.from(payload.iv, "base64");
    const tag = Buffer.from(payload.tag, "base64");
    const ct = Buffer.from(payload.ct, "base64");
    if (iv.length !== IV_BYTES) {
        throw new Error(`Invalid IV length: ${iv.length}`);
    }
    if (tag.length !== TAG_BYTES) {
        throw new Error(`Invalid auth tag length: ${tag.length}`);
    }
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString("utf8");
}

export function encryptJson<T>(value: T): EncryptedSecret {
    return encryptSecret(JSON.stringify(value ?? null));
}

export function decryptJson<T>(payload: EncryptedSecret): T {
    return JSON.parse(decryptSecret(payload)) as T;
}

/** Mask a string for logging or response previews (keeps first/last 2 chars). */
export function maskSecret(value: string | null | undefined): string {
    if (!value) return "";
    if (value.length <= 6) return "*".repeat(value.length);
    return `${value.slice(0, 2)}${"*".repeat(value.length - 4)}${value.slice(-2)}`;
}

/** For tests only. */
export function _resetKeyCacheForTests() {
    cachedKey = null;
}
