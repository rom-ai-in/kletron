// app/api/organization/members/route.ts
// API route to manage organization members (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: 'Multi-tenant not available yet' }, { status: 501 });
}

export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: 'Multi-tenant not available yet' }, { status: 501 });
}
