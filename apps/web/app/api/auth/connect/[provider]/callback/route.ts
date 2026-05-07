// OAuth callback for connector providers.
//
// Exchanges the code for an access token, then stores the credentials as a
// workspace integration via connectorsService.

import { NextResponse } from "next/server";
import {
    decodeState,
    getOauthProvider,
} from "@kletron/server/services/oauthProviders";
import { createIntegration } from "@kletron/server/services/connectorsService";
import { debugLogGoogleAccessTokenScopes } from "@kletron/server/services/googleWorkspaceApi";
import { getWorkspaceById } from "@kletron/server/services/workspaceService";
import { isMongoBackedUserId } from "../../../../../../lib/accountEligibility";
import { getPublicAppOrigin } from "../../../../../../lib/publicAppUrl";
import { normalizeInternalRedirect } from "../../../../../../lib/safeRedirect";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ provider: string }> }
) {
    const { provider } = await params;
    const def = getOauthProvider(provider);
    if (!def) {
        return NextResponse.json(
            { error: `OAuth not configured for provider: ${provider}` },
            { status: 400 }
        );
    }

    const url = new URL(request.url);
    const publicOrigin = getPublicAppOrigin(request);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
        return redirectWithError(publicOrigin, "/app", `OAuth provider returned: ${errorParam}`);
    }
    if (!code || !stateRaw) {
        return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }
    const state = decodeState(stateRaw);
    if (!state || state.providerId !== provider) {
        return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }
    if (!isMongoBackedUserId(state.userId)) {
        return redirectWithError(
            publicOrigin,
            normalizeInternalRedirect(state.redirect, "/app"),
            "Your session is not eligible for account connectors. Sign out and sign back in with your registered Kletron account."
        );
    }

    const workspace = await getWorkspaceById(state.workspaceId, state.userId);
    if (!workspace) {
        return redirectWithError(
            publicOrigin,
            normalizeInternalRedirect(state.redirect, "/app"),
            "Workspace not found for the signed-in account."
        );
    }

    const clientId = process.env[def.clientIdEnv];
    const clientSecret = process.env[def.clientSecretEnv];
    if (!clientId || !clientSecret) {
        return NextResponse.json(
            {
                error: `OAuth credentials missing (${def.clientIdEnv}/${def.clientSecretEnv})`,
            },
            { status: 500 }
        );
    }

    try {
        const callbackUrl = new URL(`/api/auth/connect/${provider}/callback`, publicOrigin);
        const tokenResponse = await fetch(def.tokenUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: callbackUrl.toString(),
                grant_type: "authorization_code",
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const text = await tokenResponse.text().catch(() => "");
            return redirectWithError(
                publicOrigin,
                normalizeInternalRedirect(state.redirect, "/app"),
                `Token exchange failed (${tokenResponse.status}): ${text.slice(0, 200)}`
            );
        }
        const json = (await tokenResponse.json()) as Record<string, unknown>;
        if (typeof json.error === "string") {
            return redirectWithError(
                publicOrigin,
                normalizeInternalRedirect(state.redirect, "/app"),
                `OAuth error: ${json.error_description ?? json.error}`
            );
        }
        const credentials = def.buildCredentials(json);
        const scopes = def.extractScopes ? def.extractScopes(json) : def.defaultScopes;

        const accessForDebug =
            typeof (credentials as { accessToken?: string }).accessToken === "string"
                ? (credentials as { accessToken: string }).accessToken
                : typeof json.access_token === "string"
                  ? json.access_token
                  : "";
        await debugLogGoogleAccessTokenScopes(`oauth-callback:${provider}`, accessForDebug);

        await createIntegration(state.workspaceId, {
            providerId: provider,
            displayName: undefined,
            credentials,
            scopes,
        });

        const dest = new URL(normalizeInternalRedirect(state.redirect, "/app"), publicOrigin);
        dest.searchParams.set("connected", provider);
        return NextResponse.redirect(dest.toString());
    } catch (error) {
        return redirectWithError(
            publicOrigin,
            normalizeInternalRedirect(state.redirect, "/app"),
            `OAuth failed: ${(error as Error).message}`
        );
    }
}

function redirectWithError(origin: string, target: string, message: string) {
    const dest = new URL(normalizeInternalRedirect(target, "/app"), origin);
    dest.searchParams.set("connect_error", message);
    return NextResponse.redirect(dest.toString());
}
