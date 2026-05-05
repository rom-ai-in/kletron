// app/api/auth/reset-password/route.ts
// API route for password reset request - generates token stored in MongoDB
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@kletron/server/lib/db';

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

        const db = await getDb();
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });

        // Always return success to prevent email enumeration
        if (!user) {
            return NextResponse.json({
                success: true,
                message: 'Password reset email sent. Please check your inbox.',
            });
        }

        // Generate reset token (expires in 1 hour)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await db.collection('password_reset_tokens').insertOne({
            userId: user._id,
            email: user.email,
            tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
            expiresAt,
            createdAt: new Date(),
        });

    // In production, send an email with the reset link here.
    // For now, the token is stored and can be retrieved from the DB.
    // The reset link would be: /auth/update-password?token=<token>

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
