import { NextRequest, NextResponse } from "next/server";
import { handleChannelUserCommand, handleTelegramWorkspaceCallback } from "@kletron/server/services/channelCommandService";
import { resolveTelegramBotCredentials } from "@kletron/server/services/channelCredentialsService";
import { runChannelAgentTurn } from "@kletron/server/services/channelGatewayService";
import { ensureChannelStoreIndexes } from "@kletron/server/services/channelStoreService";
import { enqueueChannelJob } from "@kletron/server/services/channelQueueService";
import {
    answerTelegramCallbackQuery,
    sendTelegramMessage,
    telegramUpdateToNormalized,
    type TelegramUpdate,
} from "@kletron/server/services/telegramChannelAdapter";

export const dynamic = "force-dynamic";

let indexesEnsured = false;

async function ensureIndexesOnce() {
    if (indexesEnsured) return;
    await ensureChannelStoreIndexes();
    indexesEnsured = true;
}

function userErrorMessage(
    reason: string,
    message?: string
): string {
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
 * POST /api/webhooks/channels/telegram
 */
export async function POST(req: NextRequest) {
    await ensureIndexesOnce();

    const creds = await resolveTelegramBotCredentials();
    if (!creds?.botToken) {
        return NextResponse.json(
            {
                ok: false,
                error: "Configure the Telegram bot: set app credentials in Kletron (Channels) or CHANNEL_TELEGRAM_BOT_TOKEN in the environment.",
            },
            { status: 503 }
        );
    }

    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (creds.webhookSecret && secretHeader !== creds.webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as TelegramUpdate | null;
    if (!body) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    enqueueChannelJob(async () => {
        try {
            if (body.callback_query?.id) {
                const cq = body.callback_query;
                const chatId = cq.message?.chat?.id;
                const data = cq.data?.trim() ?? "";
                const fromId = cq.from?.id;
                if (chatId === undefined || fromId === undefined) return;

                const { channelStoreService } = await import("@kletron/server/services/channelStoreService");
                const claimed = await channelStoreService.tryClaimInboundMessage(
                    "telegram",
                    `tgcb:${cq.id}`
                );
                if (!claimed) return;

                await answerTelegramCallbackQuery(creds.botToken, cq.id).catch(() => {});

                const externalChatKey = `telegram:chat:${chatId}`;
                const externalUserId = String(fromId);
                const result = await handleTelegramWorkspaceCallback({
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

            const { channelStoreService } = await import("@kletron/server/services/channelStoreService");
            const claimed = await channelStoreService.tryClaimInboundMessage(
                normalized.channel,
                normalized.inboundMessageId
            );
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
    });

    return NextResponse.json({ ok: true });
}
