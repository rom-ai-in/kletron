// app/api/auth/update-password/route.ts
// API route for updating password after reset - validates token from DB
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
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

        const rawUserId = tokenDoc.userId as string | ObjectId;
        let userObjectId: ObjectId;
        try {
            userObjectId = rawUserId instanceof ObjectId ? rawUserId : new ObjectId(String(rawUserId));
        } catch {
            return NextResponse.json(
                { success: false, message: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        const bcrypt = (await import('bcrypt')).default;
        const passwordHash = await bcrypt.hash(newPassword, 12);
        const ur = await db.collection('users').updateOne(
            { _id: userObjectId },
            { $set: { passwordHash, password: passwordHash, updatedAt: new Date() } }
        );

        if (ur.matchedCount === 0) {
            return NextResponse.json(
                { success: false, message: 'Account not found; request a new reset link' },
                { status: 404 }
            );
        }

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
