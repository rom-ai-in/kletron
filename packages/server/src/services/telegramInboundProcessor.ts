import { handleChannelUserCommand, handleTelegramInlineCallback } from "./channelCommandService";
import { resolveTelegramBotCredentials } from "./channelCredentialsService";
import { runChannelAgentTurn } from "./channelGatewayService";
import {
    answerTelegramCallbackQuery,
    sendTelegramMessage,
    telegramUpdateToNormalized,
    type TelegramUpdate,
} from "./telegramChannelAdapter";

function userErrorMessage(reason: string, message?: string): string {
    if (message) return message;
    if (reason === "not_linked") {
        return "Link your Telegram account in Kletron: Configuration → Messenger channels.";
    }
    if (reason === "channel_disabled") {
        return "This channel is disabled for the selected workspace.";
    }
    if (reason === "no_workspace") {
        return "No workspace available for your account.";
    }
    if (reason === "no_graph") {
        return "No agent graph configured.";
    }
    return "Something went wrong.";
}

/**
 * Runs after the HTTP handler returns (Mongo-backed job queue). Resolves credentials fresh so token rotations apply.
 */
export async function executeTelegramInboundUpdate(body: TelegramUpdate): Promise<void> {
    const creds = await resolveTelegramBotCredentials();
    if (!creds?.botToken) return;

    try {
        if (body.callback_query?.id) {
            const cq = body.callback_query;
            const chatId = cq.message?.chat?.id;
            const data = cq.data?.trim() ?? "";
            const fromId = cq.from?.id;
            if (chatId === undefined || fromId === undefined) return;

            const { channelStoreService } = await import("./channelStoreService");
            const claimed = await channelStoreService.tryClaimInboundMessage("telegram", `tgcb:${cq.id}`);
            if (!claimed) return;

            await answerTelegramCallbackQuery(creds.botToken, cq.id).catch(() => {});

            const externalChatKey = `telegram:chat:${chatId}`;
            const externalUserId = String(fromId);
            const result = await handleTelegramInlineCallback({
                callbackData: data,
                externalChatKey,
                externalUserId,
            });
            await sendTelegramMessage(creds.botToken, chatId, result.replyText);
            return;
        }

        const normalized = telegramUpdateToNormalized(body);
        if (!normalized) {
            return;
        }

        const chatId = body.message?.chat?.id;
        if (chatId === undefined) return;

        const { channelStoreService } = await import("./channelStoreService");
        const claimed = await channelStoreService.tryClaimInboundMessage(normalized.channel, normalized.inboundMessageId);
        if (!claimed) return;

        const cmd = await handleChannelUserCommand({
            channel: "telegram",
            text: normalized.text,
            externalChatKey: normalized.externalChatKey,
            externalUserId: normalized.externalUserId,
        });

        if (cmd.handled) {
            await sendTelegramMessage(creds.botToken, chatId, cmd.replyText, {
                replyMarkup: cmd.replyMarkup,
            });
            return;
        }

        const result = await runChannelAgentTurn(normalized);
        if (result.ok && result.replyText) {
            await sendTelegramMessage(creds.botToken, chatId, result.replyText);
        } else if (!result.ok && result.reason !== "duplicate") {
            const msg = userErrorMessage(result.reason, result.message);
            await sendTelegramMessage(creds.botToken, chatId, msg.slice(0, 500));
        }
    } catch (e) {
        console.error("[telegram webhook] job failed:", (e as Error)?.message ?? e);
        try {
            const chatId = body.message?.chat?.id ?? body.callback_query?.message?.chat?.id;
            if (chatId !== undefined) {
                const creds2 = await resolveTelegramBotCredentials();
                if (creds2?.botToken) {
                    await sendTelegramMessage(
                        creds2.botToken,
                        chatId,
                        `Sorry, something went wrong: ${((e as Error)?.message ?? "unknown").slice(0, 200)}`
                    );
                }
            }
        } catch {
            /* ignore */
        }
    }
}
