// app/api/auth/api-tokens/[id]/route.ts
// API route for revoking extension API tokens (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import * as apiTokenService from '@kletron/server/services/apiTokenService';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const revoked = await apiTokenService.revokeToken(params.id, auth.userId);

        if (!revoked) {
            return NextResponse.json({ error: 'Token not found or already revoked' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('API token revoke error:', err);
        return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
    }
}
