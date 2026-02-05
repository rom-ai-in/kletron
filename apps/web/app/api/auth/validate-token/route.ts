// app/api/auth/validate-token/route.ts
// Validates an API token and returns user info (MongoDB version)
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@numezis/server/lib/supabase/supabaseAdmin';
import { hashApiToken } from '@numezis/server/lib/auth/apiTokens';
import * as apiTokenService from '@numezis/server/services/apiTokenService';
import * as userProfileService from '@numezis/server/services/userProfileService';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const token = typeof body.token === 'string' ? body.token.trim() : '';

        if (!token) {
            return NextResponse.json({ valid: false, error: 'Token required' }, { status: 400 });
        }

        const tokenHash = hashApiToken(token);

        // Find token in MongoDB
        const tokenData = await apiTokenService.findTokenByHash(tokenHash);

        if (!tokenData) {
            return NextResponse.json({ valid: false, error: 'Invalid or revoked token' });
        }

        // Get user info from Supabase Auth (still used for authentication)
        const admin = getSupabaseAdminClient();
        const { data: { user }, error: userError } = await admin.auth.admin.getUserById(tokenData.userId);

        if (userError || !user) {
            return NextResponse.json({ valid: false, error: 'User not found' });
        }

        // Update last_used_at in MongoDB
        await apiTokenService.updateLastUsed(tokenData._id);

        // Get profile from MongoDB (or fall back to Supabase user metadata)
        const profile = await userProfileService.getProfileBySupabaseId(user.id);

        return NextResponse.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                name: profile?.fullName || user.user_metadata?.full_name || null,
            },
            tokenLabel: tokenData.label,
        });
    } catch (err) {
        console.error('Token validation error:', err);
        return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
    }
}
