import { NextResponse } from "next/server";
import { getDb } from "@kletron/server/lib/db";

export const dynamic = "force-dynamic";

import { config } from "@kletron/server/config";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const debugInfo = {
            uriExists: !!config.mongo.uri,
            userExists: !!config.mongo.user,
            passLen: config.mongo.pass?.length,
            passPreview: config.mongo.pass?.slice(0, 3) + "..." + config.mongo.pass?.slice(-3),
        };
        console.log("Debug Mongo Config:", debugInfo);
        const db = await getDb();

        // Project only necessary fields for the list view to optimize bandwidth
        const sessions = await db
            .collection("audit_sessions")
            .find({})
            .project({
                _id: 1,
                prompt: 1,
                status: 1,
                startedAt: 1,
                endedAt: 1,
                "workflowResult.conclusion": 1,
                lastUpdated: 1
            })
            .sort({ startedAt: -1 }) // Newest first
            .limit(50) // Pagination limit
            .toArray();

        return NextResponse.json(sessions);
    } catch (error) {
        console.error("Failed to fetch audit sessions:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                debug: {
                    uriExists: !!config.mongo.uri,
                    userExists: !!config.mongo.user,
                    passLen: config.mongo.pass?.length,
                    // passPreview: config.mongo.pass?.slice(0, 3) + "..." + config.mongo.pass?.slice(-3) // Validated
                }
            },
            { status: 500 }
        );
    }
}
