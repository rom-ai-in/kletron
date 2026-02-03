'use client';

import Link from 'next/link';

const downloadUrl = '/pricing'; // Points to pricing with download options

export default function WorkbenchPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-4rem)]">
      <div className="max-w-md text-center">
        {/* Logo */}
        <div className="text-5xl mb-6">🧠</div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-text-primary mb-3">
          Download Numezis Code
        </h1>

        {/* Description */}
        <p className="text-sm text-text-muted mb-8 leading-relaxed">
          Numezis Code is an AI-powered IDE built on VS Code. Download the desktop app
          to get the full experience with Deep Agents, visual workflows, and more.
        </p>

        {/* Download Button */}
        <Link
          href={downloadUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-app px-6 py-3 text-sm font-medium hover:bg-text-secondary transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download for Free
        </Link>

        {/* Secondary info */}
        <p className="text-xs text-text-muted">
          Free to download • Available for macOS, Windows, Linux
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
