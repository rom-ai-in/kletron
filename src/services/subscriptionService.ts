// src/services/subscriptionService.ts
// MongoDB subscription management service
import { getDatabase } from './mongoClient';
import { ObjectId } from 'mongodb';

const COLLECTION_NAME = 'subscriptions';

export type PlanId = 'free' | 'pro' | 'team';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
export type BillingPeriod = 'monthly' | 'yearly';

export interface Subscription {
    _id?: ObjectId;
    userId: string;              // Supabase user ID
    stripeCustomerId: string;    // Stripe customer ID
    stripeSubscriptionId: string;
    planId: PlanId;
    status: SubscriptionStatus;
    billingPeriod: BillingPeriod;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface PlanLimits {
    workspaces: number;
    agentGraphs: number;
    semanticIndexFiles: number;
    hostedTokensPerMonth: number;
    hasAdvancedCampaigns: boolean;
    hasAntiDrift: boolean;
    hasPrioritySupport: boolean;
    hasTeamCollaboration: boolean;
    hasAdminDashboard: boolean;
}

// Plan limits configuration
const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
    free: {
        workspaces: 1,
        agentGraphs: 3,
        semanticIndexFiles: 10000,
        hostedTokensPerMonth: 0,
        hasAdvancedCampaigns: false,
        hasAntiDrift: false,
        hasPrioritySupport: false,
        hasTeamCollaboration: false,
        hasAdminDashboard: false,
    },
    pro: {
        workspaces: 5,
        agentGraphs: -1, // unlimited
        semanticIndexFiles: 100000,
        hostedTokensPerMonth: 500000,
        hasAdvancedCampaigns: true,
        hasAntiDrift: true,
        hasPrioritySupport: true,
        hasTeamCollaboration: false,
        hasAdminDashboard: false,
    },
    team: {
        workspaces: -1, // unlimited
        agentGraphs: -1, // unlimited
        semanticIndexFiles: -1, // unlimited
        hostedTokensPerMonth: 1000000,
        hasAdvancedCampaigns: true,
        hasAntiDrift: true,
        hasPrioritySupport: true,
        hasTeamCollaboration: true,
        hasAdminDashboard: true,
    },
};

/**
 * Get subscription collection
 */
async function getCollection() {
    const db = await getDatabase();
    return db.collection<Subscription>(COLLECTION_NAME);
}

/**
 * Get a user's active subscription
 */
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const collection = await getCollection();
    return collection.findOne({ userId });
}

/**
 * Get a subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const collection = await getCollection();
    return collection.findOne({ stripeSubscriptionId });
}

/**
 * Get a subscription by Stripe customer ID
 */
export async function getSubscriptionByCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const collection = await getCollection();
    return collection.findOne({ stripeCustomerId });
}

/**
 * Create or update a subscription
 */
export async function upsertSubscription(data: Omit<Subscription, '_id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const collection = await getCollection();
    const now = new Date();

    const result = await collection.findOneAndUpdate(
        { userId: data.userId },
        {
            $set: {
                ...data,
                updatedAt: now,
            },
            $setOnInsert: {
                createdAt: now,
            },
        },
        {
            upsert: true,
            returnDocument: 'after',
        }
    );

    if (!result) {
        throw new Error('Failed to upsert subscription');
    }

    return result;
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    cancelAtPeriodEnd: boolean = false
): Promise<void> {
    const collection = await getCollection();

    await collection.updateOne(
        { stripeSubscriptionId },
        {
            $set: {
                status,
                cancelAtPeriodEnd,
                updatedAt: new Date(),
            },
        }
    );
}

/**
 * Delete a subscription (when fully canceled)
 */
export async function deleteSubscription(stripeSubscriptionId: string): Promise<void> {
    const collection = await getCollection();

    // Instead of deleting, we update to canceled status and set plan to free
    await collection.updateOne(
        { stripeSubscriptionId },
        {
            $set: {
                status: 'canceled' as SubscriptionStatus,
                planId: 'free' as PlanId,
                cancelAtPeriodEnd: false,
                updatedAt: new Date(),
            },
        }
    );
}

/**
 * Get plan limits for a given plan
 */
export function getPlanLimits(planId: PlanId): PlanLimits {
    return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

/**
 * Get the effective plan for a user (checks subscription status)
 */
export async function getEffectivePlan(userId: string): Promise<{ planId: PlanId; limits: PlanLimits }> {
    const subscription = await getSubscriptionByUserId(userId);

    // No subscription or inactive = free plan
    if (!subscription || subscription.status !== 'active') {
        return { planId: 'free', limits: PLAN_LIMITS.free };
    }

    // Check if subscription period has ended
    if (subscription.currentPeriodEnd < new Date()) {
        return { planId: 'free', limits: PLAN_LIMITS.free };
    }

    return {
        planId: subscription.planId,
        limits: getPlanLimits(subscription.planId),
    };
}

/**
 * Check if a user can use a specific feature
 */
export async function canUseFeature(userId: string, feature: keyof PlanLimits): Promise<boolean> {
    const { limits } = await getEffectivePlan(userId);
    const value = limits[feature];

    if (typeof value === 'boolean') {
        return value;
    }

    // For numeric limits, -1 means unlimited, 0 means disabled
    return value !== 0;
}
