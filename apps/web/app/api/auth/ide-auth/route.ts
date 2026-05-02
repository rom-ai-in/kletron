// app/api/auth/ide-auth/route.ts
// IDE-specific token exchange endpoint
// Exchanges a NextAuth session or Bearer auth for long-lived IDE tokens

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateIdeTokens } from '@kletron/server/lib/auth/ideTokens';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import { getProfileByUserId } from '@kletron/server/services/userProfileService';
import { authConfig as authOptions } from '../../../../config/auth';

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
 * Resolve the signed-in user for IDE token issuance.
 * Prefer NextAuth session (browser / ide-callback) over anonymous dev bypass when both could apply.
 */
async function resolveUserForIdeTokens(request: NextRequest): Promise<{
    id: string;
    email: string;
    fullName: string | null;
} | null> {
    const session = await getServerSession(authOptions);
    const su = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
    const sessionUserId = su && typeof su.id === 'string' ? su.id : null;

    if (sessionUserId && su) {
        const profile = await getProfileByUserId(sessionUserId);
        const email = profile?.email ?? su.email ?? '';
        const fullName =
            profile?.fullName ?? (typeof su.name === 'string' ? su.name : null) ?? null;
        return { id: sessionUserId, email, fullName };
    }

    const auth = await requireAppRouteAuth(request);
    if (!auth) return null;

    const profile = await getProfileByUserId(auth.userId);
    const email = profile?.email ?? '';
    const fullName = profile?.fullName ?? null;
    return { id: auth.userId, email, fullName };
}

/**
 * POST /api/auth/ide-auth
 * Exchanges current session or Bearer auth for IDE-specific tokens
 */
export async function POST(request: NextRequest): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const user = await resolveUserForIdeTokens(request);
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated. Please login first.' },
                { status: 401 }
            );
        }

        const tokenResult = await generateIdeTokens({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
        });

        return NextResponse.json({
            success: true,
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresAt: tokenResult.expiresAt,
            user: tokenResult.user,
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
 * Returns current auth status for IDE (session or Bearer)
 */
export async function GET(request: NextRequest): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const user = await resolveUserForIdeTokens(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
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
