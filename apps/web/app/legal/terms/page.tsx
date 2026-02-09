'use client';

import Link from 'next/link';
import { MarketingHeader, MarketingFooter } from '@numezis/ui/components/design-system';

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen w-full bg-bg-app">
            <MarketingHeader LinkComponent={Link} />

            {/* Content */}
            <main className="pt-24 pb-16 px-6">
                <article className="max-w-3xl mx-auto prose prose-invert prose-sm">
                    <div className="mb-8">
                        <p className="text-xs text-text-muted mb-2">Last updated: February 2, 2026</p>
                        <h1 className="text-3xl font-bold text-text-primary mb-4">Terms of Service</h1>
                        <p className="text-sm text-text-muted">
                            These Terms of Service (&quot;Terms&quot;) govern your use of Numezis Code, operated by Numezis Technologies SA,
                            a Swiss company headquartered in Switzerland.
                        </p>
                    </div>

                    <Section title="1. Acceptance of Terms">
                        <p>
                            By accessing or using Numezis Code (the &quot;Service&quot;), you agree to be bound by these Terms.
                            If you do not agree to these Terms, you may not use the Service.
                        </p>
                        <p>
                            We reserve the right to update these Terms at any time. We will notify you of material changes
                            via email or through the Service. Your continued use after such changes constitutes acceptance.
                        </p>
                    </Section>

                    <Section title="2. Description of Service">
                        <p>
                            Numezis Code is an AI-powered coding assistant provided as a desktop IDE and web platform.
                            The Service includes:
                        </p>
                        <ul>
                            <li>AI-assisted code generation and analysis</li>
                            <li>Visual agent graph editor</li>
                            <li>Semantic code indexing</li>
                            <li>Multi-repository campaign management</li>
                            <li>Integration with third-party AI providers (BYOK model)</li>
                        </ul>
                    </Section>

                    <Section title="3. Account Registration">
                        <p>
                            To use certain features of the Service, you must create an account. You agree to:
                        </p>
                        <ul>
                            <li>Provide accurate, current, and complete information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Accept responsibility for all activities under your account</li>
                            <li>Notify us immediately of any unauthorized use</li>
                        </ul>
                    </Section>

                    <Section title="4. Subscription Plans and Payment">
                        <p>
                            <strong>4.1 Plans:</strong> We offer multiple subscription tiers (Starter, Pro, Team, Enterprise)
                            with different features and pricing as described on our <Link href="/pricing" className="text-status-success-text hover:underline">Pricing page</Link>.
                        </p>
                        <p>
                            <strong>4.2 BYOK Model:</strong> You may use your own API keys from third-party AI providers.
                            In this case, you are responsible for any costs incurred with those providers.
                        </p>
                        <p>
                            <strong>4.3 Hosted Tokens:</strong> Pro and Team plans include hosted AI tokens.
                            Additional tokens are billed at the rates specified in your plan.
                        </p>
                        <p>
                            <strong>4.4 Billing:</strong> Subscriptions are billed in advance on a monthly or annual basis.
                            All prices are in EUR and exclude applicable taxes (VAT/Swiss VAT).
                        </p>
                        <p>
                            <strong>4.5 Refunds:</strong> Subscription fees are non-refundable except as required by applicable law
                            or as explicitly stated in these Terms.
                        </p>
                    </Section>

                    <Section title="5. Acceptable Use">
                        <p>You agree not to use the Service to:</p>
                        <ul>
                            <li>Violate any applicable laws or regulations</li>
                            <li>Infringe on intellectual property rights of others</li>
                            <li>Generate malicious code, malware, or security exploits</li>
                            <li>Attempt to reverse engineer or extract the AI models</li>
                            <li>Share account credentials or API tokens with unauthorized parties</li>
                            <li>Circumvent usage limits or billing mechanisms</li>
                            <li>Interfere with the operation of the Service</li>
                        </ul>
                    </Section>

                    <Section title="6. Intellectual Property">
                        <p>
                            <strong>6.1 Your Code:</strong> You retain all ownership rights to the code you create,
                            modify, or process using the Service. We claim no ownership over your code or outputs.
                        </p>
                        <p>
                            <strong>6.2 Our Service:</strong> The Service, including its software, design, and documentation,
                            is owned by Numezis Technologies SA and protected by intellectual property laws.
                        </p>
                        <p>
                            <strong>6.3 Feedback:</strong> Any feedback you provide may be used by us to improve the Service
                            without obligation to you.
                        </p>
                    </Section>

                    <Section title="7. Data Processing">
                        <p>
                            Your use of the Service is also governed by our <Link href="/legal/privacy" className="text-status-success-text hover:underline">Privacy Policy</Link> and
                            <Link href="/legal/gdpr" className="text-status-success-text hover:underline ml-1">GDPR Compliance</Link> documentation.
                        </p>
                        <p>
                            <strong>Key guarantees:</strong>
                        </p>
                        <ul>
                            <li>All data is processed within the European Union</li>
                            <li>We are not subject to US surveillance laws (CLOUD Act, FISA 702)</li>
                            <li>Enterprise customers may request Swiss data residency exclusively</li>
                        </ul>
                    </Section>

                    <Section title="8. Service Availability">
                        <p>
                            We strive for high availability but do not guarantee uninterrupted service.
                            We may perform maintenance with reasonable notice. Enterprise plans include
                            specific SLA commitments.
                        </p>
                    </Section>

                    <Section title="9. Limitation of Liability">
                        <p>
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NUMEZIS TECHNOLOGIES SA SHALL NOT BE LIABLE FOR:
                        </p>
                        <ul>
                            <li>Indirect, incidental, or consequential damages</li>
                            <li>Loss of profits, data, or business opportunities</li>
                            <li>Damages arising from AI-generated code suggestions</li>
                            <li>Third-party AI provider failures (for BYOK users)</li>
                        </ul>
                        <p>
                            Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim.
                        </p>
                    </Section>

                    <Section title="10. Termination">
                        <p>
                            <strong>10.1 By You:</strong> You may cancel your subscription at any time through your account settings.
                            Access continues until the end of your billing period.
                        </p>
                        <p>
                            <strong>10.2 By Us:</strong> We may terminate or suspend your account for violation of these Terms,
                            non-payment, or at our discretion with 30 days notice.
                        </p>
                        <p>
                            <strong>10.3 Effect:</strong> Upon termination, you may export your data for 30 days.
                            After this period, your data will be deleted in accordance with our Privacy Policy.
                        </p>
                    </Section>

                    <Section title="11. Governing Law and Disputes">
                        <p>
                            These Terms are governed by the laws of Switzerland, without regard to conflict of law principles.
                        </p>
                        <p>
                            Any disputes shall be resolved by the competent courts of Geneva, Switzerland.
                            For EU consumers, mandatory consumer protection laws of your country of residence may also apply.
                        </p>
                    </Section>

                    <Section title="12. Contact">
                        <p>For questions about these Terms, please contact:</p>
                        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mt-4">
                            <p className="text-text-secondary">
                                <strong>Numezis Technologies SA</strong><br />
                                Legal Department<br />
                                Geneva, Switzerland<br />
                                <a href="mailto:legal@numezis.com" className="text-status-success-text hover:underline">legal@numezis.com</a>
                            </p>
                        </div>
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
