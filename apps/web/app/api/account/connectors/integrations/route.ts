// Account-level SaaS integrations (owner = signed-in user).

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as accountConnectors from "@kletron/server/services/accountConnectorsService";
import { integrationCreateSchema } from "@kletron/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const integrations = await accountConnectors.listAccountIntegrations(auth.userId);
    return NextResponse.json({ integrations });
}

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const validated = integrationCreateSchema.parse(body);
        const integration = await accountConnectors.createAccountIntegration(auth.userId, validated);
        return NextResponse.json({ integration }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        const message = (error as Error).message;
        const status = /unknown connector|missing required/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
