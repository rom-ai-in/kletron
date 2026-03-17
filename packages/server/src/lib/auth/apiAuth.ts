// src/lib/auth/apiAuth.ts
// Shared API auth helpers for app and pages routes (MongoDB version)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '@kletron/server/lib/supabase/supabaseServer';
import { createPagesSupabaseClient } from '@kletron/server/lib/supabase/supabasePages';
import { getSupabaseAdminClient } from '@kletron/server/lib/supabase/supabaseAdmin';
import { API_TOKEN_PREFIX, hashApiToken } from './apiTokens';
import * as apiTokenService from '@kletron/server/services/apiTokenService';
import { jwtVerify } from 'jose';

export type AuthResult = {
    userId: string;
    authType: 'session' | 'api-token' | 'supabase-token' | 'ide-token';
};

const DEV_AUTH_BYPASS =
    process.env.KLETRON_AUTH_BYPASS === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.KLETRON_AUTH_BYPASS !== 'false');

function getDevBypassAuth(request?: Request): AuthResult | null {
    if (!DEV_AUTH_BYPASS) return null;
    if (request) {
        const host = request.headers.get('host') || '';
        const isLocalhost =
            host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('::1');
        if (!isLocalhost) return null;
    }
    return {
        userId: process.env.KLETRON_DEV_USER_ID || 'dev-user',
        authType: 'session',
    };
}

const IDE_JWT_SECRET = new TextEncoder().encode(
    process.env.IDE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'ide-secret-key-change-in-production'
);

function extractBearerTokenFromHeaders(headers: Headers): string | null {
    const authHeader = headers.get('authorization') || headers.get('Authorization');
    if (!authHeader) return null;
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token.trim();
}

function extractBearerTokenFromReq(req: NextApiRequest): string | null {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || Array.isArray(authHeader)) return null;
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token.trim();
}

async function verifyBearerToken(token: string): Promise<AuthResult | null> {
    if (!token) return null;

    try {
        // Check if it's an API token (stored in MongoDB)
        if (token.startsWith(API_TOKEN_PREFIX)) {
            const tokenHash = hashApiToken(token);
            const tokenData = await apiTokenService.findTokenByHash(tokenHash);

            if (!tokenData) {
                return null;
            }

            // Update last used timestamp
            void apiTokenService.updateLastUsed(tokenData._id);

            return { userId: tokenData.userId, authType: 'api-token' };
        }

        // Check if it's an IDE access token
        try {
            const verified = await jwtVerify(token, IDE_JWT_SECRET);
            const payload = verified.payload;
            if (payload?.type === 'ide_access' && payload.sub) {
                return { userId: String(payload.sub), authType: 'ide-token' };
            }
        } catch {
            // Ignore and fall back to Supabase validation
        }

        // Otherwise, verify as Supabase access token
        const admin = getSupabaseAdminClient();
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) {
            return null;
        }

        return { userId: data.user.id, authType: 'supabase-token' };
    } catch {
        return null;
    }
}

export async function getAppRouteAuth(request: Request): Promise<AuthResult | null> {
    const devBypass = getDevBypassAuth(request);
    if (devBypass && process.env.KLETRON_AUTH_BYPASS === 'true') {
        return devBypass;
    }
    try {
        const { client } = createRouteHandlerClient(request);
        const { data: { user } } = await client.auth.getUser();
        if (user) {
            return { userId: user.id, authType: 'session' };
        }
    } catch {
        // Ignore session errors and fall back to bearer tokens
    }

    const token = extractBearerTokenFromHeaders(request.headers);
    if (!token) return devBypass;

    const verified = await verifyBearerToken(token);
    return verified ?? devBypass;
}

export async function requireAppRouteAuth(request: Request) {
    return getAppRouteAuth(request);
}

export async function getPagesRouteAuth(req: NextApiRequest): Promise<AuthResult | null> {
    const devBypass = DEV_AUTH_BYPASS
        ? { userId: process.env.KLETRON_DEV_USER_ID || 'dev-user', authType: 'session' as const }
        : null;
    if (devBypass && process.env.KLETRON_AUTH_BYPASS === 'true') {
        return devBypass;
    }
    try {
        const supabase = createPagesSupabaseClient(req);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            return { userId: user.id, authType: 'session' };
        }
    } catch {
        // Ignore session errors and fall back to bearer tokens
    }

    const token = extractBearerTokenFromReq(req);
    if (!token) return devBypass;

    const verified = await verifyBearerToken(token);
    return verified ?? devBypass;
}

export async function requirePagesRouteAuth(req: NextApiRequest, res: NextApiResponse) {
    const auth = await getPagesRouteAuth(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    return auth;
}
