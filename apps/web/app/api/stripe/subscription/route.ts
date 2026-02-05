// app/api/stripe/subscription/route.ts
// Get current user's subscription
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@numezis/server/lib/supabase/supabaseServer';
import { getSubscriptionByUserId, getEffectivePlan } from '@numezis/server/services/subscriptionService';
import type { SubscriptionResponse } from "@numezis/shared/subscriptionTypes";
import type { Subscription as ServerSubscription } from "@numezis/server/services/subscriptionService";
import type { Subscription as SharedSubscription } from "@numezis/shared/subscriptionTypes";

function toSharedSubscription(subscription: ServerSubscription): SharedSubscription {
    return {
        ...subscription,
        _id: subscription._id ? String(subscription._id) : undefined,
    };
}

export async function GET() {
    try {
        // Get authenticated user
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in.' },
                { status: 401 }
            );
        }

        // Get subscription and effective plan
        const [subscription, effectivePlan] = await Promise.all([
            getSubscriptionByUserId(user.id),
            getEffectivePlan(user.id),
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
