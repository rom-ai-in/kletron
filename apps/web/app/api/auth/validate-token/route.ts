// app/api/auth/validate-token/route.ts
// Validates an API token and returns user info (MongoDB version)
import { NextResponse } from 'next/server';
import { hashApiToken } from '@kletron/server/lib/auth/apiTokens';
import * as apiTokenService from '@kletron/server/services/apiTokenService';
import * as userProfileService from '@kletron/server/services/userProfileService';

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

        // Update last_used_at in MongoDB
        await apiTokenService.updateLastUsed(tokenData._id);

        // Get profile from MongoDB
        const profile = await userProfileService.getProfileByUserId(tokenData.userId);

        return NextResponse.json({
            valid: true,
            user: {
                id: tokenData.userId,
                email: profile?.email || '',
                name: profile?.fullName || null,
            },
            tokenLabel: tokenData.label,
        });
    } catch (err) {
        console.error('Token validation error:', err);
        return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
    }
}
