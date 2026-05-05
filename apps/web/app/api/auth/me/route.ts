// app/api/auth/me/route.ts
// API route to get current user information using NextAuth
import { NextResponse } from 'next/server';
import { authConfig as authOptions } from '../../../../config/auth';
import { getServerSession } from 'next-auth';
import { isMongoBackedUserId } from '../../../../lib/accountEligibility';

export async function GET(_request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized', user: null },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;
        if (process.env.NODE_ENV === "production" && !isMongoBackedUserId(userId)) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized', user: null },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                email: session.user.email,
                name: session.user.name,
            },
        });
    } catch (err) {
        console.error('Get current user error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred', user: null },
            { status: 500 }
        );
    }
}
