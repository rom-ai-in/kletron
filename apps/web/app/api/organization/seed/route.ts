// app/api/organization/seed/route.ts
// POST endpoint to seed a default organization for the current authenticated user.
// Idempotent — safe to call multiple times.
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import { getSupabaseAdminClient } from '@kletron/server/lib/supabase/supabaseAdmin';

const DEFAULT_TENANT_NAME = 'Numezis';
const DEFAULT_TENANT_SLUG = 'numezis';
const DEFAULT_COMPANY_NAME = 'Numezis SAS';
const DEFAULT_COMPANY_SLUG = 'numezis-sas';
const DEFAULT_GROUP_NAME = 'Engineering';
const DEFAULT_GROUP_DESC = 'Core engineering team';

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const tenantName = (body.tenantName as string)?.trim() || DEFAULT_TENANT_NAME;
        const tenantSlug = (body.tenantSlug as string)?.trim() || DEFAULT_TENANT_SLUG;

        const admin = getSupabaseAdminClient();

        // 1. Check if user already belongs to a tenant
        const { data: existingCtx } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', auth.userId)
            .not('tenant_id', 'is', null)
            .limit(1);

        if (existingCtx && existingCtx.length > 0) {
            return NextResponse.json({
                success: true,
                message: 'User already belongs to an organization',
                alreadySeeded: true,
            });
        }

        // 2. Ensure user_profiles row exists
        const { data: existingProfile } = await admin
            .from('user_profiles')
            .select('id')
            .eq('id', auth.userId)
            .single();

        if (!existingProfile) {
            // Try to get user email from auth.users
            const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
            const email = authUser?.user?.email ?? `${auth.userId}@unknown`;

            const { error: profileErr } = await admin.from('user_profiles').insert({
                id: auth.userId,
                email,
                full_name: email.split('@')[0],
            } as never);

            if (profileErr && !profileErr.message?.includes('duplicate')) {
                return NextResponse.json(
                    { success: false, error: `Failed to create profile: ${profileErr.message}` },
                    { status: 500 }
                );
            }
        }

        // 3. Upsert tenant
        let tenantId: string;
        const { data: existingTenant } = await admin
            .from('tenants')
            .select('id')
            .eq('slug', tenantSlug)
            .single();

        const tenant = existingTenant as unknown as { id: string } | null;
        if (tenant) {
            tenantId = tenant.id;
        } else {
            const { data: newTenant, error: tenantErr } = await admin
                .from('tenants')
                .insert({ name: tenantName, slug: tenantSlug } as never)
                .select('id')
                .single();
            if (tenantErr || !newTenant) {
                return NextResponse.json(
                    { success: false, error: `Failed to create tenant: ${tenantErr?.message}` },
                    { status: 500 }
                );
            }
            tenantId = (newTenant as unknown as { id: string }).id;
        }

        // 4. Upsert company
        let companyId: string;
        const { data: existingCompany } = await admin
            .from('companies')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('slug', DEFAULT_COMPANY_SLUG)
            .single();

        const company = existingCompany as unknown as { id: string } | null;
        if (company) {
            companyId = company.id;
        } else {
            const { data: newCompany, error: companyErr } = await admin
                .from('companies')
                .insert({ tenant_id: tenantId, name: DEFAULT_COMPANY_NAME, slug: DEFAULT_COMPANY_SLUG } as never)
                .select('id')
                .single();
            if (companyErr || !newCompany) {
                return NextResponse.json(
                    { success: false, error: `Failed to create company: ${companyErr?.message}` },
                    { status: 500 }
                );
            }
            companyId = (newCompany as unknown as { id: string }).id;
        }

        // 5. Upsert group
        let groupId: string;
        const { data: existingGroup } = await admin
            .from('groups')
            .select('id')
            .eq('company_id', companyId)
            .eq('name', DEFAULT_GROUP_NAME)
            .single();

        const group = existingGroup as unknown as { id: string } | null;
        if (group) {
            groupId = group.id;
        } else {
            const { data: newGroup, error: groupErr } = await admin
                .from('groups')
                .insert({ company_id: companyId, name: DEFAULT_GROUP_NAME, description: DEFAULT_GROUP_DESC } as never)
                .select('id')
                .single();
            if (groupErr || !newGroup) {
                return NextResponse.json(
                    { success: false, error: `Failed to create group: ${groupErr?.message}` },
                    { status: 500 }
                );
            }
            groupId = (newGroup as unknown as { id: string }).id;
        }

        // 6. Add user to group as admin
        const { data: existingMembership } = await admin
            .from('user_groups')
            .select('id')
            .eq('user_id', auth.userId)
            .eq('group_id', groupId)
            .single();

        if (!existingMembership) {
            const { error: memberErr } = await admin.from('user_groups').insert({
                user_id: auth.userId,
                group_id: groupId,
                role: 'admin',
            } as never);

            if (memberErr && !memberErr.message?.includes('duplicate')) {
                return NextResponse.json(
                    { success: false, error: `Failed to add user to group: ${memberErr.message}` },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Organization seeded successfully',
            organization: { tenantId, companyId, groupId },
        });
    } catch (err) {
        console.error('Organization seed error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
