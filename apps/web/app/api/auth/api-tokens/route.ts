// app/api/auth/api-tokens/route.ts
// API route for managing extension API tokens (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { createRawApiToken, hashApiToken } from '@kletron/server/lib/auth/apiTokens';
import * as apiTokenService from '@kletron/server/services/apiTokenService';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const tokens = await apiTokenService.getTokensByUserId(auth.userId);
        return NextResponse.json({ tokens });
    } catch (err) {
        console.error('API tokens fetch error:', err);
        return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const label = typeof body.label === 'string' ? body.label.trim() : 'VS Code Extension';

        const rawToken = createRawApiToken();
        const tokenHash = hashApiToken(rawToken);

        const tokenInfo = await apiTokenService.createToken(auth.userId, tokenHash, label);

        return NextResponse.json({ token: rawToken, tokenInfo });
    } catch (err) {
        console.error('API token creation error:', err);
        return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
    }
}
