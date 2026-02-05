'use client';

import Link from 'next/link';

export default function GDPRPage() {
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
                        <h1 className="text-3xl font-bold text-text-primary mb-4">GDPR Compliance</h1>
                        <p className="text-sm text-text-muted">
                            Numezis Technologies SA is committed to full compliance with the General Data Protection Regulation (GDPR)
                            and the Swiss Federal Act on Data Protection (FADP).
                        </p>
                    </div>

                    {/* Commitment Banner */}
                    <div className="p-6 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 mb-8">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">🇪🇺</span>
                            <div>
                                <h2 className="text-lg font-semibold text-text-primary mb-2">Our European Commitment</h2>
                                <ul className="text-sm text-text-secondary space-y-1">
                                    <li>✓ Swiss company — not subject to US jurisdiction</li>
                                    <li>✓ All data processed within EU/Switzerland</li>
                                    <li>✓ No CLOUD Act, no FISA 702 exposure</li>
                                    <li>✓ GDPR-compliant by design, not as an afterthought</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <Section title="Data Processing Overview">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-border-subtle">
                                        <th className="text-left py-2 text-text-muted font-medium">Data Category</th>
                                        <th className="text-left py-2 text-text-muted font-medium">Purpose</th>
                                        <th className="text-left py-2 text-text-muted font-medium">Legal Basis</th>
                                        <th className="text-left py-2 text-text-muted font-medium">Retention</th>
                                    </tr>
                                </thead>
                                <tbody className="text-text-secondary">
                                    <tr className="border-b border-border-subtle/50">
                                        <td className="py-2">Email, Name</td>
                                        <td className="py-2">Account management</td>
                                        <td className="py-2">Contract</td>
                                        <td className="py-2">Account lifetime + 30 days</td>
                                    </tr>
                                    <tr className="border-b border-border-subtle/50">
                                        <td className="py-2">Payment info</td>
                                        <td className="py-2">Billing</td>
                                        <td className="py-2">Contract</td>
                                        <td className="py-2">10 years (legal)</td>
                                    </tr>
                                    <tr className="border-b border-border-subtle/50">
                                        <td className="py-2">Code/Content</td>
                                        <td className="py-2">AI processing</td>
                                        <td className="py-2">Contract</td>
                                        <td className="py-2">Transient only</td>
                                    </tr>
                                    <tr className="border-b border-border-subtle/50">
                                        <td className="py-2">Usage metrics</td>
                                        <td className="py-2">Service improvement</td>
                                        <td className="py-2">Legitimate interest</td>
                                        <td className="py-2">90 days</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2">Marketing emails</td>
                                        <td className="py-2">Product updates</td>
                                        <td className="py-2">Consent</td>
                                        <td className="py-2">Until withdrawn</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    <Section title="Your GDPR Rights">
                        <p>
                            As a data subject, you have the following rights under GDPR Articles 15-22:
                        </p>
                        <div className="grid gap-3 mt-4">
                            {[
                                {
                                    article: 'Art. 15',
                                    title: 'Right of Access',
                                    desc: 'Request a copy of all personal data we hold about you',
                                    action: 'Request via account settings or email',
                                },
                                {
                                    article: 'Art. 16',
                                    title: 'Right to Rectification',
                                    desc: 'Correct inaccurate or incomplete data',
                                    action: 'Update in account settings',
                                },
                                {
                                    article: 'Art. 17',
                                    title: 'Right to Erasure',
                                    desc: 'Request deletion of your data ("right to be forgotten")',
                                    action: 'Delete account or request via email',
                                },
                                {
                                    article: 'Art. 18',
                                    title: 'Right to Restriction',
                                    desc: 'Limit processing while disputes are resolved',
                                    action: 'Request via email',
                                },
                                {
                                    article: 'Art. 20',
                                    title: 'Right to Portability',
                                    desc: 'Export your data in a machine-readable format',
                                    action: 'Export from account settings',
                                },
                                {
                                    article: 'Art. 21',
                                    title: 'Right to Object',
                                    desc: 'Object to processing based on legitimate interests',
                                    action: 'Request via email',
                                },
                            ].map((right) => (
                                <div key={right.article} className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-elevated text-text-muted">{right.article}</span>
                                                <h3 className="text-sm font-medium text-text-primary">{right.title}</h3>
                                            </div>
                                            <p className="text-xs text-text-muted">{right.desc}</p>
                                        </div>
                                        <span className="text-[10px] text-emerald-500 whitespace-nowrap">{right.action}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Data Processing Agreements">
                        <p>
                            For Enterprise customers, we offer a comprehensive Data Processing Agreement (DPA) that includes:
                        </p>
                        <ul>
                            <li>Standard Contractual Clauses (SCCs) for any sub-processors</li>
                            <li>Technical and organizational security measures (TOMs)</li>
                            <li>Sub-processor list and notification procedures</li>
                            <li>Review rights</li>
                        </ul>
                        <p className="mt-3">
                            Contact <a href="mailto:legal@numezis.com" className="text-emerald-500 hover:underline">legal@numezis.com</a> to
                            request a DPA.
                        </p>
                    </Section>

                    <Section title="Sub-Processors">
                        <p>We use the following sub-processors to deliver our Service:</p>
                        <div className="mt-3 space-y-2">
                            {[
                                { name: 'Supabase', purpose: 'Authentication', location: 'EU (Frankfurt)' },
                                { name: 'MongoDB Atlas', purpose: 'Database', location: 'EU (Ireland)' },
                                { name: 'Azure', purpose: 'AI infrastructure', location: 'EU (West Europe)' },
                                { name: 'Stripe', purpose: 'Payment processing', location: 'EU (Dublin)' },
                            ].map((sp) => (
                                <div key={sp.name} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-bg-surface text-xs">
                                    <span className="text-text-primary font-medium">{sp.name}</span>
                                    <span className="text-text-muted">{sp.purpose}</span>
                                    <span className="text-emerald-500">{sp.location}</span>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Data Breach Notification">
                        <p>
                            In the event of a personal data breach that poses a risk to your rights,
                            we will notify you within 72 hours in accordance with GDPR Article 33.
                        </p>
                    </Section>

                    <Section title="Contact Our DPO">
                        <p>For GDPR-related inquiries, contact our Data Protection Officer:</p>
                        <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mt-3">
                            <p className="text-text-secondary text-sm">
                                <strong>Data Protection Officer</strong><br />
                                Numezis Technologies SA<br />
                                Geneva, Switzerland<br />
                                <a href="mailto:dpo@numezis.com" className="text-emerald-500 hover:underline">dpo@numezis.com</a>
                            </p>
                        </div>
                    </Section>

                    <Section title="Supervisory Authority">
                        <p>You may lodge a complaint with:</p>
                        <ul>
                            <li>
                                <strong>Switzerland:</strong> Federal Data Protection and Information Commissioner (FDPIC)<br />
                                <a href="https://www.edoeb.admin.ch" className="text-emerald-500 hover:underline" target="_blank" rel="noopener noreferrer">edoeb.admin.ch</a>
                            </li>
                            <li className="mt-2">
                                <strong>EU:</strong> Your local Data Protection Authority
                            </li>
                        </ul>
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
