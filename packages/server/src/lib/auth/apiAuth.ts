// src/lib/auth/apiAuth.ts
// Shared API auth helpers for app and pages routes (MongoDB/NextAuth version)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, type AuthOptions } from 'next-auth';
import { API_TOKEN_PREFIX, hashApiToken } from './apiTokens';
import * as apiTokenService from '@kletron/server/services/apiTokenService';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { resolveIdeTokenSecret } from './ideTokenSecret';

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
const NEXTAUTH_SESSION_OPTIONS: AuthOptions = {
    providers: [],
    session: {
        strategy: 'jwt' as const,
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user }: { token: any; user?: any }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
};

type CookieMap = Record<string, string>;

function isMongoBackedUserId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

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
    if (typeof userId !== 'string' || !userId.trim()) {
        return null;
    }
    const normalized = userId.trim();
    if (process.env.NODE_ENV === 'production' && !isMongoBackedUserId(normalized)) {
        return null;
    }
    return normalized;
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

async function getNextAuthSessionAuthFromServer(): Promise<AuthResult | null> {
    try {
        const session = await getServerSession(NEXTAUTH_SESSION_OPTIONS);
        const user = session?.user as Record<string, unknown> | undefined;
        const userId = user?.id ?? user?.sub;
        if (typeof userId === 'string' && userId.trim()) {
            const normalized = userId.trim();
            if (process.env.NODE_ENV === 'production' && !isMongoBackedUserId(normalized)) {
                return null;
            }
            return { userId: normalized, authType: 'session' };
        }
    } catch {
        // Ignore and fall back to cookie parsing / bearer auth.
    }

    return null;
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

/**
 * The dev bypass authenticates callers as a fixed user with no credentials, so
 * it is gated on NODE_ENV being *explicitly* a local value. Testing
 * `NODE_ENV !== 'production'` instead would have turned the bypass on for any
 * deployment that simply forgot to set NODE_ENV.
 */
const LOCAL_NODE_ENVS = new Set(['development', 'test']);

const DEV_AUTH_BYPASS =
    process.env.KLETRON_AUTH_BYPASS === 'true' ||
    (LOCAL_NODE_ENVS.has(process.env.NODE_ENV ?? '') &&
        process.env.KLETRON_AUTH_BYPASS !== 'false');

/**
 * Strict loopback match on the Host header. A substring test would accept
 * attacker-controlled hosts such as `notlocalhost.example.com`, so the
 * hostname is isolated from any port and compared exactly.
 */
function isLocalhostHost(host: string): boolean {
    const trimmed = String(host ?? '').trim().toLowerCase();
    if (!trimmed) return false;

    // Bracketed IPv6 literal, e.g. [::1]:3000
    const ipv6 = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
    const hostname = ipv6 ? ipv6[1] : trimmed.replace(/:\d+$/, '');

    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0:0:0:0:0:0:0:1'
    );
}

/**
 * Dev bypass is only ever granted to loopback callers. `host` is required so
 * both the App Router and the Pages Router enforce the same check — an earlier
 * version left the Pages Router path unguarded.
 */
function getDevBypassAuthForHost(host: string | null): AuthResult | null {
    if (!DEV_AUTH_BYPASS) return null;
    if (host !== null && !isLocalhostHost(host)) return null;
    return {
        userId: process.env.KLETRON_DEV_USER_ID || 'dev-user',
        authType: 'session',
    };
}

function getDevBypassAuth(request?: Request): AuthResult | null {
    return getDevBypassAuthForHost(request ? request.headers.get('host') || '' : null);
}

if (!process.env.IDE_JWT_SECRET?.trim() && process.env.NODE_ENV === 'production') {
    console.error(
        '[auth] IDE_JWT_SECRET is not set — IDE token authentication is disabled in production.'
    );
}

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

        // Check if it's an IDE access token. Resolved per call so the key is
        // never a committed constant and so tests can toggle configuration.
        const ideSecret = resolveIdeTokenSecret();
        if (!ideSecret) {
            return null;
        }
        try {
            const verified = await jwtVerify(token, ideSecret);
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

    const sessionAuth = await getNextAuthSessionAuthFromServer();
    if (sessionAuth) {
        return sessionAuth;
    }

    const cookieSessionAuth = await getNextAuthSessionAuthFromAppRequest(request);
    if (cookieSessionAuth) {
        return cookieSessionAuth;
    }

    const token = extractBearerTokenFromHeaders(request.headers);
    if (token) {
        const verified = await verifyBearerToken(token);
        return verified ?? devBypass;
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

    const devBypass = getDevBypassAuthForHost(
        typeof req.headers.host === 'string' ? req.headers.host : ''
    );
    if (devBypass && process.env.KLETRON_AUTH_BYPASS === 'true') {
        return devBypass;
    }

    const sessionAuth = await getNextAuthSessionAuthFromPagesRequest(req);
    if (sessionAuth) {
        return sessionAuth;
    }

    const token = extractBearerTokenFromReq(req);
    if (token) {
        const verified = await verifyBearerToken(token);
        return verified ?? devBypass;
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
