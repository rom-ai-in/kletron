// app/api/organization/route.ts
// API route to get and update the current user's organization info (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import * as userProfileService from '@kletron/server/services/userProfileService';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get user profile from MongoDB
        const profile = await userProfileService.getProfileByUserId(auth.userId);

        // Return simplified organization info (no multi-tenant yet)
        return NextResponse.json({
            success: true,
            organization: null,
            message: 'Organization schema not set up yet',
            profile: profile ? {
                id: profile.id,
                email: profile.email,
                fullName: profile.fullName,
            } : null,
        });
    } catch (err) {
        console.error('Organization GET error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name } = body;

        if (typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'A non-empty name is required' }, { status: 400 });
        }

        // Update user profile in MongoDB
        await userProfileService.updateFullName(auth.userId, name.trim().slice(0, 255));

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Organization PATCH error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
