import { getToolApprovalConfig } from "../config";
import type { ToolApprovalConfig } from "../config";
import { agentGraphRunService } from "./agentGraphRunService";
import { getMembershipByUserId } from "./organizationService";
import { getTenantToolApprovalConfig } from "./tenantToolApprovalService";

export type ToolApprovalPolicyMeta = {
    scope: "organization" | "deployment";
    /** True when this organization has its own Mongo doc (not only inherited deployment defaults). */
    hasOrganizationOverride: boolean;
};

export async function getEffectiveToolApprovalForUser(userId: string): Promise<{
    config: ToolApprovalConfig;
    policyMeta: ToolApprovalPolicyMeta;
}> {
    const membership = await getMembershipByUserId(userId);
    if (!membership?.tenantId) {
        return {
            config: getToolApprovalConfig(),
            policyMeta: { scope: "deployment", hasOrganizationOverride: false },
        };
    }
    const tenantCfg = await getTenantToolApprovalConfig(membership.tenantId.toString());
    return {
        config: tenantCfg ?? getToolApprovalConfig(),
        policyMeta: {
            scope: "organization",
            hasOrganizationOverride: tenantCfg !== null,
        },
    };
}

/**
 * Effective policy for a signed-in user: organization doc if present, else deployment defaults.
 */
export async function resolveEffectiveToolApprovalConfigForUser(userId: string): Promise<ToolApprovalConfig> {
    const { config } = await getEffectiveToolApprovalForUser(userId);
    return config;
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
