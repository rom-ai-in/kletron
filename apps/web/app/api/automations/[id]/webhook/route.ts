import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { automationExecutor } from "@numezis/server/services/automationExecutor";

/**
 * POST /api/automations/[id]/webhook
 *
 * Public webhook endpoint — triggers an automation run.
 * No user auth required; instead, validates HMAC signature.
 *
 * Headers:
 *   x-webhook-signature: HMAC-SHA256 hex digest of the raw body
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const automationId = params.id;
        const body = await req.text();

        // Load the automation
        const automation = await automationExecutor.getAutomation(automationId);
        if (!automation) {
            return NextResponse.json({ error: "Automation not found" }, { status: 404 });
        }

        // Ensure this automation is configured for webhook triggers
        if (automation.triggerType !== "webhook") {
            return NextResponse.json(
                { error: "This automation is not configured for webhook triggers" },
                { status: 400 }
            );
        }

        if (!automation.webhookConfig?.secret) {
            return NextResponse.json(
                { error: "Webhook secret not configured" },
                { status: 500 }
            );
        }

        // Validate HMAC signature
        const signature = req.headers.get("x-webhook-signature");
        if (!signature) {
            return NextResponse.json(
                { error: "Missing x-webhook-signature header" },
                { status: 401 }
            );
        }

        const expectedHmac = createHmac("sha256", automation.webhookConfig.secret)
            .update(body)
            .digest("hex");

        const sigBuffer = Buffer.from(signature, "hex");
        const expectedBuffer = Buffer.from(expectedHmac, "hex");

        if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
            return NextResponse.json(
                { error: "Invalid webhook signature" },
                { status: 401 }
            );
        }

        // Optional IP allowlist check
        if (automation.webhookConfig.allowedIps && automation.webhookConfig.allowedIps.length > 0) {
            const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                || req.headers.get("x-real-ip")
                || "unknown";

            if (!automation.webhookConfig.allowedIps.includes(clientIp)) {
                return NextResponse.json(
                    { error: "IP not in allowlist" },
                    { status: 403 }
                );
            }
        }

        // Don't trigger if already running
        const latestRun = await automationExecutor.getLatestRun(automationId);
        if (latestRun?.status === "RUNNING") {
            return NextResponse.json(
                { error: "Automation is already running", runId: latestRun._id?.toString() },
                { status: 409 }
            );
        }

        // Start a new run
        const workspaceId = automation.workspaceId?.toString();
        const runId = await automationExecutor.startNewRun(automationId, workspaceId);

        // Execute in background (fire-and-forget)
        automationExecutor.executeRun(runId).catch((error) => {
            console.error(`[WebhookTrigger] Run ${runId} (automation ${automationId}) failed:`, error);
        });

        return NextResponse.json({ status: "TRIGGERED", runId }, { status: 200 });
    } catch (error) {
        console.error(`[API /api/automations/${params.id}/webhook POST] Error:`, error);
        return NextResponse.json(
            { error: "Failed to trigger automation" },
            { status: 500 }
        );
    }
}
