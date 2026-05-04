import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KDF_SALT = "kletron-channel-secrets-v1";

function getDerivedKey(): Buffer {
    const raw = process.env.KLETRON_CHANNEL_SECRETS_KEY?.trim();
    if (!raw) {
        throw new Error(
            "KLETRON_CHANNEL_SECRETS_KEY is not set. Set a long random secret in the server environment to encrypt channel tokens."
        );
    }
    return scryptSync(raw, KDF_SALT, 32);
}

/** Encrypt arbitrary UTF-8 string (e.g. bot token). */
export function encryptChannelSecret(plain: string): string {
    const key = getDerivedKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptChannelSecret(payload: string): string {
    const key = getDerivedKey();
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** True if encryption can run (key present). */
export function isChannelSecretsEncryptionConfigured(): boolean {
    return Boolean(process.env.KLETRON_CHANNEL_SECRETS_KEY?.trim());
}
