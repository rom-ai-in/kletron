// src/__tests__/services/subscriptionService.test.ts
// Unit tests for subscription service (plan limits and helpers)
import { describe, it, expect } from 'vitest';
import { getPlanLimits, type PlanId, type PlanLimits } from '@numezis/server/services/subscriptionService';

describe('subscriptionService', () => {
    describe('getPlanLimits', () => {
        it('returns correct limits for free plan', () => {
            const limits = getPlanLimits('free');

            expect(limits).toEqual({
                workspaces: 1,
                agentGraphs: 3,
                semanticIndexFiles: 10000,
                hostedTokensPerMonth: 0,
                hasAdvancedCampaigns: false,
                hasAntiDrift: false,
                hasPrioritySupport: false,
                hasTeamCollaboration: false,
                hasAdminDashboard: false,
            });
        });

        it('returns correct limits for pro plan', () => {
            const limits = getPlanLimits('pro');

            expect(limits.workspaces).toBe(5);
            expect(limits.agentGraphs).toBe(-1); // unlimited
            expect(limits.semanticIndexFiles).toBe(100000);
            expect(limits.hostedTokensPerMonth).toBe(500000);
            expect(limits.hasAdvancedCampaigns).toBe(true);
            expect(limits.hasAntiDrift).toBe(true);
            expect(limits.hasPrioritySupport).toBe(true);
            expect(limits.hasTeamCollaboration).toBe(false);
            expect(limits.hasAdminDashboard).toBe(false);
        });

        it('returns correct limits for team plan', () => {
            const limits = getPlanLimits('team');

            expect(limits.workspaces).toBe(-1); // unlimited
            expect(limits.agentGraphs).toBe(-1); // unlimited
            expect(limits.semanticIndexFiles).toBe(-1); // unlimited
            expect(limits.hostedTokensPerMonth).toBe(1000000);
            expect(limits.hasAdvancedCampaigns).toBe(true);
            expect(limits.hasAntiDrift).toBe(true);
            expect(limits.hasPrioritySupport).toBe(true);
            expect(limits.hasTeamCollaboration).toBe(true);
            expect(limits.hasAdminDashboard).toBe(true);
        });

        it('defaults to free plan for unknown plan IDs', () => {
            const limits = getPlanLimits('unknown' as PlanId);

            expect(limits.workspaces).toBe(1);
            expect(limits.hostedTokensPerMonth).toBe(0);
        });
    });

    describe('plan feature comparison', () => {
        it('pro has more workspaces than free', () => {
            const freeLimits = getPlanLimits('free');
            const proLimits = getPlanLimits('pro');

            expect(proLimits.workspaces).toBeGreaterThan(freeLimits.workspaces);
        });

        it('team has more tokens than pro', () => {
            const proLimits = getPlanLimits('pro');
            const teamLimits = getPlanLimits('team');

            expect(teamLimits.hostedTokensPerMonth).toBeGreaterThan(proLimits.hostedTokensPerMonth);
        });

        it('only team has collaboration features', () => {
            const freeLimits = getPlanLimits('free');
            const proLimits = getPlanLimits('pro');
            const teamLimits = getPlanLimits('team');

            expect(freeLimits.hasTeamCollaboration).toBe(false);
            expect(proLimits.hasTeamCollaboration).toBe(false);
            expect(teamLimits.hasTeamCollaboration).toBe(true);
        });

        it('only team has admin dashboard', () => {
            const freeLimits = getPlanLimits('free');
            const proLimits = getPlanLimits('pro');
            const teamLimits = getPlanLimits('team');

            expect(freeLimits.hasAdminDashboard).toBe(false);
            expect(proLimits.hasAdminDashboard).toBe(false);
            expect(teamLimits.hasAdminDashboard).toBe(true);
        });
    });
});
