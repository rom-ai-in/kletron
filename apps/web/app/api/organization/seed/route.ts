// app/api/organization/seed/route.ts
// POST endpoint to ensure a default organization exists for the current user
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import * as organizationService from '@kletron/server/services/organizationService';

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const organization = await organizationService.getOrganizationPayloadForUser(auth.userId);
        return NextResponse.json({ success: true, organization });
    } catch (err) {
        console.error('Organization seed error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
