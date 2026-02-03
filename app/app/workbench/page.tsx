'use client';

const extensionUrl = 'https://marketplace.visualstudio.com/items?itemName=numezis.code';

export default function WorkbenchPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-4rem)]">
      <div className="max-w-md text-center">
        {/* Logo */}
        <div className="text-5xl mb-6">🧠</div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-text-primary mb-3">
          Code in VS Code
        </h1>

        {/* Description */}
        <p className="text-sm text-text-muted mb-8 leading-relaxed">
          Numezis Code works best as a VS Code extension. Install it to get the full
          AI-powered coding experience with Deep Agents, visual workflows, and more.
        </p>

        {/* Install Button */}
        <a
          href={extensionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-6 py-3 text-sm font-medium hover:bg-text-secondary transition-colors mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
          </svg>
          Install VS Code Extension
        </a>

        {/* Secondary info */}
        <p className="text-xs text-text-muted">
          Free to install • Works with any VS Code workspace
        </p>

        {/* Features list */}
        <div className="mt-10 pt-8 border-t border-border-subtle">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
            What you'll get
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs text-text-muted text-left">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              Deep Agents
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              Visual Graph Editor
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              Multi-file refactoring
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              Context-aware AI
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              Local LLM support
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              EU data residency
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
