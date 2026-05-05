'use client';

import Link from 'next/link';
import { Apple } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@kletron/ui/context/AuthContext';
import { useSubscription } from '@kletron/ui/hooks/useSubscription';
import {
    MarketingHeader,
    MarketingFooter,
    EarlyAccessBadge,
    marketingContainer,
    MarketingEyebrow,
    MarketingHeroTitle,
    MarketingLead,
    MarketingSectionTitle,
    marketingBtnPrimary,
    marketingBtnSecondary,
    MarketingCard,
    MarketingIconCircle,
} from '@kletron/ui/components/design-system';

const downloadUrl = '/auth/register' // Download after account creation

// Pricing tiers
const tiers = [
    {
        id: 'free',
        name: 'Starter',
        price: '0',
        description: 'Try the agent platform with your own API keys and local models.',
        highlight: false,
        cta: 'Start Free',
        ctaLink: '/auth/register',
        features: [
            { text: 'Bring Your Own Key (BYOK)', included: true, tooltip: 'OpenAI, Azure, Anthropic, Gemini, Ollama, LM Studio, vLLM' },
            { text: '1 workspace', included: true },
            { text: '3 agent graphs', included: true },
            { text: '10K-file workspace memory (semantic index)', included: true },
            { text: 'Up to 3 custom MCP servers / workspace', included: true },
            { text: 'Community support', included: true },
            { text: 'Hosted AI models', included: false },
            { text: 'Advanced automations', included: false },
            { text: 'Priority support', included: false },
        ],
        badge: null,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '19',
        description: 'For builders who want graphs, MCP, automations, and hosted tokens in one stack.',
        highlight: true,
        cta: 'Get Started',
        ctaLink: '/auth/register?plan=pro',
        features: [
            { text: 'Everything in Starter', included: true },
            { text: '5 workspaces', included: true },
            { text: 'Unlimited agent graphs', included: true },
            { text: '100K-file workspace memory (semantic index)', included: true },
            { text: 'Unlimited custom MCP servers / workspace', included: true },
            { text: 'BYOK + 500K hosted tokens/mo', included: true, tooltip: 'Use our hosted models or your own — your choice' },
            { text: 'Advanced automations (cron, webhooks, git)', included: true },
            { text: 'Drift & comparator graph presets', included: true },
            { text: 'Priority email support', included: true },
        ],
        badge: 'Most Popular',
    },
    {
        id: 'team',
        name: 'Team',
        price: '49',
        priceUnit: '/user',
        description: 'Collaboration for teams running agents, graphs, and automations together.',
        highlight: false,
        cta: 'Start Team Trial',
        ctaLink: '/auth/register?plan=team',
        features: [
            { text: 'Everything in Pro', included: true },
            { text: 'Unlimited workspaces', included: true },
            { text: 'Unlimited workspace memory (semantic index)', included: true },
            { text: '1M hosted tokens/user/mo', included: true },
            { text: 'Shared agent graph templates', included: true },
            { text: 'Team collaboration & skills sharing', included: true },
            { text: 'Admin dashboard', included: true },
            { text: 'Slack integration', included: true },
        ],
        badge: null,
    },
];

// Enterprise tier (separate)
const enterpriseTier = {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Maximum security, custom MCP governance, and deployment on your terms.',
    features: [
        'Self-hosted deployment option',
        'SSO / SAML integration',
        'Custom SLA agreements',
        'Dedicated success manager',
        'Volume token discounts',
        'Activity logs & compliance',
        'Custom model routing & fine-tuning',
        'Air-gapped MCP + local LLM patterns',
        'Swiss data residency 🇨🇭',
    ],
};

// FAQ items
const faqs = [
    {
        question: 'What is BYOK (Bring Your Own Key)?',
        answer: 'BYOK allows you to use your existing API keys from providers like OpenAI, Azure OpenAI, Anthropic Claude, Google Gemini, or even local models via Ollama/LM Studio. You pay the provider directly — we only charge the platform fee.',
    },
    {
        question: 'How do hosted tokens work?',
        answer: 'Pro and Team plans include a monthly allowance of hosted tokens. These let you use our pre-configured, optimized AI models without managing your own API keys. Extra tokens are billed at €0.002 per 1K tokens.',
    },
    {
        question: 'Can I switch between BYOK and hosted models?',
        answer: 'Absolutely! You can use BYOK for some tasks and hosted models for others. Many teams use their own Azure OpenAI for sensitive code and our hosted models for quick prototyping.',
    },
    {
        question: 'What happens if I exceed my token limit?',
        answer: 'We\'ll notify you as you approach your limit. You can either upgrade your plan, purchase additional token packs, or switch to BYOK mode where you control costs directly with your provider.',
    },
    {
        question: 'Are my repos and documents sent to external servers?',
        answer:
            'With BYOK, prompts and context go to the provider you configure (including local models on your hardware). With hosted models, we route through EU-based infrastructure. Enterprise can run fully self-hosted so nothing leaves your network.',
    },
    {
        question: 'Can I cancel anytime?',
        answer: 'Yes, all plans are month-to-month with no long-term commitment. Cancel anytime and you\'ll retain access until the end of your billing period.',
    },
];

