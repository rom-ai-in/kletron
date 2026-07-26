import { beforeEach, afterEach, describe, expect, it } from "vitest";

import {
    assertEndpointAllowed,
    assertProviderEndpoints,
    isSealed,
    LlmEndpointNotAllowedError,
    open,
    openConfigSecrets,
    seal,
    sealConfigSecrets,
} from "@kletron/server/services/llmConfigSecrets";
import { _resetKeyCacheForTests } from "@kletron/server/lib/crypto/secrets";

const TEST_KEY = "0".repeat(64); // 32 bytes, hex

let previousKey: string | undefined;
let previousAllowlist: string | undefined;

beforeEach(() => {
    previousKey = process.env.KLETRON_ENCRYPTION_KEY;
    previousAllowlist = process.env.LLM_ALLOWED_ENDPOINT_HOSTS;
    process.env.KLETRON_ENCRYPTION_KEY = TEST_KEY;
    delete process.env.LLM_ALLOWED_ENDPOINT_HOSTS;
    _resetKeyCacheForTests();
});

afterEach(() => {
    if (previousKey === undefined) delete process.env.KLETRON_ENCRYPTION_KEY;
    else process.env.KLETRON_ENCRYPTION_KEY = previousKey;
    if (previousAllowlist === undefined) delete process.env.LLM_ALLOWED_ENDPOINT_HOSTS;
    else process.env.LLM_ALLOWED_ENDPOINT_HOSTS = previousAllowlist;
    _resetKeyCacheForTests();
});

describe("seal / open", () => {
    it("round-trips a secret without storing it in the clear", () => {
        const sealed = seal("sk-live-abcdef");
        expect(sealed).not.toContain("sk-live-abcdef");
        expect(isSealed(sealed)).toBe(true);
        expect(open(sealed)).toBe("sk-live-abcdef");
    });

    it("produces a different ciphertext each time (random IV)", () => {
        expect(seal("same-value")).not.toBe(seal("same-value"));
    });

    it("passes through legacy plaintext so pre-encryption configs keep working", () => {
        expect(isSealed("sk-plaintext")).toBe(false);
        expect(open("sk-plaintext")).toBe("sk-plaintext");
    });
});

describe("sealConfigSecrets", () => {
    const config = {
        provider: "openai",
        openai: { apiKey: "k-openai", baseUrl: "https://api.openai.com/v1" },
        claude: { apiKey: "k-claude" },
        vertex: { credentialsJson: '{"type":"service_account"}' },
        lmstudio: { baseUrl: "http://localhost:1234" },
    };

    // The in-memory config is decrypted, so a write path that only sealed the
    // edited provider would rewrite every other credential as plaintext.
    it("seals credentials across every provider block, not just one", () => {
        const sealed = sealConfigSecrets(config) as typeof config;
        const serialized = JSON.stringify(sealed);
        expect(serialized).not.toContain("k-openai");
        expect(serialized).not.toContain("k-claude");
        expect(serialized).not.toContain("service_account");
    });

    it("leaves non-secret fields untouched", () => {
        const sealed = sealConfigSecrets(config) as typeof config;
        expect(sealed.provider).toBe("openai");
        expect(sealed.lmstudio.baseUrl).toBe("http://localhost:1234");
        expect(sealed.openai.baseUrl).toBe("https://api.openai.com/v1");
    });

    it("round-trips through openConfigSecrets", () => {
        const reopened = openConfigSecrets(sealConfigSecrets(config)) as typeof config;
        expect(reopened.openai.apiKey).toBe("k-openai");
        expect(reopened.claude.apiKey).toBe("k-claude");
        expect(reopened.vertex.credentialsJson).toBe('{"type":"service_account"}');
    });

    it("is idempotent — sealing twice does not double-encrypt", () => {
        const once = sealConfigSecrets(config);
        const twice = sealConfigSecrets(once);
        expect(openConfigSecrets(twice)).toEqual(openConfigSecrets(once));
    });

    it("drops a credential that cannot be decrypted rather than leaking ciphertext", () => {
        const sealed = sealConfigSecrets(config) as Record<string, any>;
        _resetKeyCacheForTests();
        process.env.KLETRON_ENCRYPTION_KEY = "1".repeat(64); // rotated key
        const reopened = openConfigSecrets(sealed) as Record<string, any>;
        expect(reopened.openai.apiKey).toBeUndefined();
    });
});

describe("assertEndpointAllowed", () => {
    it("accepts ordinary http(s) endpoints", () => {
        expect(() => assertEndpointAllowed("baseUrl", "https://api.openai.com/v1")).not.toThrow();
        expect(() => assertEndpointAllowed("baseUrl", "http://localhost:1234")).not.toThrow();
    });

    // A caller who can set baseUrl could otherwise reach cloud metadata and
    // mint credentials for the instance's service account.
    it("rejects link-local and metadata addresses", () => {
        for (const url of [
            "http://169.254.169.254/latest/meta-data/",
            "http://169.254.170.2/v2/credentials",
            "http://metadata.google.internal/computeMetadata/v1/",
        ]) {
            expect(() => assertEndpointAllowed("baseUrl", url)).toThrow(LlmEndpointNotAllowedError);
        }
    });

    it("rejects non-http schemes and malformed URLs", () => {
        expect(() => assertEndpointAllowed("baseUrl", "file:///etc/passwd")).toThrow(
            LlmEndpointNotAllowedError
        );
        expect(() => assertEndpointAllowed("baseUrl", "not-a-url")).toThrow(
            LlmEndpointNotAllowedError
        );
    });

    it("enforces LLM_ALLOWED_ENDPOINT_HOSTS when set", () => {
        process.env.LLM_ALLOWED_ENDPOINT_HOSTS = "api.openai.com, proxy.internal";
        expect(() => assertEndpointAllowed("baseUrl", "https://api.openai.com/v1")).not.toThrow();
        expect(() => assertEndpointAllowed("baseUrl", "https://proxy.internal/v1")).not.toThrow();
        expect(() => assertEndpointAllowed("baseUrl", "https://attacker.example/v1")).toThrow(
            LlmEndpointNotAllowedError
        );
    });
});

describe("assertProviderEndpoints", () => {
    it("validates both baseUrl and endpoint fields", () => {
        expect(() =>
            assertProviderEndpoints("openai", { baseUrl: "http://169.254.169.254" })
        ).toThrow(LlmEndpointNotAllowedError);
        expect(() =>
            assertProviderEndpoints("azure", { endpoint: "http://169.254.169.254" })
        ).toThrow(LlmEndpointNotAllowedError);
    });

    it("ignores providers that declare no endpoint", () => {
        expect(() => assertProviderEndpoints("claude", { apiKey: "k" })).not.toThrow();
        expect(() => assertProviderEndpoints("claude", undefined)).not.toThrow();
    });
});
