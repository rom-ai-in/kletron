// app/api/auth/ide-auth/route.ts
// IDE-specific token exchange endpoint
// Exchanges a Supabase session for long-lived IDE tokens

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@numezis/server/lib/supabase/supabaseServer';
import { generateIdeTokens } from '@numezis/server/lib/auth/ideTokens';

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

        // Get user metadata for display
        const fullName = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            null;

        const tokenResult = await generateIdeTokens({
            id: user.id,
            email: user.email || '',
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
