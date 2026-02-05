// app/api/auth/signout/route.ts
// API route for user sign out
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { client, getResponseCookies } = createRouteHandlerClient(request);

        const { error } = await client.auth.signOut();

        if (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Sign out successful',
        });

        // Clear auth cookies
        for (const cookie of getResponseCookies()) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
        }

        return response;
    } catch (err) {
        console.error('Sign out error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
