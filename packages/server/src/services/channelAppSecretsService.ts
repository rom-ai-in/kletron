import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { decryptChannelSecret, encryptChannelSecret, isChannelSecretsEncryptionConfigured } from "./channelSecretsCrypto";

const COLLECTION = "channel_app_secrets";

/** Singleton-style app-wide credentials (e.g. one Telegram bot for all users). */
export type ChannelAppSecretsDoc = {
    _id: ObjectId;
    /** Encrypted bot API token */
    telegramBotTokenEnc?: string;
    /** Optional webhook secret (encrypted) */
    telegramWebhookSecretEnc?: string;
    updatedAt: Date;
};

const SINGLETON_ID = new ObjectId("000000000000000000000001");

export class ChannelAppSecretsService {
    async getDoc(): Promise<ChannelAppSecretsDoc | null> {
        const col = (await getDb()).collection<ChannelAppSecretsDoc>(COLLECTION);
        return col.findOne({ _id: SINGLETON_ID });
    }

    /** Returns decrypted token/secret for outbound API and webhook verification. */
    async getTelegramPlaintext(): Promise<{ botToken: string; webhookSecret?: string } | null> {
        const doc = await this.getDoc();
        if (!doc?.telegramBotTokenEnc) return null;
        try {
            const botToken = decryptChannelSecret(doc.telegramBotTokenEnc);
            const webhookSecret = doc.telegramWebhookSecretEnc
                ? decryptChannelSecret(doc.telegramWebhookSecretEnc)
                : undefined;
            return { botToken, ...(webhookSecret ? { webhookSecret } : {}) };
        } catch (e) {
            console.error("[ChannelAppSecrets] decrypt failed:", (e as Error)?.message ?? e);
            return null;
        }
    }

    async setTelegramSecrets(input: {
        botToken?: string;
        webhookSecret?: string | null;
        clearWebhookSecret?: boolean;
    }): Promise<void> {
        if (!isChannelSecretsEncryptionConfigured()) {
            throw new Error("KLETRON_CHANNEL_SECRETS_KEY must be set before storing channel secrets.");
        }
        const col = (await getDb()).collection(COLLECTION);
        const $set: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof input.botToken === "string" && input.botToken.trim()) {
            $set.telegramBotTokenEnc = encryptChannelSecret(input.botToken.trim());
        }
        if (input.clearWebhookSecret) {
            $set.telegramWebhookSecretEnc = null;
        } else if (typeof input.webhookSecret === "string" && input.webhookSecret.trim()) {
            $set.telegramWebhookSecretEnc = encryptChannelSecret(input.webhookSecret.trim());
        }
        await col.updateOne(
            { _id: SINGLETON_ID },
            { $set, $setOnInsert: { _id: SINGLETON_ID } },
            { upsert: true }
        );
    }

    /** For GET API: never return raw secrets. */
    getMaskedStatus(doc: ChannelAppSecretsDoc | null): {
        telegramBotConfigured: boolean;
        telegramWebhookSecretConfigured: boolean;
    } {
        return {
            telegramBotConfigured: Boolean(doc?.telegramBotTokenEnc),
            telegramWebhookSecretConfigured: Boolean(doc?.telegramWebhookSecretEnc),
        };
    }
}

export const channelAppSecretsService = new ChannelAppSecretsService();

export async function ensureChannelAppSecretsIndexes(): Promise<void> {
    try {
        await (await getDb()).collection(COLLECTION).createIndex({ _id: 1 });
    } catch (e) {
        console.warn("[ChannelAppSecrets] ensureIndexes:", (e as Error)?.message ?? e);
    }
}
