// app/api/auth/me/route.ts
// API route to get current user information (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";
import { getSupabaseAdminClient } from "@/src/lib/supabase/supabaseAdmin";
import * as userProfileService from '@/src/services/userProfileService';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // Get user from Supabase Auth
        const admin = getSupabaseAdminClient();
        const { data: { user }, error: userError } = await admin.auth.admin.getUserById(auth.userId);

        if (userError || !user) {
            return NextResponse.json(
                { success: false, message: 'User not found', user: null },
                { status: 404 }
            );
        }

        // Get or create profile in MongoDB
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
            profile: {
                id: profile.id,
                fullName: profile.fullName,
                email: profile.email,
                createdAt: profile.createdAt,
                updatedAt: profile.updatedAt,
            },
            context: [], // Context is not used in the new architecture
        });
    } catch (err) {
        console.error('Get user error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
