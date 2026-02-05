import { NextResponse } from 'next/server';
import { getDiffsForWindow } from '@numezis/server/services/gitLocalService';
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({"error": "Unauthorized"}), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const url = new URL(request.url);
    const pathValue = url.searchParams.get('path');
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const granularity = url.searchParams.get('granularity') ?? 'day';

    if (pathValue === null || !start || !end) {
        return NextResponse.json(
            { error: 'Missing required query parameters: path, start, end' },
            { status: 400 }
        );
    }

    try {
        const diffs = await getDiffsForWindow(pathValue, start, end);
        return NextResponse.json({ diffs, granularity });
    } catch (e: any) {
        console.error('Git diff API error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
