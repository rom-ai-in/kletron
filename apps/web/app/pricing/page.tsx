'use client';

import Link from 'next/link';
import { Apple } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@numezis/ui/context/AuthContext';
import { useSubscription } from '@numezis/ui/hooks/useSubscription';
import { MarketingHeader, MarketingFooter } from '@numezis/ui/components/design-system';

const downloadUrl = '/auth/register' // Download after account creation

// Pricing tiers
const tiers = [
    {
        id: 'free',
        name: 'Starter',
        price: '0',
        description: 'Great for trying out Numezis Code with your own API keys.',
        highlight: false,
        cta: 'Start Free',
        ctaLink: '/auth/register',
        features: [
            { text: 'Bring Your Own Key (BYOK)', included: true, tooltip: 'Use your existing OpenAI, Azure, Claude, or local models' },
            { text: '1 workspace', included: true },
            { text: '3 agent graphs', included: true },
            { text: '10K files semantic index', included: true },
            { text: 'Community support', included: true },
            { text: 'Hosted AI models', included: false },
            { text: 'Advanced campaigns', included: false },
            { text: 'Priority support', included: false },
        ],
        badge: null,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '19',
        description: 'For professional developers who want the full power of AI coding.',
        highlight: true,
        cta: 'Get Started',
        ctaLink: '/auth/register?plan=pro',
        features: [
            { text: 'Everything in Starter', included: true },
            { text: '5 workspaces', included: true },
            { text: 'Unlimited agent graphs', included: true },
            { text: '100K files semantic index', included: true },
            { text: 'BYOK + 500K hosted tokens/mo', included: true, tooltip: 'Use our hosted models or your own — your choice' },
            { text: 'Advanced campaigns', included: true },
            { text: 'Anti-drift detection', included: true },
            { text: 'Priority email support', included: true },
        ],
        badge: 'Most Popular',
    },
    {
        id: 'team',
        name: 'Team',
        price: '49',
        priceUnit: '/user',
        description: 'Collaboration features for engineering teams building together.',
        highlight: false,
        cta: 'Start Team Trial',
        ctaLink: '/auth/register?plan=team',
        features: [
            { text: 'Everything in Pro', included: true },
            { text: 'Unlimited workspaces', included: true },
            { text: 'Unlimited semantic index', included: true },
            { text: '1M hosted tokens/user/mo', included: true },
            { text: 'Shared agent templates', included: true },
            { text: 'Team collaboration', included: true },
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
    description: 'For organizations requiring maximum security, control, and custom integration.',
    features: [
        'Self-hosted deployment option',
        'SSO / SAML integration',
        'Custom SLA agreements',
        'Dedicated success manager',
        'Volume token discounts',
        'Activity logs & compliance',
        'Custom model fine-tuning',
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
        question: 'Is my code sent to external servers?',
        answer: 'With BYOK, your code goes directly to your chosen AI provider. With hosted models, we route through EU-based infrastructure. For Enterprise, we offer fully self-hosted options where nothing leaves your network.',
    },
    {
        question: 'Can I cancel anytime?',
        answer: 'Yes, all plans are month-to-month with no long-term commitment. Cancel anytime and you\'ll retain access until the end of your billing period.',
    },
];

export default function PricingPage() {
    const { user, loading } = useAuth();
    const { redirectToCheckout, planId: currentPlanId } = useSubscription();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
                window.location.href = '/app/explore';
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
            window.location.href = '/app/account/billing';
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
        <div className="min-h-screen w-full bg-bg-app">
            {/* Navigation Header */}
            <MarketingHeader
                LinkComponent={Link}
                navLinks={[
                    { href: '/#features', label: 'Features' },
                    { href: '/enterprise', label: 'Enterprise' },
                    { href: '/pricing', label: 'Pricing' },
                ]}
                rightSlot={
                    <div className="flex items-center gap-3">
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-border-subtle border-t-text-secondary rounded-full animate-spin" />
                        ) : user ? (
                            <>
                                <Link
                                    href="/app/explore"
                                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/app/explore"
                                    className="inline-flex items-center gap-2 rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary transition-colors"
                                >
                                    Open App →
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="inline-flex items-center gap-2 rounded-md bg-text-primary text-bg-app px-3 py-1.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                }
            />

            {/* Hero Section */}
            <section className="relative pt-32 pb-16 px-6">
                <div className="absolute inset-0 bg-grid-pattern opacity-50" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-subtle bg-bg-surface mb-6 text-xs text-text-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                        Simple, transparent pricing
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-text-primary mb-4 tracking-tight">
                        Pay for what you use.
                        <br />
                        <span className="text-text-secondary">Or bring your own keys.</span>
                    </h1>

                    <p className="text-base text-text-muted mb-4 max-w-xl mx-auto leading-relaxed">
                        Choose hosted AI models with simple token pricing, or use your existing API keys.
                        Either way, you get an early look at Numezis Code while the macOS experience matures.
                    </p>
                    <p className="text-xs text-status-warning-text uppercase tracking-[0.2em] mb-8">
                        Early access preview • Expect the usual quirks while we polish the desktop app.
                    </p>

                    {/* Billing Toggle */}
                    <div className="inline-flex items-center gap-3 p-1 rounded-lg border border-border-subtle bg-bg-surface">
                        <button
                            onClick={() => setBillingPeriod('monthly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'monthly'
                                ? 'bg-bg-elevated text-text-primary'
                                : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingPeriod('yearly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${billingPeriod === 'yearly'
                                ? 'bg-bg-elevated text-text-primary'
                                : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            Yearly
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                -20%
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-12 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-4">
                        {tiers.map((tier) => (
                            <div
                                key={tier.id}
                                className={`relative p-6 rounded-lg border bg-bg-surface transition-all ${tier.highlight
                                    ? 'border-status-success-border ring-1 ring-status-success-border'
                                    : 'border-border-subtle hover:border-border-strong'
                                    }`}
                            >
                                {/* Badge */}
                                {tier.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-status-success text-white">
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
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Enterprise Section */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="p-8 rounded-lg border border-border-subtle bg-bg-surface">
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
                                <a
                                    href="mailto:enterprise@numezis.com?subject=Numezis%20Code%20Enterprise%20Inquiry"
                                    className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                                >
                                    Contact Sales
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* AI Compute Explainer */}
            <section className="py-16 px-6 border-y border-border-subtle">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-semibold text-text-primary mb-3">
                            Two ways to power your AI
                        </h2>
                        <p className="text-sm text-text-muted max-w-lg mx-auto">
                            Use our optimized hosted models, bring your own API keys, or mix both — you're always in control.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* BYOK Card */}
                        <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                            <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
                                <span className="text-lg">🔑</span>
                            </div>
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
                            <div className="mt-4 pt-4 border-t border-border-subtle">
                                <div className="text-xs text-text-muted">
                                    <span className="text-text-secondary font-medium">Perfect for:</span> Teams with negotiated API contracts, security requirements, or existing infrastructure
                                </div>
                            </div>
                        </div>

                        {/* Hosted Card */}
                        <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                            <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
                                <span className="text-lg">☁️</span>
                            </div>
                            <h3 className="text-base font-semibold text-text-primary mb-2">Numezis Hosted</h3>
                            <p className="text-xs text-text-muted mb-4">
                                We handle everything — optimized models, prompt caching, EU infrastructure. Just code.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                    Pre-tuned for coding tasks
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
                            <div className="mt-4 pt-4 border-t border-border-subtle">
                                <div className="text-xs text-text-muted">
                                    <span className="text-text-secondary font-medium">Pricing:</span> €0.002 per 1K tokens (Pro plans include 500K/mo free)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-semibold text-text-primary mb-3">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-sm text-text-muted">
                            Everything you need to know about pricing and billing.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {faqs.map((faq, idx) => (
                            <div
                                key={idx}
                                className="border border-border-subtle rounded-lg bg-bg-surface overflow-hidden"
                            >
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
            </section>

            {/* Final CTA */}
            <section className="py-20 px-6 border-t border-border-subtle">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary mb-4">
                        Start coding with AI <span className="text-text-secondary">today</span>
                    </h2>
                    <p className="text-sm text-text-muted mb-4">
                        Free to start with your own API keys. No credit card required.
                    </p>
                    <p className="text-xs text-status-warning-text uppercase tracking-[0.2em] mb-6">
                        Early access release • Mac app preview builds keep improving.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href={downloadUrl}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                        >
                            <Apple className="w-4 h-4" />
                            Download Numezis Code — Free
                        </Link>
                        <Link
                            href="/auth/register"
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors"
                        >
                            Create Account
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <MarketingFooter LinkComponent={Link} />
        </div>
    )
}
