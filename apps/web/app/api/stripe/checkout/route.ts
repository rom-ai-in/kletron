// app/api/stripe/checkout/route.ts
// Create Stripe Checkout Session for subscription
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@numezis/server/services/stripeService';
import { createServerSupabaseClient } from '@numezis/server/lib/supabase/supabaseServer';

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

        // Parse request body
        const body = await request.json();
        const { planId, billingPeriod } = body as {
            planId: 'pro' | 'team';
            billingPeriod: 'monthly' | 'yearly';
        };

        // Validate input
        if (!planId || !['pro', 'team'].includes(planId)) {
            return NextResponse.json(
                { error: 'Invalid plan. Must be "pro" or "team".' },
                { status: 400 }
            );
        }

        if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
            return NextResponse.json(
                { error: 'Invalid billing period. Must be "monthly" or "yearly".' },
                { status: 400 }
            );
        }

        // Build success/cancel URLs
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const successUrl = `${origin}/app/account/billing?success=true&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin}/pricing?canceled=true`;

        // Create checkout session
        const session = await createCheckoutSession({
            userId: user.id,
            userEmail: user.email || '',
            planId,
            billingPeriod,
            successUrl,
            cancelUrl,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);

        const message = error instanceof Error ? error.message : 'Failed to create checkout session';

        // Check if it's a configuration error
        if (message.includes('not configured')) {
            return NextResponse.json(
                { error: message },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
