// app/api/stripe/portal/route.ts
// Create Stripe Billing Portal Session
import { NextRequest, NextResponse } from 'next/server';
import { createBillingPortalSession, getCustomerByEmail } from '@kletron/server/services/stripeService';
import { createServerSupabaseClient } from '@kletron/server/lib/supabase/supabaseServer';
import { getSubscriptionByUserId } from '@kletron/server/services/subscriptionService';

export async function POST(request: NextRequest) {
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

        // Get user's subscription to find Stripe customer ID
        const subscription = await getSubscriptionByUserId(user.id);

        let customerId: string | null = null;

        if (subscription?.stripeCustomerId) {
            customerId = subscription.stripeCustomerId;
        } else if (user.email) {
            // Try to find customer by email
            const customer = await getCustomerByEmail(user.email);
            customerId = customer?.id || null;
        }

        if (!customerId) {
            return NextResponse.json(
                { error: 'No billing account found. Please subscribe to a plan first.' },
                { status: 404 }
            );
        }

        // Build return URL
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const returnUrl = `${origin}/app/account/billing`;

        // Create billing portal session
        const session = await createBillingPortalSession(customerId, returnUrl);

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Stripe portal error:', error);

        const message = error instanceof Error ? error.message : 'Failed to create portal session';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
