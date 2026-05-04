// JSON sign-out helper for non-browser clients. Proxies to NextAuth's POST /api/auth/signout
// (handled by [...nextauth]) so cookies are cleared correctly — avoids routing recursion under signout/.
import { NextResponse } from "next/server";
import { authConfig as authOptions } from "../../../../../config/auth";
import { getServerSession } from "next-auth";

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
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const origin = new URL(request.url).origin;
        const cookieHeader = request.headers.get("cookie") ?? "";

        const csrfRes = await fetch(`${origin}/api/auth/csrf`, {
            headers: { cookie: cookieHeader },
        });
        if (!csrfRes.ok) {
            return NextResponse.json(
                { success: false, message: "Sign out bootstrap failed" },
                { status: 500 }
            );
        }
        const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
        if (!csrfJson.csrfToken) {
            return NextResponse.json({ success: false, message: "Missing CSRF token" }, { status: 500 });
        }

        const signOutRes = await fetch(`${origin}/api/auth/signout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                cookie: cookieHeader,
            },
            body: new URLSearchParams({
                csrfToken: csrfJson.csrfToken,
                json: "true",
            }).toString(),
        });

        const res = NextResponse.json({
            success: signOutRes.ok,
            message: signOutRes.ok ? "Sign out successful" : "Sign out failed",
        });
        appendSetCookies(signOutRes, res);
        return res;
    } catch (err) {
        console.error("Sign out error:", err);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