export default function PricingPage() {
    const { user } = useAuth();
    const { redirectToCheckout, planId: currentPlanId } = useSubscription();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [_checkoutError, setCheckoutError] = useState<string | null>(null);

    const getPrice = (basePrice: string) => {
        if (basePrice === '0') return '0';
        const price = parseInt(basePrice);
        if (billingPeriod === 'yearly') {
            return Math.round(price * 0.8).toString(); // 20% discount
        }
        return basePrice;
    };

    const handlePlanSelect = async (tierId: string) => {
        // Free tier - just go to register
        if (tierId === 'free') {
            if (user) {
                window.location.href = '/app/agent';
            } else {
                window.location.href = '/auth/register';
            }
            return;
        }

        // Paid plans
        if (!user) {
            // Not logged in - redirect to register with plan
            window.location.href = `/auth/register?plan=${tierId}`;
            return;
        }

        // Already on this plan
        if (currentPlanId === tierId) {
            window.location.href = '/app/organization/billing';
            return;
        }

        // Logged in - start Stripe checkout
        setCheckoutLoading(tierId);
        setCheckoutError(null);

        try {
            await redirectToCheckout(tierId as 'pro' | 'team', billingPeriod);
        } catch (err) {
            console.error('Checkout error:', err);
            setCheckoutError(err instanceof Error ? err.message : 'Failed to start checkout');
            setCheckoutLoading(null);
        }
    };

    const getButtonText = (tier: typeof tiers[0]) => {
        if (checkoutLoading === tier.id) {
            return 'Loading...';
        }
        if (user && currentPlanId === tier.id) {
            return 'Current Plan';
        }
        if (user && tier.id !== 'free') {
            return `Upgrade to ${tier.name}`;
        }
        return tier.cta;
    };

    return (
        <div className="min-h-screen marketing-page-bg text-text-primary">
            <MarketingHeader LinkComponent={Link} />

            <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32">
                <div className="pointer-events-none absolute inset-0 marketing-grid-overlay opacity-60" aria-hidden />

                <div className={`${marketingContainer} relative z-[1] flex flex-col items-center text-center`}>
                    <MarketingEyebrow className="mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(34,197,94,0.45)]" />
                        Predictable units
                    </MarketingEyebrow>

                    <MarketingHeroTitle className="mb-5">
                        Price the platform,
                        <span className="text-text-secondary">
                            <br />
                            not just tokens.
                        </span>
                    </MarketingHeroTitle>

                    <MarketingLead className="mb-6 max-w-xl px-1">
                        BYOK or hosted models—plans scale with workspaces, graphs, memory, and MCP. Fewer surprises for finance.
                    </MarketingLead>
                    <EarlyAccessBadge className="mx-auto mb-8 max-w-md text-center" />

                    <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-bg-surface/70 p-1 backdrop-blur-sm">
                        <button
                            type="button"
                            onClick={() => setBillingPeriod('monthly')}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${billingPeriod === 'monthly'
                                ? 'bg-bg-elevated text-text-primary shadow-sm'
                                : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingPeriod('yearly')}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${billingPeriod === 'yearly'
                                ? 'bg-bg-elevated text-text-primary shadow-sm'
                                : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            Yearly
                            <span className="rounded-md border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-[10px] font-medium text-status-success-text">
                                −20%
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="pb-16 pt-4 sm:pb-20">
                <div className={marketingContainer}>
                    <div className="grid gap-4 md:grid-cols-3">
                        {tiers.map((tier) => (
                            <MarketingCard
                                key={tier.id}
                                featured={tier.highlight}
                                className={`relative pt-8 ${tier.highlight ? 'md:-mt-1 md:mb-1' : ''}`}
                            >
                                {/* Badge */}
                                {tier.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="rounded-full bg-[color:var(--kletron-accent)] px-3 py-1 text-[10px] font-medium text-white shadow-md shadow-[color:var(--kletron-accent)]/30">
                                            {tier.badge}
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold text-text-primary mb-1">{tier.name}</h3>
                                    <p className="text-xs text-text-muted mb-4">{tier.description}</p>

                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-text-primary">€{getPrice(tier.price)}</span>
                                        <span className="text-sm text-text-muted">
                                            {tier.priceUnit || '/mo'}
                                            {billingPeriod === 'yearly' && tier.price !== '0' && (
                                                <span className="ml-1 text-text-muted/60 line-through">€{tier.price}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => handlePlanSelect(tier.id)}
                                    disabled={checkoutLoading !== null || Boolean(user && currentPlanId === tier.id)}
                                    className={`block w-full text-center py-2.5 rounded-md text-sm font-medium transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed ${tier.highlight
                                        ? 'bg-text-primary text-bg-app hover:bg-text-secondary'
                                        : 'bg-bg-elevated border border-border-subtle text-text-primary hover:bg-state-hover'
                                        }`}
                                >
                                    {getButtonText(tier)}
                                </button>

                                {/* Features */}
                                <ul className="space-y-3">
                                    {tier.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            {feature.included ? (
                                                <svg className="w-4 h-4 text-status-success-text shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-text-muted/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            )}
                                            <span className={`text-xs ${feature.included ? 'text-text-secondary' : 'text-text-muted/60'}`}>
                                                {feature.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </MarketingCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Enterprise Section */}
            <section className="py-12 sm:py-16">
                <div className={marketingContainer}>
                    <MarketingCard featured className="p-8">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-xl font-semibold text-text-primary">{enterpriseTier.name}</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                        🇨🇭 Swiss-Grade
                                    </span>
                                </div>
                                <p className="text-sm text-text-muted mb-6">{enterpriseTier.description}</p>

                                <div className="grid sm:grid-cols-2 gap-2">
                                    {enterpriseTier.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-status-success-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-xs text-text-secondary">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:text-right">
                                <div className="text-2xl font-bold text-text-primary mb-2">Custom Pricing</div>
                                <p className="text-xs text-text-muted mb-4">Tailored to your organization</p>
                                <a href="mailto:enterprise@kletron.com?subject=Kletron%20Enterprise%20Inquiry" className={marketingBtnPrimary}>
                                    Contact sales
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </MarketingCard>
                </div>
            </section>

            {/* AI Compute Explainer */}
            <section className="border-y border-white/[0.06] bg-bg-surface/20 py-16 sm:py-20">
                <div className={marketingContainer}>
                    <MarketingSectionTitle subtitle="Mix BYOK and hosted tokens on the same workspace when it makes sense.">
                        Power models your way
                    </MarketingSectionTitle>

                    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
                        <MarketingCard>
                            <MarketingIconCircle className="mb-4 text-lg">🔑</MarketingIconCircle>
                            <h3 className="text-base font-semibold text-text-primary mb-2">Bring Your Own Key</h3>
                            <p className="text-xs text-text-muted mb-4">
                                Connect your existing API keys from any provider. You pay them directly — we charge only the platform fee.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    OpenAI, Azure OpenAI, Anthropic, Google
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    Local models: Ollama, LM Studio
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    Full control over your AI spend
                                </div>
                            </div>
                            <div className="mt-4 border-t border-white/[0.06] pt-4">
                                <div className="text-xs text-text-muted">
                                    <span className="font-medium text-text-secondary">Best for:</span> Existing contracts, strict routing rules, or local weights.
                                </div>
                            </div>
                        </MarketingCard>

                        <MarketingCard>
                            <MarketingIconCircle className="mb-4 text-lg">☁️</MarketingIconCircle>
                            <h3 className="text-base font-semibold text-text-primary mb-2">Kletron Hosted</h3>
                            <p className="text-xs text-text-muted mb-4">
                                We handle routing, caching, and EU infrastructure so your teams can focus on graphs and outcomes—not
                                plumbing.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    Pre-tuned for agentic workloads
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    100% EU data residency
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    Simple token-based pricing
                                </div>
                            </div>
                            <div className="mt-4 border-t border-white/[0.06] pt-4">
                                <div className="text-xs text-text-muted">
                                    <span className="font-medium text-text-secondary">Extra usage:</span> €0.002 / 1K tokens (allowances included on Pro+).
                                </div>
                            </div>
                        </MarketingCard>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 sm:py-24">
                <div className={marketingContainer}>
                    <div className="mx-auto max-w-3xl">
                    <MarketingSectionTitle subtitle="Billing, keys, and data routing—in plain language.">
                        FAQ
                    </MarketingSectionTitle>

                    <div className="space-y-2">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-bg-surface/50 backdrop-blur-sm">
                                <button
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-state-hover transition-colors"
                                >
                                    <span className="text-sm font-medium text-text-primary">{faq.question}</span>
                                    <svg
                                        className={`w-4 h-4 text-text-muted transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {openFaq === idx && (
                                    <div className="px-5 pb-4">
                                        <p className="text-xs text-text-muted leading-relaxed">{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="border-t border-white/[0.06] py-16 sm:py-24">
                <div className={marketingContainer}>
                    <div className="mx-auto max-w-2xl text-center">
                    <h2 className="mb-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                        Ship agents <span className="text-text-secondary">today</span>
                    </h2>
                    <MarketingLead className="mb-6">
                        Start free with BYOK. Card only when you upgrade.
                    </MarketingLead>
                    <EarlyAccessBadge className="mb-6 text-center" />
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Link href={downloadUrl} className={marketingBtnPrimary}>
                            <Apple className="h-4 w-4 opacity-90" />
                            Download — free
                        </Link>
                        <Link href="/auth/register" className={marketingBtnSecondary}>
                            Create account
                        </Link>
                    </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <MarketingFooter LinkComponent={Link} />
        </div>
    )
}
