import React from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@kletron/ui/components/design-system";
import type { SessionStatus } from "../types";

export { isSessionUnlocked } from "../sessionAccess";

export type DesktopAuthGateProps = {
  status: SessionStatus;
  backendUrl: string;
  setBackendUrl: (value: string) => void;
  backendUrlValid: boolean;
  backendConnected: boolean;
  loginPending: boolean;
  loginError: string | null;
  onSignIn: () => void;
  onRegister: () => void;
  onCancelSignIn: () => void;
  /** The same account chip as the unlocked shell, so the state reads identically. */
  accountSlot?: React.ReactNode;
};

const COPY: Record<string, { title: string; body: string }> = {
  "signed-out": {
    title: "Sign in to Kletron",
    body: "Your workspaces, threads, and automations live in your Kletron account. Sign in to unlock the app.",
  },
  expired: {
    title: "Session expired",
    body: "Kletron signed you out because your session is no longer valid. Sign in again to continue where you left off.",
  },
  unconfigured: {
    title: "Connect to a Kletron backend",
    body: "Enter the address of the Kletron server you want this Mac to talk to, then sign in.",
  },
  "signing-in": {
    title: "Waiting for your browser",
    body: "Finish signing in in the browser window that just opened. This window unlocks by itself.",
  },
};

export function DesktopAuthGate({
  status,
  backendUrl,
  setBackendUrl,
  backendUrlValid,
  backendConnected,
  loginPending,
  loginError,
  onSignIn,
  onRegister,
  onCancelSignIn,
  accountSlot,
}: DesktopAuthGateProps) {
  const copy = COPY[status] ?? COPY["signed-out"];
  const reachability = !backendUrlValid
    ? { label: "Invalid URL", dot: "bg-status-error", text: "text-status-error-text" }
    : backendConnected
      ? { label: "Reachable", dot: "bg-status-success", text: "text-status-success-text" }
      : { label: "Unreachable", dot: "bg-status-warning", text: "text-status-warning-text" };

  return (
    <div className="flex h-screen flex-col bg-bg-app text-text-primary">
      {/* Reduced title bar: window drag + account state only — no workspace, no git, no nav. */}
      <header className="relative z-50 flex h-9 shrink-0 items-center justify-between glass-titlebar px-4 pl-[76px] app-region-drag">
        <span className="text-[11px] font-medium text-text-muted">Kletron</span>
        {accountSlot ? <div className="app-region-no-drag">{accountSlot}</div> : null}
      </header>

      <div className="app-region-no-drag flex flex-1 items-center justify-center overflow-y-auto p-8 scrollbar-elegant">
        <div className="w-full max-w-[420px]">
          <div className="rounded-xl border border-white/[0.08] bg-bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                🧠
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight text-text-primary">{copy.title}</h1>
                <p className="text-[11px] text-text-muted">Kletron for Mac</p>
              </div>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-text-secondary">{copy.body}</p>

            {/* Backend URL is the one setting reachable while locked: without a server there is
                nothing to sign in to. Everything else stays behind the gate. */}
            <div className="mb-5 space-y-2">
              <label
                htmlFor="gate-backend-url"
                className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted"
              >
                Backend URL
              </label>
              <input
                id="gate-backend-url"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="https://app.kletron.com"
                className="w-full rounded-md bg-bg-app px-3 py-2 text-xs text-text-primary ring-1 ring-inset ring-border-subtle/90 focus:outline-none focus:ring-border-strong"
              />
              <div className={`flex items-center gap-1.5 text-[10px] ${reachability.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${reachability.dot}`} aria-hidden />
                {reachability.label}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                type="button"
                onClick={onSignIn}
                disabled={!backendUrlValid || loginPending}
              >
                {loginPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Waiting for the browser…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in with browser
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </span>
                )}
              </Button>

              {loginPending ? (
                <Button variant="ghost" size="sm" fullWidth type="button" onClick={onCancelSignIn}>
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  type="button"
                  onClick={onRegister}
                  disabled={!backendUrlValid}
                >
                  Create an account
                </Button>
              )}
            </div>

            {loginError ? (
              <p className="mt-4 text-[11px] leading-relaxed text-status-error-text">{loginError}</p>
            ) : null}
          </div>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-text-muted">
            Signing in opens your default browser and returns to Kletron automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
