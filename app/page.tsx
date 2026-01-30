const extensionLandingUrl = 'https://marketplace.visualstudio.com/items?itemName=numezis.studio'

export default function StudioRedirectPage() {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <p className="rounded-full bg-amber-500/20 px-4 py-1 text-xs uppercase tracking-widest text-amber-200">
          Legacy workbench retired
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Numezis Studio now lives in VS Code
        </h1>
        <p className="text-base text-zinc-300 sm:text-lg">
          We’ve sunset the in-browser workbench and are directing all new workflows through the
          dedicated VS Code extension. You can connect to your backend, run agents, preview diffs,
          and apply changes directly from the editor.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            href={extensionLandingUrl}
            target="_blank"
            rel="noreferrer"
          >
            Install Numezis Studio for VS Code
          </a>
          <span className="rounded-full border border-dashed border-white/30 px-5 py-3 text-sm text-zinc-300">
            Backend docs at <code>docs/vscode-ui.md</code>
          </span>
        </div>
        <div className="text-left text-sm text-zinc-400">
          <p className="font-semibold text-white">Need a reminder?</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Open the command palette and run <code>numezis.connectBackend</code>.</li>
            <li>Use <code>numezis.openChat</code> to start chatting with an agent.</li>
            <li>Choose <code>numezis.runDriftAnalysis</code> or view runs in the Numezis tree.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
