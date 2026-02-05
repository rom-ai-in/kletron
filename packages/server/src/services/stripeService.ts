// src/services/stripeService.ts
// Stripe API wrapper for subscription management
import Stripe from 'stripe';

// Initialize Stripe client with EU-compliant settings
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
    if (!stripeClient) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey || secretKey.includes('placeholder') || secretKey.includes('your_')) {
            throw new Error('STRIPE_SECRET_KEY is not configured. Please set it in .env');
        }
        stripeClient = new Stripe(secretKey, {
            apiVersion: '2025-02-24.acacia',
            typescript: true,
        });
    }
    return stripeClient;
}

// Price ID mapping based on plan and billing period
export function getPriceId(planId: 'pro' | 'team', billingPeriod: 'monthly' | 'yearly'): string {
    const priceMap: Record<string, string | undefined> = {
        'pro_monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
        'pro_yearly': process.env.STRIPE_PRICE_PRO_YEARLY,
        'team_monthly': process.env.STRIPE_PRICE_TEAM_MONTHLY,
        'team_yearly': process.env.STRIPE_PRICE_TEAM_YEARLY,
    };

    const key = `${planId}_${billingPeriod}`;
    const priceId = priceMap[key];

    if (!priceId || priceId.includes('placeholder')) {
        throw new Error(`Stripe Price ID not configured for ${key}. Check .env file.`);
    }

    return priceId;
}

export interface CreateCheckoutParams {
    userId: string;
    userEmail: string;
    planId: 'pro' | 'team';
    billingPeriod: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<Stripe.Checkout.Session> {
    const stripe = getStripe();
    const priceId = getPriceId(params.planId, params.billingPeriod);

    // Check if customer already exists for this user
    const existingCustomers = await stripe.customers.list({
        email: params.userEmail,
        limit: 1,
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.userId, // Link to our user ID
        metadata: {
            userId: params.userId,
            planId: params.planId,
            billingPeriod: params.billingPeriod,
        },
        subscription_data: {
            metadata: {
                userId: params.userId,
                planId: params.planId,
            },
        },
        // EU billing address collection
        billing_address_collection: 'required',
        // Automatic tax calculation (if enabled in Stripe)
        automatic_tax: { enabled: true },
    };

    // Use existing customer or create new one
    if (existingCustomers.data.length > 0) {
        sessionParams.customer = existingCustomers.data[0].id;
    } else {
        sessionParams.customer_email = params.userEmail;
    }

    return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Create a Stripe Billing Portal session for subscription management
 */
export async function createBillingPortalSession(
    customerId: string,
    returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
    const stripe = getStripe();

    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

/**
 * Get Stripe customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const stripe = getStripe();

    const customers = await stripe.customers.list({
        email,
        limit: 1,
    });

    return customers.data[0] || null;
}

/**
 * Retrieve subscription details from Stripe
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = getStripe();
    return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Construct and verify webhook event
 */
export function constructWebhookEvent(
    payload: string | Buffer,
    signature: string
): Stripe.Event {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || webhookSecret.includes('placeholder') || webhookSecret.includes('your_')) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Map Stripe price ID to plan ID
 */
export function getPlanFromPriceId(priceId: string): { planId: 'pro' | 'team'; billingPeriod: 'monthly' | 'yearly' } | null {
    const priceMap: Record<string, { planId: 'pro' | 'team'; billingPeriod: 'monthly' | 'yearly' }> = {};

    // Build reverse mapping from env vars
    const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
    const proYearly = process.env.STRIPE_PRICE_PRO_YEARLY;
    const teamMonthly = process.env.STRIPE_PRICE_TEAM_MONTHLY;
    const teamYearly = process.env.STRIPE_PRICE_TEAM_YEARLY;

    if (proMonthly) priceMap[proMonthly] = { planId: 'pro', billingPeriod: 'monthly' };
    if (proYearly) priceMap[proYearly] = { planId: 'pro', billingPeriod: 'yearly' };
    if (teamMonthly) priceMap[teamMonthly] = { planId: 'team', billingPeriod: 'monthly' };
    if (teamYearly) priceMap[teamYearly] = { planId: 'team', billingPeriod: 'yearly' };

    return priceMap[priceId] || null;
}
