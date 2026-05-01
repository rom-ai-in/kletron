import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "file://",
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

    // Check for NextAuth session cookie
    const sessionCookie = request.cookies.get('next-auth.session.token')?.value;
    if (!sessionCookie) {
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
