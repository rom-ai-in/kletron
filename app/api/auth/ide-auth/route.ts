// app/api/auth/ide-auth/route.ts
// IDE-specific token exchange endpoint
// Exchanges a Supabase session for long-lived IDE tokens

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/lib/supabase/supabaseServer';
import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';

// IDE tokens have different expiry than web sessions
const ACCESS_TOKEN_EXPIRY = '1h';  // 1 hour
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

// Secret for signing IDE tokens (use different secret than web)
const IDE_JWT_SECRET = new TextEncoder().encode(
    process.env.IDE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'ide-secret-key-change-in-production'
);

interface IDEAuthResponse {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: {
        id: string;
        email: string;
        fullName: string | null;
    };
    error?: string;
}

/**
 * POST /api/auth/ide-auth
 * Exchanges current Supabase session for IDE-specific tokens
 */
export async function POST(_request: NextRequest): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const supabase = await createServerSupabaseClient();

        // Get current user from Supabase session
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated. Please login first.' },
                { status: 401 }
            );
        }

        // Calculate expiry times
        const now = Math.floor(Date.now() / 1000);
        const accessTokenExpiry = now + 60 * 60; // 1 hour

        // Generate access token
        const accessToken = await new SignJWT({
            sub: user.id,
            email: user.email,
            type: 'ide_access',
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(ACCESS_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(IDE_JWT_SECRET);

        // Generate refresh token (more minimal claims)
        const refreshTokenId = randomBytes(16).toString('hex');
        const refreshToken = await new SignJWT({
            sub: user.id,
            jti: refreshTokenId,
            type: 'ide_refresh',
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(REFRESH_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(IDE_JWT_SECRET);

        // Get user metadata for display
        const fullName = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            null;

        return NextResponse.json({
            success: true,
            accessToken,
            refreshToken,
            expiresAt: accessTokenExpiry * 1000, // Convert to milliseconds for JS
            user: {
                id: user.id,
                email: user.email || '',
                fullName,
            },
        });

    } catch (error) {
        console.error('[IDE Auth] Error generating tokens:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate IDE tokens' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/ide-auth
 * Returns current auth status for IDE
 */
export async function GET(): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' });
        }

        const fullName = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            null;

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email || '',
                fullName,
            },
        });
    } catch (error) {
        console.error('[IDE Auth] Error checking auth:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to check auth status' },
            { status: 500 }
        );
    }
}
