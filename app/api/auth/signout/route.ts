// app/api/auth/signout/route.ts
// API route for user sign out
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/src/lib/supabase/supabaseServer';

export async function POST(request: Request) {
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
