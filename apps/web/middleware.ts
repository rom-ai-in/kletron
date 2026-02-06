import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const DEFAULT_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
];

function parseCorsAllowlist(): string[] {
    const raw = process.env.NUMEZIS_CORS_ALLOWLIST;
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
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, Accept");
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

    const response = NextResponse.next();

    const bypassAuth =
        process.env.NUMEZIS_AUTH_BYPASS === "true" ||
        (process.env.NODE_ENV !== "production" && process.env.NUMEZIS_AUTH_BYPASS !== "false");
    if (bypassAuth) {
        return response;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
                response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
                response.cookies.set({ name, value: "", ...options, maxAge: 0 });
            }
        }
    });

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/auth/login";
        loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ["/api/:path*", "/app/:path*"]
};
