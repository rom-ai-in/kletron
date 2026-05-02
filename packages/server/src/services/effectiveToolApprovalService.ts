import { getToolApprovalConfig } from "../config";
import type { ToolApprovalConfig } from "../config";
import { agentGraphRunService } from "./agentGraphRunService";
import { getMembershipByUserId } from "./organizationService";
import { getTenantToolApprovalConfig } from "./tenantToolApprovalService";

/**
 * Effective policy for a signed-in user: organization doc if present, else deployment defaults.
 */
export async function resolveEffectiveToolApprovalConfigForUser(userId: string): Promise<ToolApprovalConfig> {
    const membership = await getMembershipByUserId(userId);
    if (!membership?.tenantId) {
        return getToolApprovalConfig();
    }
    const tenantCfg = await getTenantToolApprovalConfig(membership.tenantId.toString());
    if (tenantCfg) return tenantCfg;
    return getToolApprovalConfig();
}

export async function hasTenantToolApprovalDoc(userId: string): Promise<boolean> {
    const membership = await getMembershipByUserId(userId);
    if (!membership?.tenantId) return false;
    const tenantCfg = await getTenantToolApprovalConfig(membership.tenantId.toString());
    return tenantCfg !== null;
}

/**
 * Runtime policy for a graph run: uses creator's org when recorded, else deployment defaults.
 */
export async function resolveEffectiveToolApprovalConfigForRun(runId: string): Promise<ToolApprovalConfig> {
    const run = await agentGraphRunService.getRun(runId);
    const uid = run?.createdByUserId;
    if (uid) {
        return resolveEffectiveToolApprovalConfigForUser(uid);
    }
    return getToolApprovalConfig();
}
