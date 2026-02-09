// src/hooks/useSubscription.ts
// React hook for subscription state management
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SubscriptionResponse, Subscription, PlanId, PlanLimits } from "@numezis/shared/subscriptionTypes";

interface UseSubscriptionReturn {
    subscription: Subscription | null;
    planId: PlanId;
    planLimits: PlanLimits;
    loading: boolean;
    error: string | null;
    isPro: boolean;
    isTeam: boolean;
    isFree: boolean;
    isActive: boolean;
    canUseFeature: (feature: keyof PlanLimits) => boolean;
    refresh: () => Promise<void>;
    redirectToCheckout: (planId: 'pro' | 'team', billingPeriod: 'monthly' | 'yearly') => Promise<void>;
    redirectToPortal: () => Promise<void>;
}

const DEFAULT_LIMITS: PlanLimits = {
    workspaces: 1,
    agentGraphs: 3,
    semanticIndexFiles: 10000,
    hostedTokensPerMonth: 0,
    hasAdvancedAutomations: false,
    hasAntiDrift: false,
    hasPrioritySupport: false,
    hasTeamCollaboration: false,
    hasAdminDashboard: false,
};

export function useSubscription(): UseSubscriptionReturn {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [planId, setPlanId] = useState<PlanId>('free');
    const [planLimits, setPlanLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscription = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/stripe/subscription');

            if (!response.ok) {
                if (response.status === 401) {
                    // Not authenticated - use free plan defaults
                    setSubscription(null);
                    setPlanId('free');
                    setPlanLimits(DEFAULT_LIMITS);
                    return;
                }
                throw new Error('Failed to fetch subscription');
            }

            const data: SubscriptionResponse = await response.json();

            setSubscription(data.subscription);
            setPlanId(data.planId);
            setPlanLimits(data.planLimits);
        } catch (err) {
            console.error('Error fetching subscription:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            // Default to free plan on error
            setSubscription(null);
            setPlanId('free');
            setPlanLimits(DEFAULT_LIMITS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    const canUseFeature = useCallback((feature: keyof PlanLimits): boolean => {
        const value = planLimits[feature];
        if (typeof value === 'boolean') {
            return value;
        }
        // For numeric limits, -1 = unlimited, 0 = disabled
        return value !== 0;
    }, [planLimits]);

    const redirectToCheckout = useCallback(async (
        targetPlanId: 'pro' | 'team',
        billingPeriod: 'monthly' | 'yearly'
    ) => {
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: targetPlanId, billingPeriod }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create checkout session');
            }

            const { url } = await response.json();

            if (url) {
                window.location.href = url;
            }
        } catch (err) {
            console.error('Checkout error:', err);
            throw err;
        }
    }, []);

    const redirectToPortal = useCallback(async () => {
        try {
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create portal session');
            }

            const { url } = await response.json();

            if (url) {
                window.location.href = url;
            }
        } catch (err) {
            console.error('Portal error:', err);
            throw err;
        }
    }, []);

    return {
        subscription,
        planId,
        planLimits,
        loading,
        error,
        isPro: planId === 'pro',
        isTeam: planId === 'team',
        isFree: planId === 'free',
        isActive: subscription?.status === 'active',
        canUseFeature,
        refresh: fetchSubscription,
        redirectToCheckout,
        redirectToPortal,
    };
}
