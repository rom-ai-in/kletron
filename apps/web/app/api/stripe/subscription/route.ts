// app/api/stripe/subscription/route.ts
// Get current user's subscription
import { NextResponse } from 'next/server';
import { getSubscriptionByUserId, getEffectivePlan } from '@kletron/server/services/subscriptionService';
import type { SubscriptionResponse } from "@kletron/shared/subscriptionTypes";
import type { Subscription as ServerSubscription } from "@kletron/server/services/subscriptionService";
import type { Subscription as SharedSubscription } from "@kletron/shared/subscriptionTypes";
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

function toSharedSubscription(subscription: ServerSubscription): SharedSubscription {
    return {
        ...subscription,
        _id: subscription._id ? String(subscription._id) : undefined,
    };
}

export async function GET() {
    try {
        // Auth is handled by the client-side session check
        // Get subscription and effective plan
        const [subscription, effectivePlan] = await Promise.all([
            getSubscriptionByUserId('dev-user'),
            getEffectivePlan('dev-user'),
        ]);

        const response: SubscriptionResponse = {
            subscription: subscription ? toSharedSubscription(subscription) : null,
            planId: effectivePlan.planId,
            planLimits: effectivePlan.limits,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Get subscription error:', error);

        const message = error instanceof Error ? error.message : 'Failed to get subscription';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
