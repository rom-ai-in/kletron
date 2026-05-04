import type { NormalizedInboundEvent } from "@kletron/shared/channelTypes";

export type TelegramUpdate = {
    update_id: number;
    message?: {
        message_id: number;
        from?: { id: number; username?: string };
        chat: { id: number; type: string };
        text?: string;
        reply_to_message?: { message_id: number };
    };
    callback_query?: {
        id: string;
        from: { id: number };
        message?: { chat: { id: number } };
        data?: string;
    };
};

export type TelegramInlineKeyboard = {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export function telegramUpdateToNormalized(update: TelegramUpdate): NormalizedInboundEvent | null {
    const msg = update.message;
    if (!msg?.chat?.id) return null;
    const text = typeof msg.text === "string" ? msg.text.trim() : "";
    if (!text) return null;

    const chatId = msg.chat.id;
    const fromId = msg.from?.id ?? chatId;
    const externalChatKey = `telegram:chat:${chatId}`;
    const externalUserId = String(fromId);
    const inboundMessageId = `tg:${update.update_id}:${msg.message_id}`;

    return {
        channel: "telegram",
        externalChatKey,
        externalUserId,
        text,
        inboundMessageId,
        replyToMessageId: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
        rawRef: `update_id=${update.update_id}`,
    };
}

export async function sendTelegramMessage(
    botToken: string,
    chatId: number | string,
    text: string,
    options?: { replyMarkup?: TelegramInlineKeyboard }
): Promise<void> {
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
    const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
    };
    if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
    }
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed: ${res.status} ${errText}`);
    }
}

export async function answerTelegramCallbackQuery(
    botToken: string,
    callbackQueryId: string,
    text?: string
): Promise<void> {
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/answerCallbackQuery`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            ...(text ? { text, show_alert: false } : {}),
        }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Telegram answerCallbackQuery failed: ${res.status} ${errText}`);
    }
}
