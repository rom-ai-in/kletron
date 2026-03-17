// app/api/auth/me/route.ts
// API route to get current user information (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { getSupabaseAdminClient } from "@kletron/server/lib/supabase/supabaseAdmin";
import * as userProfileService from '@kletron/server/services/userProfileService';

// UUID v4 regex for validating user IDs before calling Supabase
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json(
            { success: false, message: 'Unauthorized', user: null, profile: null, context: [] },
            { status: 401 }
        );
    }

    // ── Dev bypass: return a mock user when the userId is not a real UUID ───
    if (!UUID_RE.test(auth.userId)) {
        return NextResponse.json({
            success: true,
            user: { id: auth.userId, email: 'dev@localhost' },
            profile: {
                id: auth.userId,
                fullName: 'Dev User',
                email: 'dev@localhost',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            context: [],
        });
    }

    try {
        // Get user from Supabase Auth
        const admin = getSupabaseAdminClient();
        const { data: { user }, error: userError } = await admin.auth.admin.getUserById(auth.userId);

        if (userError || !user) {
            return NextResponse.json(
                { success: false, message: 'User not found', user: null, profile: null, context: [] },
                { status: 200 }
            );
        }

        // Get or create profile in MongoDB (fallbacks handled inside service)
        const profile = await userProfileService.upsertProfile(
            user.id,
            user.email || '',
            user.user_metadata?.full_name || null
        );

        return NextResponse.json({
            success: true,
            user: {
                id: auth.userId,
                email: user.email ?? null,
            },
            profile: profile
                ? {
                    id: profile.id,
                    fullName: profile.fullName,
                    email: profile.email,
                    createdAt: profile.createdAt,
                    updatedAt: profile.updatedAt,
                }
                : null,
            context: [], // Context is not used in the new architecture
        });
    } catch (err) {
        console.error('Get user error:', err);
        return NextResponse.json(
            { success: false, message: 'Auth service unavailable', user: null, profile: null, context: [] },
            { status: 200 }
        );
    }
}
