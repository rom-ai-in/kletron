// app/api/user-preferences/route.ts
// API route for user preferences (LLM & Graph selection persistence)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";
import * as userPreferencesService from '@/src/services/userPreferencesService';

/**
 * GET /api/user-preferences
 * Retrieve current user's preferences
 */
export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const prefs = await userPreferencesService.getPreferences(auth.userId);

        return NextResponse.json({
            success: true,
            preferences: prefs || {
                userId: auth.userId,
                selectedLlmProvider: null,
                selectedGraphId: null,
                updatedAt: null,
            },
        });
    } catch (err) {
        console.error('Get user preferences error:', err);
        return NextResponse.json(
            { success: false, error: 'Failed to get preferences' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user-preferences
 * Update user preferences (partial update)
 */
export async function PATCH(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { selectedLlmProvider, selectedGraphId } = body;

        // Validate at least one field is being updated
        if (selectedLlmProvider === undefined && selectedGraphId === undefined) {
            return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
            );
        }

        const prefs = await userPreferencesService.updatePreferences(auth.userId, {
            selectedLlmProvider,
            selectedGraphId,
        });

        return NextResponse.json({
            success: true,
            preferences: prefs,
        });
    } catch (err) {
        console.error('Update user preferences error:', err);
        return NextResponse.json(
            { success: false, error: 'Failed to update preferences' },
            { status: 500 }
        );
    }
}
