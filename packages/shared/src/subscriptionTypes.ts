export type PlanId = 'free' | 'pro' | 'team';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
export type BillingPeriod = 'monthly' | 'yearly';

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

export interface Subscription {
  _id?: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  cancelAtPeriodEnd: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SubscriptionResponse {
  subscription: Subscription | null;
  planId: PlanId;
  planLimits: PlanLimits;
}
