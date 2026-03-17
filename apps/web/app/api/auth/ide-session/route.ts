// app/api/auth/ide-session/route.ts
// Device code flow for IDE authentication
// Allows IDE to poll for auth completion using a unique device session ID

import { NextRequest, NextResponse } from 'next/server';
import { generateIdeTokens } from '@kletron/server/lib/auth/ideTokens';
import { webcrypto } from 'crypto';
import { consumeIdeSession, getIdeSession, initIdeSession, storeIdeSession } from '@kletron/server/services/ideSessionService';

interface DeviceSessionResponse {
    success: boolean;
    pending?: boolean;
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
 * GET /api/auth/ide-session?deviceSessionId=xxx
 * Poll for auth completion by device session ID
 */
export async function GET(request: NextRequest): Promise<NextResponse<DeviceSessionResponse>> {
    const deviceSessionId = request.nextUrl.searchParams.get('deviceSessionId');
    const codeVerifier = request.nextUrl.searchParams.get('code_verifier');

    if (!deviceSessionId) {
        return NextResponse.json({ success: false, error: 'Missing deviceSessionId' }, { status: 400 });
    }

    console.log('[IDE Session] Polling for session:', deviceSessionId);

    const session = await getIdeSession(deviceSessionId);

    if (!session) {
        // Session not ready yet
        return NextResponse.json({ success: false, pending: true });
    }

    if (session.codeChallenge) {
        if (!codeVerifier) {
            return NextResponse.json({ success: false, error: 'Missing code_verifier' }, { status: 400 });
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await webcrypto.subtle.digest('SHA-256', data);
        const challenge = Buffer.from(digest).toString('base64url');
        if (challenge !== session.codeChallenge) {
            return NextResponse.json({ success: false, error: 'Invalid code_verifier' }, { status: 401 });
        }
    }

    if (!session.accessToken || !session.refreshToken || !session.expiresAt || !session.user) {
        return NextResponse.json({ success: false, pending: true });
    }

    const consumed = await consumeIdeSession(deviceSessionId);
    if (!consumed || !consumed.accessToken || !consumed.refreshToken || !consumed.expiresAt || !consumed.user) {
        return NextResponse.json({ success: false, pending: true });
    }

    console.log('[IDE Session] Session found, returning tokens for:', session.user.email);

    return NextResponse.json({
        success: true,
        accessToken: consumed.accessToken,
        refreshToken: consumed.refreshToken,
        expiresAt: consumed.expiresAt,
        user: consumed.user,
    });
}

/**
 * POST /api/auth/ide-session
 * Store tokens for a device session (called by ide-callback page)
 */
export async function POST(request: NextRequest): Promise<NextResponse<DeviceSessionResponse>> {
    try {
        const body = await request.json();
        const { deviceSessionId, userId, email, fullName } = body;

        if (!deviceSessionId || !userId || !email) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        console.log('[IDE Session] Storing session for:', email, 'sessionId:', deviceSessionId);

        const tokenResult = await generateIdeTokens({
            id: userId,
            email,
            fullName: fullName || null,
        });

        // Store tokens for polling
        await storeIdeSession({
            deviceSessionId,
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresAt: tokenResult.expiresAt,
            user: tokenResult.user,
            createdAt: new Date(),
        });

        console.log('[IDE Session] Session stored successfully, waiting for IDE polling...');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[IDE Session] Error storing session:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to store session' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/auth/ide-session/init
 * Store PKCE challenge for a device session
 */
export async function PUT(request: NextRequest): Promise<NextResponse<DeviceSessionResponse>> {
    try {
        const body = await request.json();
        const { deviceSessionId, codeChallenge } = body ?? {};

        if (!deviceSessionId) {
            return NextResponse.json({ success: false, error: 'Missing deviceSessionId' }, { status: 400 });
        }

        await initIdeSession(deviceSessionId, codeChallenge);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[IDE Session] Error initializing session:', error);
        return NextResponse.json({ success: false, error: 'Failed to initialize session' }, { status: 500 });
    }
}
