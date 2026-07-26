// At-rest protection and endpoint validation for the instance LLM config.
//
// Two concerns live here:
//
//  1. Provider credentials (`apiKey`, `credentialsJson`) used to be stored as
//     plaintext in Mongo and in config/config.json. They are sealed with the
//     project's AES-256-GCM helper before persistence and opened on read.
//
//  2. `baseUrl` / `endpoint` decide where prompts are sent. A caller able to
//     write the config can otherwise repoint the instance at a host they
//     control and capture every prompt, or aim it at link-local metadata
//     services. Both are validated here.

import { decryptSecret, encryptSecret, type EncryptedSecret } from "../lib/crypto/secrets";

/** Marker identifying a sealed value; anything without it is treated as legacy plaintext. */
const SEALED_PREFIX = "enc:v1:";

/** Config keys holding credentials, sealed on write and opened on read. */
const SECRET_FIELDS = ["apiKey", "credentialsJson"] as const;

/** Config keys holding an endpoint the runtime will send prompts to. */
const ENDPOINT_FIELDS = ["baseUrl", "endpoint"] as const;

export function isSealed(value: unknown): boolean {
    return typeof value === "string" && value.startsWith(SEALED_PREFIX);
}

export function seal(plaintext: string): string {
    const payload: EncryptedSecret = encryptSecret(plaintext);
    return SEALED_PREFIX + Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Open a sealed value. Values without the marker are returned unchanged so
 * configs written before encryption existed keep working; they are sealed the
 * next time the provider is saved.
 */
export function open(value: string): string {
    if (!isSealed(value)) return value;
    const raw = Buffer.from(value.slice(SEALED_PREFIX.length), "base64").toString("utf8");
    return decryptSecret(JSON.parse(raw) as EncryptedSecret);
}

/** Hosts that must never be used as an LLM endpoint, whatever the allowlist says. */
const BLOCKED_ENDPOINT_HOSTS = new Set([
    "169.254.169.254", // AWS / Azure / GCP instance metadata
    "metadata.google.internal",
    "metadata",
]);

function isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (BLOCKED_ENDPOINT_HOSTS.has(host)) return true;
    // Entire link-local range, which fronts cloud metadata on every provider.
    if (/^169\.254\./.test(host)) return true;
    return false;
}

/**
 * Optional deployment-level restriction:
 *   LLM_ALLOWED_ENDPOINT_HOSTS="api.openai.com,my-proxy.internal"
 * When unset, any non-blocked http(s) host is accepted.
 */
function allowedHosts(): string[] {
    const raw = process.env.LLM_ALLOWED_ENDPOINT_HOSTS;
    if (!raw) return [];
    return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export class LlmEndpointNotAllowedError extends Error {}

/** Throws {@link LlmEndpointNotAllowedError} when the URL may not be used as an endpoint. */
export function assertEndpointAllowed(field: string, value: string): void {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new LlmEndpointNotAllowedError(`${field} is not a valid URL.`);
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new LlmEndpointNotAllowedError(
            `${field} must use http or https (got ${url.protocol.replace(":", "")}).`
        );
    }

    if (isBlockedHost(url.hostname)) {
        throw new LlmEndpointNotAllowedError(
            `${field} points at a link-local or metadata address (${url.hostname}), which is not permitted.`
        );
    }

    const allowlist = allowedHosts();
    if (allowlist.length > 0 && !allowlist.includes(url.hostname.toLowerCase())) {
        throw new LlmEndpointNotAllowedError(
            `${field} host "${url.hostname}" is not in LLM_ALLOWED_ENDPOINT_HOSTS.`
        );
    }
}

type ProviderConfig = Record<string, unknown>;

/**
 * Validate every endpoint declared by the provider block being written.
 * Applied only to the block under change, so an unrelated pre-existing value
 * cannot block an otherwise valid save.
 */
export function assertProviderEndpoints(providerKey: string, providerConfig: unknown): void {
    if (!providerConfig || typeof providerConfig !== "object") return;
    const source = providerConfig as ProviderConfig;

    for (const field of ENDPOINT_FIELDS) {
        const value = source[field];
        if (typeof value === "string" && value.trim()) {
            assertEndpointAllowed(`${providerKey}.${field}`, value.trim());
        }
    }
}

/** Seal the credential fields of one provider block. Already-sealed values pass through. */
function sealSecretFields(providerConfig: unknown): unknown {
    if (!providerConfig || typeof providerConfig !== "object" || Array.isArray(providerConfig)) {
        return providerConfig;
    }
    const out: ProviderConfig = { ...(providerConfig as ProviderConfig) };
    for (const field of SECRET_FIELDS) {
        const value = out[field];
        if (typeof value === "string" && value.trim() && !isSealed(value)) {
            out[field] = seal(value);
        }
    }
    return out;
}

/**
 * Seal credentials across the whole document, for persistence.
 *
 * This must run over *every* provider block, not just the one being edited:
 * the in-memory config is decrypted, so writing it back verbatim would rewrite
 * the other providers' credentials as plaintext.
 */
export function sealConfigSecrets<T extends Record<string, unknown>>(config: T): T {
    const out: Record<string, unknown> = { ...config };
    for (const [key, value] of Object.entries(out)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        out[key] = sealSecretFields(value);
    }
    return out as T;
}

/**
 * Open every sealed credential in a whole config document.
 * A value that fails to decrypt (rotated key, corrupt record) is dropped rather
 * than surfaced as ciphertext that would be sent to a provider as an API key.
 */
export function openConfigSecrets<T extends Record<string, unknown>>(config: T): T {
    const out: Record<string, unknown> = { ...config };

    for (const [key, value] of Object.entries(out)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const provider = { ...(value as ProviderConfig) };
        let changed = false;

        for (const field of SECRET_FIELDS) {
            const stored = provider[field];
            if (typeof stored === "string" && isSealed(stored)) {
                try {
                    provider[field] = open(stored);
                } catch {
                    console.error(
                        `[LLM Config] Failed to decrypt ${key}.${field}. ` +
                            `KLETRON_ENCRYPTION_KEY may have changed; re-enter the credential.`
                    );
                    delete provider[field];
                }
                changed = true;
            }
        }

        if (changed) out[key] = provider;
    }

    return out as T;
}
