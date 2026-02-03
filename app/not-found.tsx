import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen w-full bg-bg-app flex items-center justify-center px-6">
            <div className="max-w-md text-center">
                {/* Fun emoji scene */}
                <div className="relative mb-8">
                    <div className="text-8xl animate-bounce">🧠</div>
                    <div className="absolute -top-2 -right-4 text-2xl animate-pulse">💭</div>
                    <div className="absolute top-4 -left-2 text-lg opacity-50 animate-spin" style={{ animationDuration: '3s' }}>❓</div>
                </div>

                {/* Error code with style */}
                <div className="mb-6">
                    <h1 className="text-7xl font-bold text-text-primary mb-2 tracking-tighter">404</h1>
                    <div className="h-1 w-16 mx-auto bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" />
                </div>

                {/* Fun message */}
                <h2 className="text-xl font-semibold text-text-primary mb-3">
                    Oops! Our AI agent got lost
                </h2>
                <p className="text-sm text-text-muted mb-2">
                    It seems our deep agent wandered into uncharted territory...
                </p>
                <p className="text-xs text-text-muted/60 font-mono mb-8">
                    Error: Path.notFound() — The neural pathways don't lead here
                </p>

                {/* What happened */}
                <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface mb-8 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                        Possible causes:
                    </div>
                    <ul className="space-y-1.5 text-xs text-text-secondary">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            The page has moved to /app/*
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            You typed the URL incorrectly
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            The page doesn't exist anymore
                        </li>
                    </ul>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-5 py-2.5 text-sm font-medium hover:bg-text-secondary transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Back to Home
                    </Link>
                    <Link
                        href="/app/deep-agent"
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        Open Deep Agent
                    </Link>
                </div>

                {/* Footer hint */}
                <p className="mt-12 text-[10px] text-text-muted/40">
                    Pro tip: All app pages are now under /app/* 🧭
                </p>
            </div>
        </div>
    );
}
