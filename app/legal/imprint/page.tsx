'use client';

import Link from 'next/link';

export default function ImprintPage() {
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
                        <h1 className="text-3xl font-bold text-text-primary mb-4">Legal Notice (Imprint)</h1>
                        <p className="text-sm text-text-muted">
                            Information pursuant to Swiss law and EU e-Commerce Directive requirements.
                        </p>
                    </div>

                    {/* Company Information */}
                    <div className="p-6 rounded-xl border border-border-subtle bg-bg-surface mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">🧠</span>
                            <div>
                                <h2 className="text-xl font-semibold text-text-primary">Numezis Technologies SA</h2>
                                <p className="text-xs text-text-muted">Société Anonyme (Swiss Public Limited Company)</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6 text-sm">
                            <div>
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Registered Address</h3>
                                <p className="text-text-secondary">
                                    Numezis Technologies SA<br />
                                    Rue du Rhône 14<br />
                                    1204 Geneva<br />
                                    Switzerland 🇨🇭
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Registration</h3>
                                <p className="text-text-secondary">
                                    Commercial Register: Geneva<br />
                                    Company Number: CHE-XXX.XXX.XXX<br />
                                    VAT Number: CHE-XXX.XXX.XXX TVA
                                </p>
                            </div>
                        </div>
                    </div>

                    <Section title="Contact Information">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">General Inquiries</h3>
                                <p className="text-sm text-text-secondary">
                                    <a href="mailto:hello@numezis.com" className="text-emerald-500 hover:underline">hello@numezis.com</a>
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Support</h3>
                                <p className="text-sm text-text-secondary">
                                    <a href="mailto:support@numezis.com" className="text-emerald-500 hover:underline">support@numezis.com</a>
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Legal Department</h3>
                                <p className="text-sm text-text-secondary">
                                    <a href="mailto:legal@numezis.com" className="text-emerald-500 hover:underline">legal@numezis.com</a>
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Data Protection</h3>
                                <p className="text-sm text-text-secondary">
                                    <a href="mailto:dpo@numezis.com" className="text-emerald-500 hover:underline">dpo@numezis.com</a>
                                </p>
                            </div>
                        </div>
                    </Section>

                    <Section title="Management">
                        <p>
                            <strong>Board of Directors:</strong> To be publicly disclosed upon registration completion.
                        </p>
                        <p>
                            <strong>Managing Director:</strong> To be publicly disclosed upon registration completion.
                        </p>
                    </Section>

                    <Section title="Regulatory Information">
                        <ul>
                            <li>
                                <strong>Applicable Law:</strong> Swiss law, with adherence to EU regulations for services
                                offered within the European Union.
                            </li>
                            <li>
                                <strong>Supervisory Authority (Data Protection):</strong> Federal Data Protection and
                                Information Commissioner (FDPIC), Switzerland.
                            </li>
                            <li>
                                <strong>Online Dispute Resolution:</strong> EU consumers may access the European Commission&apos;s
                                Online Dispute Resolution platform at{' '}
                                <a
                                    href="https://ec.europa.eu/consumers/odr"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-500 hover:underline"
                                >
                                    ec.europa.eu/consumers/odr
                                </a>
                            </li>
                        </ul>
                    </Section>

                    <Section title="Liability Disclaimer">
                        <p>
                            Despite careful content control, we assume no liability for the content of external links.
                            The operators of linked pages are solely responsible for their content.
                        </p>
                        <p>
                            All information on this website is provided without warranty. Numezis Technologies SA
                            reserves the right to make changes or corrections at any time.
                        </p>
                    </Section>

                    <Section title="Copyright">
                        <p>
                            © 2026 Numezis Technologies SA. All rights reserved.
                        </p>
                        <p>
                            The content and works on these pages created by the operators are subject to Swiss copyright law.
                            Reproduction, editing, distribution, or any kind of exploitation outside the limits of copyright
                            law requires written consent.
                        </p>
                    </Section>

                    <Section title="EU Representative (Art. 27 GDPR)">
                        <p>
                            As a Swiss company offering services to EU residents, our EU representative for
                            data protection matters is:
                        </p>
                        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mt-3">
                            <p className="text-sm text-text-secondary">
                                <strong>Numezis EU Representative</strong><br />
                                [To be appointed]<br />
                                Dublin, Ireland<br />
                                <a href="mailto:eu-representative@numezis.com" className="text-emerald-500 hover:underline">
                                    eu-representative@numezis.com
                                </a>
                            </p>
                        </div>
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
