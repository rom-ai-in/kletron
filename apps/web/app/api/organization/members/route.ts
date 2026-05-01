// app/api/organization/members/route.ts
// API route to manage organization members (MongoDB version)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import * as organizationService from '@kletron/server/services/organizationService';

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        const groupId = typeof body?.groupId === 'string' ? body.groupId.trim() : '';
        if (!email || !groupId) {
            return NextResponse.json({ success: false, error: 'Email and group are required' }, { status: 400 });
        }

        const org = await organizationService.getOrganizationPayloadForUser(auth.userId);
        if (!org) {
            return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
        }

        const result = await organizationService.addMemberToTenantGroup(
            auth.userId,
            org.tenant.id,
            email,
            groupId
        );
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Organization members POST error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
        }

        const org = await organizationService.getOrganizationPayloadForUser(auth.userId);
        if (!org) {
            return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
        }

        const result = await organizationService.removeMemberFromTenant(auth.userId, org.tenant.id, userId);
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Organization members DELETE error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
