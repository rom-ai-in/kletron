import { channelAppSecretsService } from "./channelAppSecretsService";

/**
 * Telegram bot token + webhook secret: DB first, then env fallback (CHANNEL_TELEGRAM_*).
 */
export async function resolveTelegramBotCredentials(): Promise<{ botToken: string; webhookSecret?: string } | null> {
    const fromDb = await channelAppSecretsService.getTelegramPlaintext();
    if (fromDb?.botToken) {
        return fromDb;
    }
    const botToken = process.env.CHANNEL_TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) return null;
    const webhookSecret = process.env.CHANNEL_TELEGRAM_WEBHOOK_SECRET?.trim();
    return { botToken, ...(webhookSecret ? { webhookSecret } : {}) };
}
