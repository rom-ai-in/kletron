// app/api/organization/route.ts
// API route to get and update the current user's organization info (MongoDB version)
import { NextResponse } from 'next/server';
import { resolveOrganizationAuth } from '../../../lib/resolveOrganizationAuth';
import * as userProfileService from '@kletron/server/services/userProfileService';
import * as organizationService from '@kletron/server/services/organizationService';

export async function GET(request: Request) {
    const auth = await resolveOrganizationAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const profile = await userProfileService.getProfileByUserId(auth.userId);
        const organization = await organizationService.getOrganizationPayloadForUser(auth.userId);

        return NextResponse.json({
            success: true,
            organization,
            profile: profile ? {
                id: profile.id,
                email: profile.email,
                fullName: profile.fullName,
            } : null,
        });
    } catch (err) {
        console.error('Organization GET error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await resolveOrganizationAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, tenantId } = body;

        if (typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'A non-empty name is required' }, { status: 400 });
        }

        const tid =
            typeof tenantId === 'string' && tenantId.trim().length > 0
                ? tenantId.trim()
                : (await organizationService.getOrganizationPayloadForUser(auth.userId))?.tenant.id;

        if (!tid) {
            return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
        }

        const result = await organizationService.updateTenantName(auth.userId, tid, name);
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.error === 'Not allowed' ? 403 : 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Organization PATCH error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
