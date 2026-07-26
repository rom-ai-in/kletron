// Admin authorization for instance-wide settings.
//
// Some configuration is global to the deployment rather than owned by a user —
// the LLM provider config is the clearest example: it decides which endpoint
// every prompt in the instance is sent to. Authentication alone is not a
// sufficient gate for those writes, because any member could repoint the
// instance at an endpoint they control and observe all traffic.
//
// Authorization reuses the tenant role already modelled in organizationService
// (`tenant_members.role`), so there is one notion of "admin" in the product.

import { getMembershipByUserId } from '../../services/organizationService';
import { getAppRouteAuth, type AuthResult } from './apiAuth';

export type AdminAuthFailure = {
    ok: false;
    status: 401 | 403;
    error: string;
};

export type AdminAuthSuccess = {
    ok: true;
    auth: AuthResult;
};

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

/**
 * True when the identity may change instance-wide settings.
 *
 * `internal` identities are trusted infrastructure callers (the MCP server
 * presenting the shared internal token), not end users, so they pass. Every
 * user-backed identity must hold the tenant `admin` role.
 */
export async function isAdminIdentity(auth: AuthResult): Promise<boolean> {
    if (auth.authType === 'internal' && !auth.onBehalfOf) return true;

    const userId = auth.onBehalfOf ?? auth.userId;
    if (!userId) return false;

    try {
        const membership = await getMembershipByUserId(userId);
        return membership?.role === 'admin';
    } catch {
        // Membership lookup failure must not be read as authorization.
        return false;
    }
}

/**
 * Authenticate, then require the tenant admin role.
 * Returns a discriminated result so routes can map it to a response without
 * accidentally continuing on the failure path.
 */
export async function requireAppRouteAdmin(request: Request): Promise<AdminAuthResult> {
    const auth = await getAppRouteAuth(request);
    if (!auth) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }

    if (!(await isAdminIdentity(auth))) {
        return {
            ok: false,
            status: 403,
            error: 'Forbidden: instance LLM configuration can only be changed by an organization admin',
        };
    }

    return { ok: true, auth };
}
