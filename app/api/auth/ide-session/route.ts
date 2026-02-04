// app/api/auth/ide-session/route.ts
// Device code flow for IDE authentication
// Allows IDE to poll for auth completion using a unique device session ID

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';

// In-memory store for pending device sessions (use Redis in production)
// Format: { deviceSessionId: { tokens, createdAt } }
const pendingDeviceSessions = new Map<string, {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
        id: string;
        email: string;
        fullName: string | null;
    };
    createdAt: number;
}>();

// Cleanup old sessions every 5 minutes
const DEVICE_SESSION_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of pendingDeviceSessions.entries()) {
        if (now - session.createdAt > DEVICE_SESSION_TTL) {
            pendingDeviceSessions.delete(sessionId);
        }
    }
}, 60 * 1000);

const IDE_JWT_SECRET = new TextEncoder().encode(
    process.env.IDE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'ide-secret-key-change-in-production'
);

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

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

    if (!deviceSessionId) {
        return NextResponse.json({ success: false, error: 'Missing deviceSessionId' }, { status: 400 });
    }

    console.log('[IDE Session] Polling for session:', deviceSessionId);

    const session = pendingDeviceSessions.get(deviceSessionId);

    if (!session) {
        // Session not ready yet
        return NextResponse.json({ success: false, pending: true });
    }

    // Remove session after successful retrieval (one-time use)
    pendingDeviceSessions.delete(deviceSessionId);

    console.log('[IDE Session] Session found, returning tokens for:', session.user.email);

    return NextResponse.json({
        success: true,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        user: session.user,
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

        // Generate tokens
        const now = Math.floor(Date.now() / 1000);
        const accessTokenExpiry = now + 60 * 60; // 1 hour

        const accessToken = await new SignJWT({
            sub: userId,
            email: email,
            type: 'ide_access',
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(ACCESS_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(IDE_JWT_SECRET);

        const refreshTokenId = randomBytes(16).toString('hex');
        const refreshToken = await new SignJWT({
            sub: userId,
            jti: refreshTokenId,
            type: 'ide_refresh',
            iat: now,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(REFRESH_TOKEN_EXPIRY)
            .setIssuedAt()
            .sign(IDE_JWT_SECRET);

        // Store tokens for polling
        pendingDeviceSessions.set(deviceSessionId, {
            accessToken,
            refreshToken,
            expiresAt: accessTokenExpiry * 1000,
            user: {
                id: userId,
                email,
                fullName: fullName || null,
            },
            createdAt: Date.now(),
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
