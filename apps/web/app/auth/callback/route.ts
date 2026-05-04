// app/auth/callback/route.ts
// Handles auth callback (legacy - kept for compatibility)
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = searchParams.get('next') ?? '/';

    return NextResponse.redirect(`${origin}${next}`);
}
