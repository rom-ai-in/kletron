'use client';

import Link from 'next/link';
import { MarketingHeader, MarketingFooter } from '@numezis/ui/components/design-system';

export default function CookiePolicyPage() {
    return (
        <div className="min-h-screen w-full bg-bg-app">
            <MarketingHeader LinkComponent={Link} />

            {/* Content */}
            <main className="pt-24 pb-16 px-6">
                <article className="max-w-3xl mx-auto">
                    <div className="mb-8">
                        <p className="text-xs text-text-muted mb-2">Last updated: February 2, 2026</p>
                        <h1 className="text-3xl font-bold text-text-primary mb-4">Cookie Policy</h1>
                        <p className="text-sm text-text-muted">
                            This Cookie Policy explains how Numezis Technologies SA uses cookies and similar technologies
                            on our website and VS Code extension.
                        </p>
                    </div>

                    <Section title="What Are Cookies?">
                        <p>
                            Cookies are small text files stored on your device when you visit a website.
                            They help provide functionality, remember preferences, and understand usage patterns.
                        </p>
                    </Section>

                    <Section title="Cookies We Use">
                        <div className="space-y-4">
                            {/* Essential Cookies */}
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                                        Required
                                    </span>
                                    <h3 className="text-sm font-semibold text-text-primary">Essential Cookies</h3>
                                </div>
                                <p className="text-xs text-text-muted mb-3">
                                    These cookies are necessary for the website and extension to function.
                                    They cannot be disabled.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-subtle/50">
                                                <th className="text-left py-1 text-text-muted font-medium">Cookie</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Purpose</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-text-secondary">
                                            <tr className="border-b border-border-subtle/30">
                                                <td className="py-1.5 font-mono text-text-muted">sb-*-auth-token</td>
                                                <td className="py-1.5">Authentication session</td>
                                                <td className="py-1.5">7 days</td>
                                            </tr>
                                            <tr className="border-b border-border-subtle/30">
                                                <td className="py-1.5 font-mono text-text-muted">numezis_session</td>
                                                <td className="py-1.5">Session management</td>
                                                <td className="py-1.5">Session</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 font-mono text-text-muted">csrf_token</td>
                                                <td className="py-1.5">Security (CSRF protection)</td>
                                                <td className="py-1.5">Session</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Functional Cookies */}
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-info-bg text-status-info-text border border-status-info-border">
                                        Optional
                                    </span>
                                    <h3 className="text-sm font-semibold text-text-primary">Functional Cookies</h3>
                                </div>
                                <p className="text-xs text-text-muted mb-3">
                                    These cookies remember your preferences to enhance your experience.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-subtle/50">
                                                <th className="text-left py-1 text-text-muted font-medium">Cookie</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Purpose</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-text-secondary">
                                            <tr className="border-b border-border-subtle/30">
                                                <td className="py-1.5 font-mono text-text-muted">theme</td>
                                                <td className="py-1.5">UI theme preference</td>
                                                <td className="py-1.5">1 year</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 font-mono text-text-muted">locale</td>
                                                <td className="py-1.5">Language preference</td>
                                                <td className="py-1.5">1 year</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Analytics Cookies */}
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                                        Consent Required
                                    </span>
                                    <h3 className="text-sm font-semibold text-text-primary">Analytics Cookies</h3>
                                </div>
                                <p className="text-xs text-text-muted mb-3">
                                    If you consent, we use privacy-focused analytics to understand how our service is used.
                                    We do NOT use Google Analytics or any US-based tracking.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-subtle/50">
                                                <th className="text-left py-1 text-text-muted font-medium">Cookie</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Purpose</th>
                                                <th className="text-left py-1 text-text-muted font-medium">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-text-secondary">
                                            <tr>
                                                <td className="py-1.5 font-mono text-text-muted">_plausible</td>
                                                <td className="py-1.5">Privacy-focused analytics (EU-hosted)</td>
                                                <td className="py-1.5">1 year</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Third-Party Cookies">
                        <p>
                            We minimize third-party cookies. The only external services that may set cookies are:
                        </p>
                        <ul>
                            <li><strong>Stripe:</strong> Payment processing (required for checkout only)</li>
                            <li><strong>Supabase:</strong> Authentication (essential)</li>
                        </ul>
                        <p className="mt-3">
                            We do not use advertising cookies or sell data to third parties.
                        </p>
                    </Section>

                    <Section title="Managing Cookies">
                        <p>You can control cookies through:</p>
                        <ul>
                            <li><strong>Browser settings:</strong> Most browsers allow you to block or delete cookies</li>
                            <li><strong>Our cookie banner:</strong> Manage consent for optional cookies when you first visit</li>
                            <li><strong>Account settings:</strong> Toggle analytics preferences (coming soon)</li>
                        </ul>
                        <div className="p-3 rounded-lg border border-status-warning-border bg-status-warning-bg mt-3">
                            <p className="text-xs text-text-secondary">
                                <strong className="text-status-warning-text">Note:</strong> Disabling essential cookies may prevent you from
                                logging in or using core features.
                            </p>
                        </div>
                    </Section>

                    <Section title="VS Code Extension">
                        <p>
                            Our VS Code extension uses local storage (not cookies) to:
                        </p>
                        <ul>
                            <li>Store your authentication token securely</li>
                            <li>Remember workspace preferences</li>
                            <li>Cache configuration settings</li>
                        </ul>
                        <p className="mt-3">
                            No tracking or analytics data is collected through the extension without explicit consent.
                        </p>
                    </Section>

                    <Section title="Contact">
                        <p>
                            For questions about our cookie practices, contact us at{' '}
                            <a href="mailto:privacy@numezis.com" className="text-status-success-text hover:underline">privacy@numezis.com</a>.
                        </p>
                    </Section>
                </article>
            </main>

            <MarketingFooter LinkComponent={Link} />
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
            <div className="text-sm text-text-secondary space-y-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1">
                {children}
            </div>
        </section>
    );
}
