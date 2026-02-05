// app/api/auth/api-tokens/route.ts
// API route for managing extension API tokens (MongoDB version)
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';
import { createRawApiToken, hashApiToken } from '@numezis/server/lib/auth/apiTokens';
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import * as apiTokenService from '@numezis/server/services/apiTokenService';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { client } = createRouteHandlerClient(request);
        const { data: { user }, error } = await client.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const tokens = await apiTokenService.getTokensByUserId(user.id);

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
        const { client } = createRouteHandlerClient(request);
        const { data: { user }, error } = await client.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const label = typeof body.label === 'string' ? body.label.trim() : 'VS Code Extension';

        const rawToken = createRawApiToken();
        const tokenHash = hashApiToken(rawToken);

        const tokenInfo = await apiTokenService.createToken(user.id, tokenHash, label);

        return NextResponse.json({ token: rawToken, tokenInfo });
    } catch (err) {
        console.error('API token creation error:', err);
        return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
    }
}
