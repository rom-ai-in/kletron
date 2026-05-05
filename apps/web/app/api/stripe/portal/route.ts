// app/api/stripe/portal/route.ts
// Create Stripe Billing Portal Session
import { NextRequest, NextResponse } from 'next/server';
import { createBillingPortalSession } from '@kletron/server/services/stripeService';
import { getSubscriptionByUserId } from '@kletron/server/services/subscriptionService';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const auth = await requireAppRouteAuth(request);

        if (!auth) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in.' },
                { status: 401 }
            );
        }

        // Get user's subscription to find Stripe customer ID
        const subscription = await getSubscriptionByUserId(auth.userId);

        let customerId: string | null = null;

        if (subscription?.stripeCustomerId) {
            customerId = subscription.stripeCustomerId;
        }

        if (!customerId) {
            return NextResponse.json(
                { error: 'No billing account found. Please subscribe to a plan first.' },
                { status: 404 }
            );
        }

        // Build return URL
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const returnUrl = `${origin}/app/organization/billing`;

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
