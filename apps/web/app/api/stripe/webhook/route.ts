// app/api/stripe/webhook/route.ts
// Handle Stripe Webhooks
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent, getPlanFromPriceId } from '@numezis/server/services/stripeService';
import {
    upsertSubscription,
    updateSubscriptionStatus,
    deleteSubscription,
    type SubscriptionStatus,
    type BillingPeriod,
    type PlanId
} from '@numezis/server/services/subscriptionService';

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            console.error('Missing stripe-signature header');
            return NextResponse.json(
                { error: 'Missing stripe-signature header' },
                { status: 400 }
            );
        }

        // Verify and construct event
        let event: Stripe.Event;
        try {
            event = constructWebhookEvent(body, signature);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Webhook verification failed';
            console.error('Webhook verification failed:', message);
            return NextResponse.json(
                { error: message },
                { status: 400 }
            );
        }

        console.log(`Stripe webhook received: ${event.type}`);

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);

        const message = error instanceof Error ? error.message : 'Webhook processing failed';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}

/**
 * Handle successful checkout - create subscription
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Get user ID from metadata or client_reference_id
    const userId = session.metadata?.userId || session.client_reference_id;

    if (!userId) {
        console.error('No userId found in checkout session');
        return;
    }

    if (!session.subscription) {
        console.error('No subscription in checkout session');
        return;
    }

    const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (!customerId) {
        console.error('No customer ID in checkout session');
        return;
    }

    // Get plan info from metadata
    const planId = (session.metadata?.planId || 'pro') as PlanId;
    const billingPeriod = (session.metadata?.billingPeriod || 'monthly') as BillingPeriod;

    // Calculate period dates (will be updated by subscription.updated event)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    await upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        planId,
        status: 'active',
        billingPeriod,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
    });

    console.log(`Subscription created for user ${userId}: ${planId} (${billingPeriod})`);
}

/**
 * Handle subscription updates (plan changes, renewals, cancellations)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    // Map Stripe status to our status
    const statusMap: Record<string, SubscriptionStatus> = {
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'trialing': 'trialing',
        'incomplete': 'incomplete',
        'incomplete_expired': 'canceled',
        'unpaid': 'past_due',
        'paused': 'canceled',
    };

    const status = statusMap[subscription.status] || 'active';

    // Try to get plan from price
    let planId: PlanId = 'pro';
    let billingPeriod: BillingPeriod = 'monthly';

    if (subscription.items.data.length > 0) {
        const priceId = subscription.items.data[0].price.id;
        const planInfo = getPlanFromPriceId(priceId);
        if (planInfo) {
            planId = planInfo.planId;
            billingPeriod = planInfo.billingPeriod;
        }
    }

    // Get user ID from metadata
    const userId = subscription.metadata?.userId;

    if (userId) {
        // Full upsert with all details
        await upsertSubscription({
            userId,
            stripeCustomerId: typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id,
            stripeSubscriptionId: subscription.id,
            planId,
            status,
            billingPeriod,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
    } else {
        // Just update status
        await updateSubscriptionStatus(
            subscription.id,
            status,
            subscription.cancel_at_period_end
        );
    }

    console.log(`Subscription ${subscription.id} updated: ${status}`);
}

/**
 * Handle subscription deletion (cancellation complete)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await deleteSubscription(subscription.id);
    console.log(`Subscription ${subscription.id} deleted/canceled`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    if (!invoice.subscription) {
        return;
    }

    const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    await updateSubscriptionStatus(subscriptionId, 'past_due', false);
    console.log(`Payment failed for subscription ${subscriptionId}`);
}
