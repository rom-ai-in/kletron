// app/api/auth/signin/route.ts
// JSON sign-in API used by desktop / internal clients. Delegates to NextAuth credentials
// flow (CSRF + /api/auth/callback/credentials) so session cookies match [...nextauth].
import { NextResponse } from "next/server";
import { authConfig as authOptions } from "../../../../config/auth";
import { getServerSession } from "next-auth";
import { validateUserCredentials } from "../../../../lib/validateUserCredentials";
import { resolveDemoCredentials } from "../../../../lib/demoCredentials";

async function resolveSignedInUser(email: string, password: string) {
    const demoProfile = await resolveDemoCredentials(email, password);
    if (demoProfile) {
        return demoProfile;
    }
    const user = await validateUserCredentials(email, password);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.fullName };
}

function appendSetCookies(from: Response, to: NextResponse) {
    const headersWithGetter = from.headers as Headers & { getSetCookie?: () => string[] };
    const list =
        typeof headersWithGetter.getSetCookie === "function" ? headersWithGetter.getSetCookie() : null;
    if (list?.length) {
        for (const c of list) {
            to.headers.append("Set-Cookie", c);
        }
        return;
    }
    const single = from.headers.get("set-cookie");
    if (single) {
        to.headers.append("Set-Cookie", single);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        const existingSession = await getServerSession(authOptions);
        if (existingSession?.user) {
            return NextResponse.json(
                {
                    success: true,
                    message: "Already signed in",
                    user: existingSession.user,
                },
                { status: 200 }
            );
        }

        const origin = new URL(request.url).origin;
        const cookieHeader = request.headers.get("cookie") ?? "";

        const csrfRes = await fetch(`${origin}/api/auth/csrf`, {
            headers: { cookie: cookieHeader },
        });
        if (!csrfRes.ok) {
            return NextResponse.json(
                { success: false, message: "Authentication bootstrap failed" },
                { status: 500 }
            );
        }
        const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
        if (!csrfJson.csrfToken) {
            return NextResponse.json(
                { success: false, message: "Missing CSRF token" },
                { status: 500 }
            );
        }

        const params = new URLSearchParams({
            csrfToken: csrfJson.csrfToken,
            email: String(email),
            password: String(password),
            callbackUrl: `${origin}/app`,
            json: "true",
        });

        const authRes = await fetch(`${origin}/api/auth/callback/credentials`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                cookie: cookieHeader,
            },
            body: params.toString(),
        });

        const raw = await authRes.text();
        let parsed: { error?: string; url?: string } = {};
        try {
            parsed = JSON.parse(raw) as typeof parsed;
        } catch {
            // Non-JSON response — treat as failure
        }

        if (!authRes.ok || parsed.error) {
            return NextResponse.json(
                { success: false, message: "Invalid credentials" },
                { status: 401 }
            );
        }

        const profile = await resolveSignedInUser(String(email), String(password));
        if (!profile) {
            return NextResponse.json(
                { success: false, message: "Sign in failed" },
                { status: 401 }
            );
        }

        const res = NextResponse.json({
            success: true,
            message: "Sign in successful",
            user: {
                id: profile.id,
                email: profile.email,
                name: profile.name,
            },
        });
        appendSetCookies(authRes, res);
        return res;
    } catch (err) {
        console.error("Sign in error:", err);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
