'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen w-full bg-bg-app">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-app/80 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <span className="text-xl">🧠</span>
                        <span className="text-sm font-semibold text-text-primary">Numezis Code</span>
                    </Link>
                    <Link href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="pt-24 pb-16 px-6">
                <article className="max-w-3xl mx-auto">
                    <div className="mb-8">
                        <p className="text-xs text-text-muted mb-2">Last updated: February 2, 2026</p>
                        <h1 className="text-3xl font-bold text-text-primary mb-4">Privacy Policy</h1>
                        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 mb-6">
                            <p className="text-sm text-text-secondary">
                                <span className="text-emerald-500 font-medium">🇨🇭 Swiss-Grade Privacy:</span> Numezis Technologies SA
                                is a Swiss company. Your data is processed under Swiss and EU data protection laws —
                                among the strictest in the world.
                            </p>
                        </div>
                    </div>

                    <Section title="1. Data Controller">
                        <p>The data controller for your personal data is:</p>
                        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mt-2">
                            <p className="text-text-secondary">
                                <strong>Numezis Technologies SA</strong><br />
                                Geneva, Switzerland<br />
                                <a href="mailto:privacy@numezis.com" className="text-emerald-500 hover:underline">privacy@numezis.com</a>
                            </p>
                        </div>
                    </Section>

                    <Section title="2. Data We Collect">
                        <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">2.1 Account Information</h3>
                        <ul>
                            <li>Email address (required)</li>
                            <li>Name (optional)</li>
                            <li>Company/organization (optional)</li>
                            <li>Billing information (for paid plans)</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">2.2 Usage Data</h3>
                        <ul>
                            <li>Feature usage statistics (anonymized)</li>
                            <li>Token consumption for hosted AI models</li>
                            <li>Error logs and diagnostics</li>
                            <li>Extension/app version information</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">2.3 Code and Content</h3>
                        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mt-2">
                            <p className="text-sm text-text-secondary">
                                <strong className="text-amber-500">Important:</strong> We process your code only to provide the Service.
                                We do NOT use your code to train AI models. We do NOT share your code with third parties
                                except your chosen AI provider (for BYOK users) or our hosted AI infrastructure.
                            </p>
                        </div>
                    </Section>

                    <Section title="3. How We Use Your Data">
                        <p>We process your personal data for:</p>
                        <ul>
                            <li><strong>Service delivery:</strong> Providing AI-assisted coding features</li>
                            <li><strong>Account management:</strong> Authentication, billing, support</li>
                            <li><strong>Improvement:</strong> Analyzing usage patterns to improve features</li>
                            <li><strong>Communication:</strong> Service updates, security alerts, marketing (with consent)</li>
                            <li><strong>Legal compliance:</strong> Fraud prevention, legal obligations</li>
                        </ul>
                    </Section>

                    <Section title="4. Legal Basis (GDPR)">
                        <p>We process your data based on:</p>
                        <ul>
                            <li><strong>Contract:</strong> Necessary for providing the Service you requested</li>
                            <li><strong>Consent:</strong> For marketing communications (you can withdraw anytime)</li>
                            <li><strong>Legitimate interest:</strong> Service improvement, security, fraud prevention</li>
                            <li><strong>Legal obligation:</strong> Tax records, regulatory compliance</li>
                        </ul>
                    </Section>

                    <Section title="5. Data Sharing">
                        <p>We share data only with:</p>
                        <ul>
                            <li><strong>AI Providers (BYOK):</strong> If you use your own API keys, your code is sent to your provider</li>
                            <li><strong>Infrastructure:</strong> EU-based cloud providers (Azure EU West, Swiss data centers)</li>
                            <li><strong>Payment:</strong> Stripe (for billing — PCI-DSS compliant)</li>
                            <li><strong>Analytics:</strong> Privacy-focused analytics (no cross-site tracking)</li>
                        </ul>
                        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 mt-3">
                            <p className="text-sm text-text-secondary">
                                <strong className="text-emerald-500">No US Data Transfers:</strong> We do not transfer personal data
                                to the United States. All our infrastructure is EU/Swiss-based.
                            </p>
                        </div>
                    </Section>

                    <Section title="6. Data Retention">
                        <ul>
                            <li><strong>Account data:</strong> Retained while your account is active + 30 days after deletion</li>
                            <li><strong>Code/content:</strong> Processed transiently, not permanently stored</li>
                            <li><strong>Billing records:</strong> 10 years (Swiss legal requirement)</li>
                            <li><strong>Usage logs:</strong> 90 days (for troubleshooting)</li>
                        </ul>
                    </Section>

                    <Section title="7. Your Rights">
                        <p>Under GDPR and Swiss law, you have the right to:</p>
                        <div className="grid sm:grid-cols-2 gap-3 mt-3">
                            {[
                                { title: 'Access', desc: 'Request a copy of your data' },
                                { title: 'Rectification', desc: 'Correct inaccurate data' },
                                { title: 'Erasure', desc: 'Delete your data ("right to be forgotten")' },
                                { title: 'Portability', desc: 'Export your data in a standard format' },
                                { title: 'Restriction', desc: 'Limit how we process your data' },
                                { title: 'Objection', desc: 'Object to certain processing activities' },
                            ].map((right) => (
                                <div key={right.title} className="p-3 rounded-lg border border-border-subtle bg-bg-surface">
                                    <p className="text-xs">
                                        <strong className="text-text-primary">{right.title}:</strong>{' '}
                                        <span className="text-text-muted">{right.desc}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3">
                            To exercise these rights, email <a href="mailto:privacy@numezis.com" className="text-emerald-500 hover:underline">privacy@numezis.com</a>.
                        </p>
                    </Section>

                    <Section title="8. Security">
                        <p>We implement industry-standard security measures:</p>
                        <ul>
                            <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                            <li>Regular security reviews and penetration testing</li>
                            <li>Role-based access controls</li>
                            <li>Incident response procedures</li>
                            <li>SOC 2 Type II compliance (Enterprise)</li>
                        </ul>
                    </Section>

                    <Section title="9. Cookies">
                        <p>
                            We use essential cookies for authentication and security.
                            See our <Link href="/legal/cookies" className="text-emerald-500 hover:underline">Cookie Policy</Link> for details.
                        </p>
                    </Section>

                    <Section title="10. Changes to This Policy">
                        <p>
                            We may update this Privacy Policy periodically. Material changes will be notified via email
                            or through the Service at least 30 days before they take effect.
                        </p>
                    </Section>

                    <Section title="11. Contact & Complaints">
                        <p>For privacy inquiries:</p>
                        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mt-2">
                            <p className="text-text-secondary text-sm">
                                <strong>Data Protection Officer</strong><br />
                                Numezis Technologies SA<br />
                                <a href="mailto:dpo@numezis.com" className="text-emerald-500 hover:underline">dpo@numezis.com</a>
                            </p>
                        </div>
                        <p className="mt-3">
                            If you believe your rights have been violated, you may lodge a complaint with the
                            Swiss Federal Data Protection and Information Commissioner (FDPIC) or your local EU supervisory authority.
                        </p>
                    </Section>
                </article>
            </main>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-border-subtle">
                <div className="max-w-4xl mx-auto flex flex-wrap gap-4 justify-center text-xs text-text-muted">
                    <Link href="/legal/terms" className="hover:text-text-primary">Terms of Service</Link>
                    <Link href="/legal/privacy" className="hover:text-text-primary">Privacy Policy</Link>
                    <Link href="/legal/gdpr" className="hover:text-text-primary">GDPR</Link>
                    <Link href="/legal/cookies" className="hover:text-text-primary">Cookie Policy</Link>
                    <Link href="/legal/imprint" className="hover:text-text-primary">Imprint</Link>
                </div>
            </footer>
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
