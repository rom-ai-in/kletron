import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Same order as packages/server/src/lib/auth/apiAuth.ts — try secure cookie first on HTTPS. */
const NEXTAUTH_SESSION_COOKIE_NAMES = [
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
] as const;

/**
 * Dev defaults for `/api/*` CORS. Browsers send `Origin: null` for some `file://` and packaged
 * Electron loads — include the literal string `null` (not the same as missing Origin).
 *
 * Production: set `KLETRON_CORS_ALLOWLIST` to a comma-separated list of allowed origins, e.g.
 * `https://app.example.com,null` so the desktop app can call the API from `file://` or custom
 * protocols. Use `*` to allow any origin (no credentials on wildcard per browser rules).
 */
const DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "file://",
    "null",
    "kletron://"
];

function parseCorsAllowlist(): string[] {
    const raw = process.env.KLETRON_CORS_ALLOWLIST;
    if (raw && raw.trim().length > 0) {
        return raw.split(",").map((value) => value.trim()).filter(Boolean);
    }
    if (process.env.NODE_ENV !== "production") {
        return DEFAULT_DEV_CORS_ORIGINS;
    }
    return [];
}

function buildCorsHeaders(request: NextRequest): Headers {
    const headers = new Headers();
    const origin = request.headers.get("origin");
    const allowlist = parseCorsAllowlist();
    const allowAny = allowlist.includes("*");
    const isAllowed = !!origin && (allowAny || allowlist.includes(origin));

    if (isAllowed && origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Vary", "Origin");
    } else if (allowAny) {
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Vary", "Origin");
    }

    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, Accept, x-workspace-id");
    headers.set("Access-Control-Max-Age", "86400");
    return headers;
}

function handleCors(request: NextRequest): NextResponse {
    const headers = buildCorsHeaders(request);
    if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers });
    }
    const response = NextResponse.next();
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api/")) {
        return handleCors(request);
    }

    if (!pathname.startsWith("/app/")) {
        return NextResponse.next();
    }

    // Bypass auth in dev when KLETRON_AUTH_BYPASS=true or when not explicitly set in dev
    const bypassAuth =
        process.env.KLETRON_AUTH_BYPASS === "true" ||
        (process.env.NODE_ENV !== "production" && process.env.KLETRON_AUTH_BYPASS !== "false");
    if (bypassAuth) {
        return NextResponse.next();
    }

    const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
    if (!secret) {
        console.error("[middleware] NEXTAUTH_SECRET (or AUTH_SECRET) is not set; refusing /app access.");
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/auth/login";
        loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Presence of a cookie is not enough: expired JWT / wrong NEXTAUTH_SECRET still leaves a cookie
    // string that decrypts to nothing → APIs return 401 while the shell looked "logged in".
    let token: Awaited<ReturnType<typeof getToken>> = null;
    for (const cookieName of NEXTAUTH_SESSION_COOKIE_NAMES) {
        token = await getToken({
            req: request,
            secret,
            cookieName,
        });
        if (token) break;
    }

    if (!token) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/auth/login";
        loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/:path*", "/app/:path*"]
};
