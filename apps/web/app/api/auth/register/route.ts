// app/api/auth/register/route.ts
// API route for user registration with MongoDB persistence
import { NextResponse } from 'next/server';
import { getDb } from '@kletron/server/lib/db';
import { agentGraphService } from '@kletron/server/services/agentGraphService';
import * as organizationService from '@kletron/server/services/organizationService';
import * as userProfileService from '@kletron/server/services/userProfileService';

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

        // Check if user already exists
        const db = await getDb();
        const usersCollection = db.collection('users');
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, message: 'User already exists' },
                { status: 409 }
            );
        }

        const bcrypt = (await import('bcrypt')).default;
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert user into MongoDB and create profile
        const { ObjectId } = await import('mongodb');
        const now = new Date();

        const result = await usersCollection.insertOne({
            _id: new ObjectId(),
            email: email.toLowerCase().trim(),
            passwordHash,
            password: passwordHash,
            name: fullName || null,
            createdAt: now,
            updatedAt: now,
        });

        const userId = result.insertedId.toString();

        // Create user profile
        await userProfileService.upsertProfile(
            userId,
            email.toLowerCase().trim(),
            fullName || null
        );

        try {
            await organizationService.ensureOrganizationForUser(userId, {
                email: email.toLowerCase().trim(),
                fullName: fullName || null,
            });
        } catch (orgErr) {
            console.error('[Register] Failed to ensure organization:', orgErr);
        }

        // Seed default agent graphs for the new user
        try {
            await agentGraphService.ensureDefaultGraphs();
        } catch (seedErr) {
            console.error('[Register] Failed to seed default graphs:', seedErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Registration successful',
            user: {
                id: userId,
                email: email.toLowerCase().trim(),
            },
        });
    } catch (err) {
        console.error('Registration error:', err);
        return NextResponse.json(
            { success: false, message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}