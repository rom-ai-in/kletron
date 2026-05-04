import { before, describe, it } from "node:test";
import assert from "node:assert/strict";

describe("channelSecretsCrypto", () => {
    before(() => {
        process.env.KLETRON_CHANNEL_SECRETS_KEY = "test-kletron-channel-secrets-key-32+";
    });

    it("encrypt/decrypt roundtrip", async () => {
        const { encryptChannelSecret, decryptChannelSecret, isChannelSecretsEncryptionConfigured } = await import(
            "../src/services/channelSecretsCrypto"
        );
        assert.equal(isChannelSecretsEncryptionConfigured(), true);
        const plain = "telegram-bot-token-example";
        const enc = encryptChannelSecret(plain);
        assert.notEqual(enc, plain);
        assert.equal(decryptChannelSecret(enc), plain);
    });
});
