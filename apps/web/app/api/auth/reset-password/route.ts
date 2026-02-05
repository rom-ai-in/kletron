// app/api/auth/reset-password/route.ts
// API route for password reset request
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@numezis/server/lib/supabase/supabaseServer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { success: false, message: 'Email is required' },
                { status: 400 }
            );
        }

        const { client } = createRouteHandlerClient(request);

        // Get the origin from the request headers for redirect URL
        const origin = request.headers.get('origin') || '';
        const redirectTo = `${origin}/auth/update-password`;

        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        if (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Password reset email sent. Please check your inbox.',
        });
    } catch (err) {
        console.error('Password reset error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
