// src/lib/auth/apiAuth.ts
// Shared API auth helpers for app and pages routes (MongoDB/NextAuth version)
import type { NextApiRequest, NextApiResponse } from 'next';
import { API_TOKEN_PREFIX, hashApiToken } from './apiTokens';
import * as apiTokenService from '@kletron/server/services/apiTokenService';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';

export type AuthResult = {
    userId: string;
    authType: 'session' | 'api-token' | 'ide-token' | 'internal';
    /**
     * For internal service identities (MCP server -> web), this is the user id
     * the operation is being performed on behalf of (when supplied via the
     * `x-on-behalf-of` header).
     */
    onBehalfOf?: string;
};

const INTERNAL_TOKEN_HEADERS = ['x-mcp-internal-token', 'x-internal-token'];
const ON_BEHALF_HEADERS = ['x-on-behalf-of', 'x-kletron-user'];
const NEXTAUTH_SESSION_COOKIE_NAMES = ['__Secure-next-auth.session-token', 'next-auth.session-token'] as const;

type CookieMap = Record<string, string>;

function readHeader(headers: Headers, names: string[]): string | null {
    for (const name of names) {
        const v = headers.get(name);
        if (v && v.trim()) return v.trim();
    }
    return null;
}

function readReqHeader(req: NextApiRequest, names: string[]): string | null {
    for (const name of names) {
        const value = req.headers[name];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (Array.isArray(value) && value.length > 0 && value[0]?.trim()) {
            return value[0].trim();
        }
    }
    return null;
}

function readReqCookieHeader(req: NextApiRequest): string | null {
    const cookie = req.headers.cookie;
    if (typeof cookie === 'string' && cookie.trim()) return cookie.trim();
    if (Array.isArray(cookie) && cookie.length > 0) {
        const joined = cookie.map((part) => part.trim()).filter(Boolean).join('; ');
        return joined || null;
    }
    return null;
}

function parseCookieHeader(cookieHeader: string | null): CookieMap {
    if (!cookieHeader) return {};

    const cookies: CookieMap = {};
    for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const name = trimmed.slice(0, separatorIndex).trim();
        if (!name) continue;

        const value = trimmed.slice(separatorIndex + 1);
        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = value;
        }
    }

    return cookies;
}

function getNextAuthUserId(token: Awaited<ReturnType<typeof getToken>>): string | null {
    if (!token) return null;
    const payload = token as Record<string, unknown>;
    const userId = payload.id ?? payload.sub;
    return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
}

async function getNextAuthSessionAuthFromCookies(cookies: CookieMap): Promise<AuthResult | null> {
    if (Object.keys(cookies).length === 0) return null;

    const req = {
        headers: new Headers(),
        cookies,
    } as unknown as Parameters<typeof getToken>[0]['req'];

    for (const cookieName of NEXTAUTH_SESSION_COOKIE_NAMES) {
        const token = await getToken({
            req,
            cookieName,
        });
        const userId = getNextAuthUserId(token);
        if (userId) {
            return { userId, authType: 'session' };
        }
    }

    return null;
}

async function getNextAuthSessionAuthFromAppRequest(request: Request): Promise<AuthResult | null> {
    return getNextAuthSessionAuthFromCookies(parseCookieHeader(request.headers.get('cookie')));
}

async function getNextAuthSessionAuthFromPagesRequest(req: NextApiRequest): Promise<AuthResult | null> {
    const cookies = Object.keys(req.cookies ?? {}).length > 0 ? (req.cookies as CookieMap) : parseCookieHeader(readReqCookieHeader(req));
    return getNextAuthSessionAuthFromCookies(cookies);
}

function constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    try {
        return timingSafeEqual(ab, bb);
    } catch {
        return false;
    }
}

function getInternalToken(): string | null {
    const value = process.env.MCP_INTERNAL_TOKEN || process.env.KLETRON_INTERNAL_TOKEN;
    return value && value.trim() ? value.trim() : null;
}

function buildInternalAuth(onBehalfOf: string | null): AuthResult {
    return {
        userId: onBehalfOf || process.env.KLETRON_DEV_USER_ID || 'internal',
        authType: 'internal',
        onBehalfOf: onBehalfOf || undefined,
    };
}

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
    process.env.IDE_JWT_SECRET || 'ide-secret-key-change-in-production'
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
            // Ignore and fall back to dev bypass
        }

        return null;
    } catch {
        return null;
    }
}

export async function getAppRouteAuth(request: Request): Promise<AuthResult | null> {
    // Internal service token (MCP server -> web). Trumps user auth when present
    // because it represents a trusted infra caller; the actual operation is
    // scoped to the user provided via x-on-behalf-of header.
    const internalToken = getInternalToken();
    if (internalToken) {
        const presented = readHeader(request.headers, INTERNAL_TOKEN_HEADERS);
        if (presented && constantTimeEqual(presented, internalToken)) {
            return buildInternalAuth(readHeader(request.headers, ON_BEHALF_HEADERS));
        }
    }

    const devBypass = getDevBypassAuth(request);
    if (devBypass && process.env.KLETRON_AUTH_BYPASS === 'true') {
        return devBypass;
    }

    const token = extractBearerTokenFromHeaders(request.headers);
    if (token) {
        const verified = await verifyBearerToken(token);
        return verified ?? devBypass;
    }

    const sessionAuth = await getNextAuthSessionAuthFromAppRequest(request);
    if (sessionAuth) {
        return sessionAuth;
    }

    return devBypass;
}

export async function requireAppRouteAuth(request: Request) {
    return getAppRouteAuth(request);
}

export async function getPagesRouteAuth(req: NextApiRequest): Promise<AuthResult | null> {
    const internalToken = getInternalToken();
    if (internalToken) {
        const presented = readReqHeader(req, INTERNAL_TOKEN_HEADERS);
        if (presented && constantTimeEqual(presented, internalToken)) {
            return buildInternalAuth(readReqHeader(req, ON_BEHALF_HEADERS));
        }
    }

    const devBypass = DEV_AUTH_BYPASS
        ? { userId: process.env.KLETRON_DEV_USER_ID || 'dev-user', authType: 'session' as const }
        : null;
    if (devBypass && process.env.KLETRON_AUTH_BYPASS === 'true') {
        return devBypass;
    }

    const token = extractBearerTokenFromReq(req);
    if (token) {
        const verified = await verifyBearerToken(token);
        return verified ?? devBypass;
    }

    const sessionAuth = await getNextAuthSessionAuthFromPagesRequest(req);
    if (sessionAuth) {
        return sessionAuth;
    }

    return devBypass;
}

export async function requirePagesRouteAuth(req: NextApiRequest, res: NextApiResponse) {
    const auth = await getPagesRouteAuth(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    return auth;
}
