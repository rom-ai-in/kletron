// app/api/auth/register/route.ts
// API route for user registration
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, fullName } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { success: false, message: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        const { client, getResponseCookies } = createRouteHandlerClient(request);

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || '',
                },
            },
        });

        if (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        if (!data.user) {
            return NextResponse.json(
                { success: false, message: 'Registration failed' },
                { status: 400 }
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Registration successful',
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
        console.error('Registration error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
