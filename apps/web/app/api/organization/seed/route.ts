// app/api/organization/seed/route.ts
// POST endpoint to seed a default organization (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: 'Multi-tenant not available yet' }, { status: 501 });
}
