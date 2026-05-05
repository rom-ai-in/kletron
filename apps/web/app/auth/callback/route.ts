// app/auth/callback/route.ts
// Handles auth callback (legacy - kept for compatibility)
import { NextResponse } from 'next/server';
import { normalizeInternalRedirect } from '../../../lib/safeRedirect';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = normalizeInternalRedirect(searchParams.get('next'), '/');

    return NextResponse.redirect(new URL(next, origin));
}
