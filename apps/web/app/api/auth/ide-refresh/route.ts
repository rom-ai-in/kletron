// app/api/auth/ide-refresh/route.ts
// IDE token refresh endpoint
// Refreshes IDE access tokens using a valid refresh token

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { randomBytes } from 'crypto';

import { resolveIdeTokenSecret } from '@kletron/server/lib/auth/ideTokenSecret';

const ACCESS_TOKEN_EXPIRY = '1h';  // 1 hour
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

interface IDERefreshResponse {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
}

/**
 * POST /api/auth/ide-refresh
 * Refreshes IDE tokens using a valid refresh token
 * 
 * Body: { refreshToken: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<IDERefreshResponse>> {
    try {
        // Shared with the minting and verifying paths; null means IDE tokens
        // are not configured, in which case refresh must not be possible.
        const ideJwtSecret = resolveIdeTokenSecret();
        if (!ideJwtSecret) {
            return NextResponse.json(
                { success: false, error: 'IDE token authentication is not configured' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return NextResponse.json(
                { success: false, error: 'Refresh token is required' },
                { status: 400 }
            );
        }

        // Verify the refresh token
        let payload;
        try {
            const verified = await jwtVerify(refreshToken, ideJwtSecret);
            payload = verified.payload;
        } catch (jwtError) {
            console.error('[IDE Refresh] Invalid refresh token:', jwtError);
            return NextResponse.json(
                { success: false, error: 'Invalid or expired refresh token' },
                { status: 401 }
            );
        }

        // Validate token type
        if (payload.type !== 'ide_refresh') {
            return NextResponse.json(
                { success: false, error: 'Invalid token type' },
                { status: 401 }
            );
        }

        const userId = payload.sub;
        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Invalid token payload' },
                { status: 401 }
            );
        }

        // Generate new access token
        const now = Math.floor(Date.now() / 1000);
        const accessTokenExpiry = now + 60 * 60; // 1 hour

        const newAccessToken = await new SignJWT({
            sub: userId,
            email: payload.email,
            type: 'ide_access',
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(ACCESS_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(ideJwtSecret);

        // Optionally rotate the refresh token for added security
        // (issuing a new refresh token each time)
        const refreshTokenId = randomBytes(16).toString('hex');
        const newRefreshToken = await new SignJWT({
            sub: userId,
            jti: refreshTokenId,
            type: 'ide_refresh',
            email: payload.email,
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(REFRESH_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(ideJwtSecret);

        return NextResponse.json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: accessTokenExpiry * 1000, // Convert to milliseconds
        });

    } catch (error) {
        console.error('[IDE Refresh] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to refresh tokens' },
            { status: 500 }
        );
    }
}
