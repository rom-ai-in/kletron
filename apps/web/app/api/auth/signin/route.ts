// app/api/auth/signin/route.ts
// API route for user sign in
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: 'Email and password are required' },
                { status: 400 }
            );
        }

        const { client, getResponseCookies } = createRouteHandlerClient(request);

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 401 }
            );
        }

        if (!data.user) {
            return NextResponse.json(
                { success: false, message: 'Sign in failed' },
                { status: 401 }
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Sign in successful',
            user: {
                id: data.user.id,
                email: data.user.email,
            },
        });

        // Set auth cookies
        for (const cookie of getResponseCookies()) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
        }

        return response;
    } catch (err) {
        console.error('Sign in error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
