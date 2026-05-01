// app/api/auth/update-password/route.ts
// API route for updating password after reset - validates token from DB
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '@kletron/server/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            return NextResponse.json(
                { success: false, message: 'Token and password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, message: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        const db = await getDb();

        // Find and verify reset token
        const tokenDoc = await db.collection('password_reset_tokens').findOne({
            tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
            expiresAt: { $gte: new Date() },
        });

        if (!tokenDoc) {
            return NextResponse.json(
                { success: false, message: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        // Hash new password and update user
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await db.collection('users').updateOne(
            { _id: tokenDoc.userId },
            { $set: { password: passwordHash, updatedAt: new Date() } }
        );

        // Invalidate the used token
        await db.collection('password_reset_tokens').deleteOne({ _id: tokenDoc._id });

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (err) {
        console.error('Password update error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
