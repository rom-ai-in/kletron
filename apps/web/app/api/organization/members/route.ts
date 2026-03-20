// app/api/organization/members/route.ts
// API route to manage organization members (invite / remove)
import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';
import { getSupabaseAdminClient } from '@kletron/server/lib/supabase/supabaseAdmin';
import type { UserContext, UserProfile, Group } from '@kletron/shared/supabase/types';

// ─── POST: Add a user to a group ────────────────────────────────────────────
export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { email, groupId, role } = body;

        if (!email || typeof email !== 'string' || !groupId || typeof groupId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'email and groupId are required' },
                { status: 400 }
            );
        }

        // Sanitize role — only allow 'admin' or 'member'
        const safeRole = role === 'admin' ? 'admin' : 'member';

        const admin = getSupabaseAdminClient();

        // 1. Verify the inviter belongs to a tenant
        const { data: rawInviterCtx } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', auth.userId)
            .limit(1);

        const inviterCtx = (rawInviterCtx ?? []) as unknown as UserContext[];

        if (inviterCtx.length === 0 || !inviterCtx[0].tenant_id) {
            return NextResponse.json({ success: false, error: 'Inviter has no organization' }, { status: 403 });
        }

        const inviterTenantId = inviterCtx[0].tenant_id;

        // 2. Verify the target group belongs to the inviter's tenant
        //    Group → Company → Tenant chain
        const { data: rawGroup, error: groupError } = await admin
            .from('groups')
            .select('*')
            .eq('id', groupId)
            .single();

        const targetGroup = rawGroup as unknown as Group | null;

        if (groupError || !targetGroup) {
            return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
        }

        // Check company → tenant ownership
        const { data: rawCompany } = await admin
            .from('companies')
            .select('tenant_id')
            .eq('id', targetGroup.company_id)
            .single();

        const company = rawCompany as unknown as { tenant_id: string } | null;

        if (!company || company.tenant_id !== inviterTenantId) {
            return NextResponse.json(
                { success: false, error: 'Group does not belong to your organization' },
                { status: 403 }
            );
        }

        // 3. Find the target user by email
        const { data: rawProfile, error: profileError } = await admin
            .from('user_profiles')
            .select('*')
            .eq('email', email.trim().toLowerCase())
            .single();

        const targetProfile = rawProfile as unknown as UserProfile | null;

        if (profileError || !targetProfile) {
            return NextResponse.json(
                { success: false, error: `No user found with email: ${email}` },
                { status: 404 }
            );
        }

        // 4. Check if already a member of this group
        const { data: existingMembership } = await admin
            .from('user_groups')
            .select('id')
            .eq('user_id', targetProfile.id)
            .eq('group_id', groupId)
            .limit(1);

        if (existingMembership && existingMembership.length > 0) {
            return NextResponse.json(
                { success: false, error: 'User is already a member of this group' },
                { status: 409 }
            );
        }

        // 5. Add user to the group
        const { data: membership, error: insertError } = await admin
            .from('user_groups')
            .insert({
                user_id: targetProfile.id,
                group_id: groupId,
                role: safeRole,
            } as never)
            .select()
            .single();

        if (insertError) {
            console.error('Insert user_group error:', insertError);
            return NextResponse.json({ success: false, error: 'Failed to add member' }, { status: 500 });
        }

        return NextResponse.json({ success: true, membership });
    } catch (err) {
        console.error('Organization members POST error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// ─── DELETE: Remove a user from a specific group or all groups ───────────────
export async function DELETE(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { userId, groupId } = body;

        if (!userId || typeof userId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        // Prevent self-removal
        if (userId === auth.userId) {
            return NextResponse.json(
                { success: false, error: 'You cannot remove yourself from the organization' },
                { status: 400 }
            );
        }

        const admin = getSupabaseAdminClient();

        // 1. Verify the requester belongs to a tenant
        const { data: rawRequesterCtx } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', auth.userId);

        const requesterCtx = (rawRequesterCtx ?? []) as unknown as UserContext[];

        if (requesterCtx.length === 0 || !requesterCtx[0].tenant_id) {
            return NextResponse.json({ success: false, error: 'No organization' }, { status: 403 });
        }

        const requesterTenantId = requesterCtx[0].tenant_id;

        // Enforce admin role for removals
        const isAdmin = requesterCtx.some(c => c.group_role === 'admin');
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: 'Only admins can remove members' }, { status: 403 });
        }

        // 2. Verify the target user is in the SAME tenant
        const { data: rawTargetCtx } = await admin
            .from('user_context')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', requesterTenantId);

        const targetCtx = (rawTargetCtx ?? []) as unknown as UserContext[];

        if (targetCtx.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Target user is not in your organization' },
                { status: 404 }
            );
        }

        if (groupId && typeof groupId === 'string') {
            // 3a. Remove from specific group — verify group is in this tenant
            const targetGroupIds = targetCtx
                .map(c => c.group_id)
                .filter((id): id is string => !!id);

            if (!targetGroupIds.includes(groupId)) {
                return NextResponse.json(
                    { success: false, error: 'User is not in this group, or group is outside your tenant' },
                    { status: 404 }
                );
            }

            const { error } = await admin
                .from('user_groups')
                .delete()
                .eq('user_id', userId)
                .eq('group_id', groupId);

            if (error) {
                console.error('Delete user_group error:', error);
                return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
            }
        } else {
            // 3b. Remove from ALL groups in this tenant
            const groupIds = targetCtx
                .map(c => c.group_id)
                .filter((id): id is string => !!id);

            if (groupIds.length > 0) {
                const { error } = await admin
                    .from('user_groups')
                    .delete()
                    .eq('user_id', userId)
                    .in('group_id', groupIds);

                if (error) {
                    console.error('Delete user_groups error:', error);
                    return NextResponse.json({ success: false, error: 'Failed to remove member' }, { status: 500 });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Organization members DELETE error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
