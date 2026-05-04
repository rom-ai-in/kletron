import { NextResponse } from "next/server";
import { channelAppSecretsService } from "@kletron/server/services/channelAppSecretsService";
import { isChannelSecretsEncryptionConfigured } from "@kletron/server/services/channelSecretsCrypto";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/channels/app-credentials — masked status only.
 */
export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await channelAppSecretsService.getDoc();
    const masked = channelAppSecretsService.getMaskedStatus(doc);
    return NextResponse.json({
        encryptionConfigured: isChannelSecretsEncryptionConfigured(),
        telegram: masked,
    });
}

/**
 * PUT /api/channels/app-credentials — body: { telegram?: { botToken?, webhookSecret?, clearWebhookSecret? } }
 */
export async function PUT(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
        telegram?: { botToken?: string; webhookSecret?: string; clearWebhookSecret?: boolean };
    };

    try {
        await channelAppSecretsService.setTelegramSecrets({
            botToken: body.telegram?.botToken,
            webhookSecret: body.telegram?.webhookSecret,
            clearWebhookSecret: body.telegram?.clearWebhookSecret === true,
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json(
            { error: (e as Error)?.message ?? "Failed to save credentials" },
            { status: 400 }
        );
    }
}
