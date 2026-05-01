// app/api/auth/signin/route.ts
// API route for user sign in using NextAuth server-side
import { NextResponse } from 'next/server';
import { authConfig as authOptions } from '../../../../config/auth';
import { getServerSession } from 'next-auth';
import { signIn } from 'next-auth';

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

        // Check if user is already authenticated
        const existingSession = await getServerSession(authOptions);
        if (existingSession?.user) {
            return NextResponse.json(
                { success: true, message: 'Already signed in', user: existingSession.user },
                { status: 200 }
            );
        }

        // Sign in using NextAuth credentials provider (server-side)
        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            return NextResponse.json(
                { success: false, message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Get the session after successful sign in
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Sign in failed' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Sign in successful',
            user: {
                id: (session.user as any).id,
                email: session.user.email,
                name: session.user.name,
            },
        });
    } catch (err) {
        console.error('Sign in error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
