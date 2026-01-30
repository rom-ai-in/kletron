// app/api/auth/update-password/route.ts
// API route for updating password after reset
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/src/lib/supabase/supabaseServer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { success: false, message: 'Password is required' },
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

        const { error } = await client.auth.updateUser({
            password,
        });

        if (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Password updated successfully',
        });

        // Set updated cookies
        for (const cookie of getResponseCookies()) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
        }

        return response;
    } catch (err) {
        console.error('Password update error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
