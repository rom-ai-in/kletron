import { NextRequest, NextResponse } from "next/server";
import { resolveTelegramBotCredentials } from "@kletron/server/services/channelCredentialsService";
import { enqueueTelegramInboundJob } from "@kletron/server/services/channelInboundJobService";
import { ensureChannelStoreIndexes } from "@kletron/server/services/channelStoreService";
import type { TelegramUpdate } from "@kletron/server/services/telegramChannelAdapter";

export const dynamic = "force-dynamic";

let indexesEnsured = false;

async function ensureIndexesOnce() {
    if (indexesEnsured) return;
    await ensureChannelStoreIndexes();
    indexesEnsured = true;
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

    await enqueueTelegramInboundJob(body);

    return NextResponse.json({ ok: true });
}
