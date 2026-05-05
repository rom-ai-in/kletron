import type { NormalizedInboundEvent } from "@kletron/shared/channelTypes";

/** Minimal Telegram Bot API shapes used by the webhook (extended as needed). */
export type TelegramPhotoSize = { file_id: string; width?: number; height?: number };
export type TelegramDocument = { file_id: string; file_name?: string; mime_type?: string };
export type TelegramVoice = { file_id: string; mime_type?: string };

export type TelegramUpdate = {
    update_id: number;
    message?: {
        message_id: number;
        from?: { id: number; username?: string };
        chat: { id: number; type: string };
        text?: string;
        caption?: string;
        photo?: TelegramPhotoSize[];
        document?: TelegramDocument;
        voice?: TelegramVoice;
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

function largestPhoto(photos: TelegramPhotoSize[] | undefined): TelegramPhotoSize | undefined {
    if (!photos?.length) return undefined;
    return photos.reduce((best, p) => {
        const area = (p.width ?? 0) * (p.height ?? 0);
        const bestArea = (best.width ?? 0) * (best.height ?? 0);
        return area >= bestArea ? p : best;
    });
}

export function telegramUpdateToNormalized(update: TelegramUpdate): NormalizedInboundEvent | null {
    const msg = update.message;
    if (!msg?.chat?.id) return null;

    const attachments: NonNullable<NormalizedInboundEvent["attachments"]> = [];
    const photo = largestPhoto(msg.photo);
    if (photo?.file_id) {
        attachments.push({ kind: "image", name: `tg_file_id:${photo.file_id}` });
    }
    if (msg.document?.file_id) {
        attachments.push({
            kind: "file",
            name: msg.document.file_name ?? `tg_file_id:${msg.document.file_id}`,
        });
    }
    if (msg.voice?.file_id) {
        attachments.push({ kind: "other", name: `voice tg_file_id:${msg.voice.file_id}` });
    }

    let text = typeof msg.text === "string" ? msg.text.trim() : "";
    if (!text && typeof msg.caption === "string") {
        text = msg.caption.trim();
    }
    if (!text && attachments.length > 0) {
        const hint = attachments.map((a) => `[${a.kind}]`).join(" ");
        text = `${hint} (Telegram attachment — no caption.)`;
    }
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
        ...(attachments.length ? { attachments } : {}),
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
