// app/api/auth/api-tokens/[id]/route.ts
// API route for revoking extension API tokens (MongoDB version)
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import * as apiTokenService from '@numezis/server/services/apiTokenService';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

        const revoked = await apiTokenService.revokeToken(params.id, user.id);

        if (!revoked) {
            return NextResponse.json({ error: 'Token not found or already revoked' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('API token revoke error:', err);
        return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
    }
}
