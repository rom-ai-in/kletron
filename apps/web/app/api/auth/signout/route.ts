// app/api/auth/signout/route.ts
// API route for user sign out using NextAuth server-side
import { NextResponse } from 'next/server';
import { authConfig as authOptions } from '../../../../config/auth';
import { getServerSession } from 'next-auth';
import { signOut } from 'next-auth';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Sign out using NextAuth server-side
        await signOut({ redirect: false });

        return NextResponse.json({
            success: true,
            message: 'Sign out successful',
        });
    } catch (err) {
        console.error('Sign out error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
