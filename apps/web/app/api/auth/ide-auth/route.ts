// app/api/auth/ide-auth/route.ts
// IDE-specific token exchange endpoint
// Exchanges a NextAuth session for long-lived IDE tokens

import { NextRequest, NextResponse } from 'next/server';
import { generateIdeTokens } from '@kletron/server/lib/auth/ideTokens';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

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
 * Exchanges current session for IDE-specific tokens
 */
export async function POST(_request: NextRequest): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const auth = await requireAppRouteAuth(_request);
        if (!auth) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated. Please login first.' },
                { status: 401 }
            );
        }

        // Get user metadata from session
        const fullName = null;

        const tokenResult = await generateIdeTokens({
            id: auth.userId,
            email: '',
            fullName,
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
 * Returns current auth status for IDE
 */
export async function GET(): Promise<NextResponse<IDEAuthResponse>> {
    try {
        const auth = await requireAppRouteAuth(new Request('http://localhost'));

        if (!auth) {
            return NextResponse.json({ success: false, error: 'Not authenticated' });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: auth.userId,
                email: '',
                fullName: null,
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
