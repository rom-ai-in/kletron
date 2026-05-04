import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/channels/whatsapp — Meta webhook verification
 * Query: hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const verifyToken = process.env.CHANNEL_WHATSAPP_VERIFY_TOKEN?.trim();

    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
        return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/webhooks/channels/whatsapp — Meta message webhook (stub)
 */
export async function POST() {
    return NextResponse.json({ ok: true });
}
