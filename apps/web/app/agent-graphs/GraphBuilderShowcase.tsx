'use client';

/**
 * Decorative marketing illustration — not the real editor.
 * SVG viewBox keeps layout crisp at any width; surface reads like a mini graph IDE.
 */
export function GraphBuilderShowcase() {
    return (
        <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-2xl shadow-black/40">
            <figcaption className="sr-only">
                Illustration of the Kletron graph builder: canvas with connected nodes from intake through branch to report.
            </figcaption>

            {/* Window chrome */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] bg-bg-elevated/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
                <span className="flex gap-1.5" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/90" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/90" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/90" />
                </span>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="truncate font-mono text-[10px] text-text-muted sm:text-[11px]">
                        drift-analysis.kgraph <span className="text-text-muted/60">— saved</span>
                    </p>
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                    <span className="rounded-md border border-white/[0.06] bg-bg-surface/80 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                        Workspace · main
                    </span>
                    <span className="rounded-md border border-[color:var(--kletron-accent)]/35 bg-[color:var(--kletron-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[color:var(--kletron-accent)]">
                        Graph
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] bg-bg-app/80 px-3 py-2 sm:px-4">
                <button
                    type="button"
                    className="rounded-lg bg-[color:var(--kletron-accent)] px-2.5 py-1 text-[10px] font-medium text-white shadow-sm shadow-[color:var(--kletron-accent)]/25 sm:text-[11px]"
                    tabIndex={-1}
                    aria-hidden
                >
                    ▶ Run
                </button>
                <button
                    type="button"
                    className="rounded-lg border border-white/[0.08] bg-bg-surface/60 px-2.5 py-1 text-[10px] font-medium text-text-secondary sm:text-[11px]"
                    tabIndex={-1}
                    aria-hidden
                >
                    Validate
                </button>
                <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
                <div className="flex items-center gap-1 text-[10px] text-text-muted sm:text-[11px]">
                    <span className="rounded border border-white/[0.06] bg-bg-surface/40 px-1.5 py-0.5 font-mono">⌘</span>
                    <span className="hidden sm:inline">snap</span>
                </div>
                <div className="ml-auto flex items-center gap-1 font-mono text-[10px] text-text-muted">
                    <span className="rounded border border-white/[0.06] px-1.5 py-0.5">100%</span>
                    <span className="hidden sm:inline rounded border border-white/[0.06] px-1.5 py-0.5">+</span>
                </div>
            </div>

            <div className="flex min-h-[220px] sm:min-h-[280px]">
                {/* Palette — desktop */}
                <aside
                    className="hidden w-[7.5rem] shrink-0 flex-col gap-2 border-r border-white/[0.06] bg-bg-app/60 p-2.5 sm:flex"
                    aria-hidden
                >
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Add node</p>
                    {[
                        { label: 'Agent', sub: 'LLM + tools' },
                        { label: 'Router', sub: 'branch' },
                        { label: 'Transform', sub: 'map / reduce' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="cursor-default rounded-lg border border-dashed border-white/[0.08] bg-bg-surface/40 px-2 py-1.5 transition hover:border-[color:var(--kletron-accent)]/30 hover:bg-bg-surface/70"
                        >
                            <p className="text-[10px] font-medium text-text-secondary">{item.label}</p>
                            <p className="text-[9px] text-text-muted">{item.sub}</p>
                        </div>
                    ))}
                </aside>

                {/* Canvas */}
                <div className="relative min-h-[220px] flex-1 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:20px_20px] sm:min-h-[280px]">
                    <svg
                        className="absolute inset-0 h-full w-full text-[color:var(--kletron-accent)]"
                        viewBox="0 0 720 300"
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden
                    >
                        <defs>
                            <linearGradient id="gb-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--kletron-accent)" stopOpacity="0.15" />
                                <stop offset="50%" stopColor="var(--kletron-accent)" stopOpacity="0.65" />
                                <stop offset="100%" stopColor="var(--kletron-accent)" stopOpacity="0.2" />
                            </linearGradient>
                            <filter id="gb-soft" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1.2" result="b" />
                                <feMerge>
                                    <feMergeNode in="b" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Edges */}
                        <path
                            d="M 92 150 L 118 150"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            filter="url(#gb-soft)"
                        />
                        <path
                            d="M 218 150 L 248 150"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 348 150 C 378 150 378 98 398 98"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 348 150 C 378 150 378 202 398 202"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 502 98 C 514 112 520 132 528 150"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 502 202 C 514 188 520 168 528 150"
                            fill="none"
                            stroke="url(#gb-edge)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />

                        {/* Start pill */}
                        <rect x="36" y="132" width="56" height="36" rx="18" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                        <circle cx="52" cy="150" r="5" fill="var(--kletron-accent)" opacity="0.85" />
                        <text x="62" y="154" fill="#a1a1aa" fontSize="11" fontFamily="system-ui, sans-serif">
                            Start
                        </text>

                        {/* Intake */}
                        <rect x="118" y="118" width="100" height="64" rx="10" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                        <text x="132" y="142" fill="#e4e4e7" fontSize="12" fontWeight="600" fontFamily="system-ui, sans-serif">
                            Intake
                        </text>
                        <text x="132" y="160" fill="#71717a" fontSize="10" fontFamily="ui-monospace, monospace">
                            context pack
                        </text>

                        {/* Scan — selected */}
                        <rect
                            x="248"
                            y="118"
                            width="100"
                            height="64"
                            rx="10"
                            fill="#1e2528"
                            stroke="var(--kletron-accent)"
                            strokeWidth="2"
                        />
                        <text x="262" y="142" fill="#e4e4e7" fontSize="12" fontWeight="600" fontFamily="system-ui, sans-serif">
                            Scan
                        </text>
                        <text x="262" y="160" fill="#71717a" fontSize="10" fontFamily="ui-monospace, monospace">
                            MCP · hybrid search
                        </text>

                        {/* Delegate */}
                        <rect x="398" y="72" width="104" height="52" rx="10" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                        <text x="410" y="94" fill="#e4e4e7" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif">
                            Delegate
                        </text>
                        <text x="410" y="110" fill="#71717a" fontSize="9" fontFamily="ui-monospace, monospace">
                            tools: allowlist A
                        </text>

                        {/* Explorer */}
                        <rect x="398" y="176" width="104" height="52" rx="10" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                        <text x="410" y="198" fill="#e4e4e7" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif">
                            Explorer
                        </text>
                        <text x="410" y="214" fill="#71717a" fontSize="9" fontFamily="ui-monospace, monospace">
                            read-only recon
                        </text>

                        {/* Report */}
                        <rect x="528" y="118" width="100" height="64" rx="10" fill="#18181b" stroke="rgba(255,255,255,0.1)" />
                        <text x="542" y="142" fill="#e4e4e7" fontSize="12" fontWeight="600" fontFamily="system-ui, sans-serif">
                            Report
                        </text>
                        <text x="542" y="160" fill="#71717a" fontSize="10" fontFamily="ui-monospace, monospace">
                            trace + export
                        </text>

                        {/* Junction */}
                        <circle cx="348" cy="150" r="3" fill="var(--kletron-accent)" opacity="0.7" />
                    </svg>

                    {/* Mobile palette chips */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1.5 sm:hidden" aria-hidden>
                        {['Agent', 'Router', 'Transform'].map((label) => (
                            <span
                                key={label}
                                className="rounded-md border border-white/[0.08] bg-bg-surface/90 px-2 py-0.5 text-[9px] font-medium text-text-muted backdrop-blur-sm"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Status strip */}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-bg-elevated/50 px-3 py-2 text-[10px] text-text-muted sm:px-4">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    Graph valid · 5 nodes · 6 edges
                </span>
                <span className="hidden sm:inline text-text-muted/50">|</span>
                <span className="hidden font-mono text-[10px] text-text-muted/80 sm:inline">last run: draft · EU router</span>
            </div>
        </figure>
    );
}
