// src/__tests__/services/stripeService.test.ts
// Unit tests for stripe service (non-API functions)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPriceId, getPlanFromPriceId } from '../../services/stripeService';

describe('stripeService', () => {
    describe('getPriceId', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            // Reset env vars for each test
            vi.resetModules();
            process.env = {
                ...originalEnv,
                STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly_123',
                STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly_456',
                STRIPE_PRICE_TEAM_MONTHLY: 'price_team_monthly_789',
                STRIPE_PRICE_TEAM_YEARLY: 'price_team_yearly_abc',
            };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('returns correct price ID for pro monthly', () => {
            expect(getPriceId('pro', 'monthly')).toBe('price_pro_monthly_123');
        });

        it('returns correct price ID for pro yearly', () => {
            expect(getPriceId('pro', 'yearly')).toBe('price_pro_yearly_456');
        });

        it('returns correct price ID for team monthly', () => {
            expect(getPriceId('team', 'monthly')).toBe('price_team_monthly_789');
        });

        it('returns correct price ID for team yearly', () => {
            expect(getPriceId('team', 'yearly')).toBe('price_team_yearly_abc');
        });

        it('throws error for unconfigured price ID', () => {
            process.env.STRIPE_PRICE_PRO_MONTHLY = undefined;

            expect(() => getPriceId('pro', 'monthly')).toThrow('Stripe Price ID not configured');
        });

        it('throws error for placeholder price ID', () => {
            process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly_placeholder';

            expect(() => getPriceId('pro', 'monthly')).toThrow('Stripe Price ID not configured');
        });
    });

    describe('getPlanFromPriceId', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            vi.resetModules();
            process.env = {
                ...originalEnv,
                STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly_123',
                STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly_456',
                STRIPE_PRICE_TEAM_MONTHLY: 'price_team_monthly_789',
                STRIPE_PRICE_TEAM_YEARLY: 'price_team_yearly_abc',
            };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('returns pro monthly for matching price ID', () => {
            const result = getPlanFromPriceId('price_pro_monthly_123');

            expect(result).toEqual({ planId: 'pro', billingPeriod: 'monthly' });
        });

        it('returns pro yearly for matching price ID', () => {
            const result = getPlanFromPriceId('price_pro_yearly_456');

            expect(result).toEqual({ planId: 'pro', billingPeriod: 'yearly' });
        });

        it('returns team monthly for matching price ID', () => {
            const result = getPlanFromPriceId('price_team_monthly_789');

            expect(result).toEqual({ planId: 'team', billingPeriod: 'monthly' });
        });

        it('returns team yearly for matching price ID', () => {
            const result = getPlanFromPriceId('price_team_yearly_abc');

            expect(result).toEqual({ planId: 'team', billingPeriod: 'yearly' });
        });

        it('returns null for unknown price ID', () => {
            const result = getPlanFromPriceId('price_unknown_xyz');

            expect(result).toBeNull();
        });

        it('returns null for empty price ID', () => {
            const result = getPlanFromPriceId('');

            expect(result).toBeNull();
        });
    });

    describe('plan price ID mapping consistency', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            vi.resetModules();
            process.env = {
                ...originalEnv,
                STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly_123',
                STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly_456',
                STRIPE_PRICE_TEAM_MONTHLY: 'price_team_monthly_789',
                STRIPE_PRICE_TEAM_YEARLY: 'price_team_yearly_abc',
            };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('getPriceId and getPlanFromPriceId are inverse operations for pro monthly', () => {
            const priceId = getPriceId('pro', 'monthly');
            const planInfo = getPlanFromPriceId(priceId);

            expect(planInfo).toEqual({ planId: 'pro', billingPeriod: 'monthly' });
        });

        it('getPriceId and getPlanFromPriceId are inverse operations for team yearly', () => {
            const priceId = getPriceId('team', 'yearly');
            const planInfo = getPlanFromPriceId(priceId);

            expect(planInfo).toEqual({ planId: 'team', billingPeriod: 'yearly' });
        });
    });
});
