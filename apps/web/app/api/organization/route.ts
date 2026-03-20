// app/api/organization/route.ts
// API route to get and update the current user's organization (tenant) info
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import { getSupabaseAdminClient } from '@kletron/server/lib/supabase/supabaseAdmin';
import type { UserContext, Tenant, Company, Group } from '@kletron/shared/supabase/types';

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const admin = getSupabaseAdminClient();

        // Get the user's full context (tenant, company, groups) via the view
        const { data: rawContexts, error: ctxError } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', auth.userId);

        // FIX: Check error BEFORE casting the data
        if (ctxError) {
            // Gracefully handle missing view/table (schema not deployed yet)
            console.error('Error fetching user context:', ctxError.message, ctxError.code);
            const missingSchema = ctxError.code === '42P01'
                || ctxError.code === 'PGRST204'
                || ctxError.code === 'PGRST205'
                || ctxError.message?.includes('does not exist')
                || ctxError.message?.includes('schema cache');
            if (missingSchema) {
                return NextResponse.json({
                    success: true,
                    organization: null,
                    message: 'Organization schema not set up yet',
                });
            }
            return NextResponse.json({ success: false, error: 'Failed to fetch organization' }, { status: 500 });
        }

        const contexts = (rawContexts ?? []) as unknown as UserContext[];

        if (contexts.length === 0 || !contexts[0].tenant_id) {
            return NextResponse.json({
                success: true,
                organization: null,
                message: 'User is not part of any organization',
            });
        }

        const tenantId = contexts[0].tenant_id;

        // Fetch the full tenant record
        const { data: rawTenant, error: tenantError } = await admin
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        const tenant = rawTenant as unknown as Tenant | null;

        if (tenantError || !tenant) {
            return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
        }

        // Fetch companies under this tenant
        const { data: rawCompanies } = await admin
            .from('companies')
            .select('*')
            .eq('tenant_id', tenantId);

        const companies = (rawCompanies ?? []) as unknown as Company[];

        // Fetch all members via user_context for this tenant
        const { data: rawAllMembers } = await admin
            .from('user_context')
            .select('*')
            .eq('tenant_id', tenantId);

        const allMembers = (rawAllMembers ?? []) as unknown as UserContext[];

        // Deduplicate members (a user can appear in multiple groups)
        const membersMap = new Map<string, {
            user_id: string;
            email: string;
            full_name: string | null;
            avatar_url: string | null;
            groups: { group_id: string; group_name: string; group_role: string }[];
        }>();

        for (const row of allMembers) {
            const existing = membersMap.get(row.user_id);
            if (existing) {
                if (row.group_id && row.group_name) {
                    existing.groups.push({
                        group_id: row.group_id,
                        group_name: row.group_name,
                        group_role: row.group_role || 'member',
                    });
                }
            } else {
                membersMap.set(row.user_id, {
                    user_id: row.user_id,
                    email: row.email,
                    full_name: row.full_name,
                    avatar_url: row.avatar_url,
                    groups: row.group_id && row.group_name
                        ? [{ group_id: row.group_id, group_name: row.group_name, group_role: row.group_role || 'member' }]
                        : [],
                });
            }
        }

        // Fetch groups under the tenant's companies
        const companyIds = companies.map(c => c.id);
        let groups: Group[] = [];
        if (companyIds.length > 0) {
            const { data: rawGroups } = await admin
                .from('groups')
                .select('*')
                .in('company_id', companyIds);
            groups = (rawGroups ?? []) as unknown as Group[];
        }

        // Determine current user's best role across all groups
        // If user is 'admin' in ANY group, they get admin role
        const currentUserRole = contexts.some(c => c.group_role === 'admin') ? 'admin' : 'member';

        return NextResponse.json({
            success: true,
            organization: {
                tenant,
                companies,
                groups,
                members: Array.from(membersMap.values()),
                currentUserRole,
                stats: {
                    memberCount: membersMap.size,
                    groupCount: groups.length,
                    companyCount: companies.length,
                },
            },
        });
    } catch (err) {
        console.error('Organization GET error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { tenantId, name } = body;

        if (!tenantId || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'tenantId and a non-empty name are required' }, { status: 400 });
        }

        // Sanitize name
        const sanitizedName = name.trim().slice(0, 255);

        const admin = getSupabaseAdminClient();

        // Verify the user belongs to this tenant AND has admin role
        const { data: rawCtx } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', auth.userId)
            .eq('tenant_id', tenantId);

        const ctx = (rawCtx ?? []) as unknown as UserContext[];

        if (ctx.length === 0) {
            return NextResponse.json({ success: false, error: 'Not authorized for this tenant' }, { status: 403 });
        }

        // Enforce admin role: user must be admin in at least one group
        const isAdmin = ctx.some(c => c.group_role === 'admin');
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Only admins can rename the organization' }, { status: 403 });
        }

        // Update tenant name
        const { data: updated, error } = await admin
            .from('tenants')
            .update({ name: sanitizedName } as never)
            .eq('id', tenantId)
            .select()
            .single();

        if (error) {
            console.error('Tenant update error:', error);
            return NextResponse.json({ success: false, error: 'Failed to update tenant' }, { status: 500 });
        }

        return NextResponse.json({ success: true, tenant: updated });
    } catch (err) {
        console.error('Organization PATCH error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
