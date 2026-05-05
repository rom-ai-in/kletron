// Start OAuth for a connector provider.
//
//   GET /api/auth/connect/github?workspaceId=<id>&redirect=/app/...
//
// Redirects the browser to the provider's authorization URL with our state
// (signed-only via base64; no secrets in it). The callback at
// /api/auth/connect/<provider>/callback finishes the flow and stores the
// integration in Mongo.

import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    encodeState,
    getOauthProvider,
} from "@kletron/server/services/oauthProviders";
import {
    getWorkspaceById,
} from "@kletron/server/services/workspaceService";
import { isMongoBackedUserId } from "../../../../../lib/accountEligibility";
import { getPublicAppOrigin } from "../../../../../lib/publicAppUrl";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ provider: string }> }
) {
    const url = new URL(request.url);
    const publicOrigin = getPublicAppOrigin(request);
    const redirectTarget = url.searchParams.get("redirect") ?? "/app/config/connectors";
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return redirectToLogin(publicOrigin, redirectTarget);
    }
    if (!isMongoBackedUserId(auth.userId)) {
        return redirectWithError(
            publicOrigin,
            redirectTarget,
            "Your current session is not a real Kletron account. Sign out, then sign in with your registered email before connecting Gmail."
        );
    }
    const { provider } = await params;
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
        return NextResponse.json(
            { error: "workspaceId query parameter is required" },
            { status: 400 }
        );
    }
    const workspace = await getWorkspaceById(workspaceId, auth.userId);
    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const def = getOauthProvider(provider);
    if (!def) {
        return NextResponse.json(
            { error: `OAuth not configured for provider: ${provider}` },
            { status: 400 }
        );
    }

    const clientId = process.env[def.clientIdEnv];
    if (!clientId) {
        return NextResponse.json(
            {
                error: `OAuth client id missing. Set ${def.clientIdEnv} in your environment.`,
            },
            { status: 500 }
        );
    }

    const callbackUrl = new URL(`/api/auth/connect/${provider}/callback`, publicOrigin);

    const state = encodeState({
        workspaceId,
        userId: auth.userId,
        providerId: provider,
        iat: Date.now(),
        redirect: redirectTarget,
    });

    const params2 = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl.toString(),
        scope: def.defaultScopes.join(" "),
        state,
        response_type: "code",
    });
    if (def.extraAuthParams) {
        for (const [k, v] of Object.entries(def.extraAuthParams)) {
            params2.set(k, v);
        }
    }

    const target = `${def.authUrl}?${params2.toString()}`;
    return NextResponse.redirect(target);
}

function redirectToLogin(origin: string, target: string) {
    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set("redirect", target);
    return NextResponse.redirect(loginUrl);
}

function redirectWithError(origin: string, target: string, message: string) {
    const dest = new URL(target, origin);
    dest.searchParams.set("connect_error", message);
    return NextResponse.redirect(dest.toString());
}
