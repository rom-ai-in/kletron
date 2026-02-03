// app/api/auth/profile/route.ts
// API route to update user profile in MongoDB
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";
import * as userProfileService from '@/src/services/userProfileService';

export async function PATCH(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ "error": "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : null;

        if (fullName !== null) {
            await userProfileService.updateFullName(auth.userId, fullName);
        }

        // Fetch updated profile
        const profile = await userProfileService.getProfileBySupabaseId(auth.userId);

        return NextResponse.json({
            success: true,
            profile: profile ? {
                id: profile.id,
                fullName: profile.fullName,
                email: profile.email,
                createdAt: profile.createdAt,
                updatedAt: profile.updatedAt,
            } : null,
        });
    } catch (err) {
        console.error('Profile update error:', err);
        return NextResponse.json(
            { success: false, message: 'Failed to update profile' },
            { status: 500 }
        );
    }
}
