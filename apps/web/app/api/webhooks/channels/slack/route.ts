import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SlackEnvelope = {
    type?: string;
    challenge?: string;
    event?: { type?: string };
};

/**
 * POST /api/webhooks/channels/slack
 * Handles Slack URL verification (Events API). Full event routing is deferred to the channel gateway.
 */
export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => null)) as SlackEnvelope | null;
    if (!body) {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (body.type === "url_verification" && typeof body.challenge === "string") {
        return new NextResponse(body.challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    // Acknowledge events quickly; delivery processing not implemented in this slice.
    return NextResponse.json({ ok: true });
}
