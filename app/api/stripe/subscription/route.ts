// app/api/stripe/subscription/route.ts
// Get current user's subscription
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/lib/supabase/supabaseServer';
import { getSubscriptionByUserId, getEffectivePlan, type Subscription, type PlanLimits } from '@/src/services/subscriptionService';

export interface SubscriptionResponse {
    subscription: Subscription | null;
    planId: 'free' | 'pro' | 'team';
    planLimits: PlanLimits;
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
            subscription,
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
