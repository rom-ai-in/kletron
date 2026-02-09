import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { automationExecutor } from "@numezis/server/services/automationExecutor";

/**
 * POST /api/webhooks/git
 *
 * Universal git webhook endpoint — receives events from GitHub, GitLab, etc.
 * Matches against all automations with triggerType === "git_event" and triggers
 * those that match the event type and branch filters.
 *
 * GitHub headers:
 *   x-github-event: "push" | "pull_request" | "create" (for tags)
 *   x-hub-signature-256: sha256=<hmac>
 *
 * GitLab headers:
 *   x-gitlab-event: "Push Hook" | "Merge Request Hook" | "Tag Push Hook"
 *   x-gitlab-token: <secret>
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        let parsedBody: any = {};
        try {
            parsedBody = JSON.parse(body);
        } catch {
            // Non-JSON payload — proceed with empty parsed body
        }

        // Detect event type from headers
        const githubEvent = req.headers.get("x-github-event");
        const gitlabEvent = req.headers.get("x-gitlab-event");

        let eventType: string | null = null;
        let branch: string | undefined;
        let provider: "github" | "gitlab" | "unknown" = "unknown";

        if (githubEvent) {
            provider = "github";
            if (githubEvent === "push") {
                eventType = "push";
                // Extract branch from ref: "refs/heads/main" -> "main"
                const ref = parsedBody?.ref as string | undefined;
                if (ref?.startsWith("refs/heads/")) {
                    branch = ref.replace("refs/heads/", "");
                } else if (ref?.startsWith("refs/tags/")) {
                    eventType = "tag";
                    branch = ref.replace("refs/tags/", "");
                }
            } else if (githubEvent === "pull_request") {
                eventType = "pull_request";
                branch = parsedBody?.pull_request?.head?.ref;
            } else if (githubEvent === "create" && parsedBody?.ref_type === "tag") {
                eventType = "tag";
                branch = parsedBody?.ref;
            }
        } else if (gitlabEvent) {
            provider = "gitlab";
            if (gitlabEvent === "Push Hook") {
                eventType = "push";
                const ref = parsedBody?.ref as string | undefined;
                if (ref?.startsWith("refs/heads/")) {
                    branch = ref.replace("refs/heads/", "");
                }
            } else if (gitlabEvent === "Merge Request Hook") {
                eventType = "pull_request";
                branch = parsedBody?.object_attributes?.source_branch;
            } else if (gitlabEvent === "Tag Push Hook") {
                eventType = "tag";
                const ref = parsedBody?.ref as string | undefined;
                if (ref?.startsWith("refs/tags/")) {
                    branch = ref.replace("refs/tags/", "");
                }
            }
        }

        if (!eventType) {
            return NextResponse.json(
                { error: "Unsupported or missing git event type" },
                { status: 400 }
            );
        }

        // Find all automations matching this event type and branch
        const matchingAutomations = await automationExecutor.listGitEventAutomations(eventType, branch);

        if (matchingAutomations.length === 0) {
            return NextResponse.json(
                { triggered: [], message: "No matching automations found" },
                { status: 200 }
            );
        }

        const triggered: string[] = [];
        const errors: string[] = [];

        for (const automation of matchingAutomations) {
            const automationId = automation._id?.toString();
            if (!automationId || !automation.gitEventConfig?.secret) continue;

            // Validate HMAC signature per automation
            let signatureValid = false;

            if (provider === "github") {
                const hubSignature = req.headers.get("x-hub-signature-256");
                if (hubSignature) {
                    const expectedHmac = "sha256=" + createHmac("sha256", automation.gitEventConfig.secret)
                        .update(body)
                        .digest("hex");

                    try {
                        const sigBuf = Buffer.from(hubSignature);
                        const expBuf = Buffer.from(expectedHmac);
                        signatureValid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
                    } catch {
                        signatureValid = false;
                    }
                }
            } else if (provider === "gitlab") {
                // GitLab uses a simple token comparison
                const gitlabToken = req.headers.get("x-gitlab-token");
                signatureValid = gitlabToken === automation.gitEventConfig.secret;
            }

            if (!signatureValid) {
                errors.push(`Automation ${automationId}: signature validation failed`);
                continue;
            }

            // Don't trigger if already running
            const latestRun = await automationExecutor.getLatestRun(automationId);
            if (latestRun?.status === "RUNNING") {
                errors.push(`Automation ${automationId}: already running`);
                continue;
            }

            // Start a new run
            try {
                const workspaceId = automation.workspaceId?.toString();
                const runId = await automationExecutor.startNewRun(automationId, workspaceId);

                // Fire-and-forget
                automationExecutor.executeRun(runId).catch((error) => {
                    console.error(`[GitWebhook] Run ${runId} (automation ${automationId}) failed:`, error);
                });

                triggered.push(automationId);
            } catch (err) {
                errors.push(`Automation ${automationId}: failed to start run`);
                console.error(`[GitWebhook] Failed to start run for automation ${automationId}:`, err);
            }
        }

        return NextResponse.json({
            triggered,
            event: eventType,
            branch: branch || null,
            provider,
            errors: errors.length > 0 ? errors : undefined,
        }, { status: 200 });
    } catch (error) {
        console.error("[API /api/webhooks/git POST] Error:", error);
        return NextResponse.json(
            { error: "Failed to process git webhook" },
            { status: 500 }
        );
    }
}
