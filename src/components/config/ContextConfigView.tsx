"use client";

import { useEffect, useState } from "react";
import { Settings, CheckCircle2, AlertCircle } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { AuditContextForm } from "@/src/components/AuditContextForm";
import type { AuditContext } from "@/src/shared/auditContext";

function formatAuditContextSummary(context: AuditContext | undefined): string | null {
  if (!context) return null;
  const parts: string[] = [];
  if (context.mission?.trim()) {
    parts.push(`Mission: ${context.mission.trim().slice(0, 20)}...`);
  }
  if (context.startupPhase) {
    parts.push(`Phase: ${context.startupPhase}`);
  }
  if (parts.length === 0) return null;
  return parts.join(" | ");
}

export function ContextConfigView() {
  const [auditContext, setAuditContext] = useState<AuditContext>({});
  const [auditContextEnabled, setAuditContextEnabled] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let hadLocal = false;
    const stored = window.localStorage.getItem("numezis-audit-context");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed.enabled === "boolean") setAuditContextEnabled(parsed.enabled);
        if (parsed.context) setAuditContext(parsed.context);
        hadLocal = true;
      } catch (e) {
        console.error("Failed to parse stored context", e);
      }
    }

    // Load DB-backed config (source of truth), but don't clobber local edits unless there was no local state.
    fetch("/api/context-config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) return;
        if (!hadLocal) {
          if (typeof data.enabled === "boolean") setAuditContextEnabled(data.enabled);
          if (data.context) setAuditContext(data.context);
        }
      })
      .catch(() => {
        // ignore; localStorage fallback is fine
      })
      .finally(() => setHasLoaded(true));
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    const payload = { enabled: auditContextEnabled, context: auditContext };
    window.localStorage.setItem("numezis-audit-context", JSON.stringify(payload));
  }, [auditContext, auditContextEnabled, hasLoaded]);

  const persist = async (nextEnabled: boolean, nextContext: AuditContext) => {
    setError(null);
    const res = await fetch("/api/context-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled, context: nextContext }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as any)?.error || "Failed to save context config");
    }
  };

  const handleSave = async (newContext: AuditContext) => {
    setAuditContext(newContext);
    try {
      await persist(auditContextEnabled, newContext);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Context Configuration</h1>
            <p className="text-sm text-text-muted">
              Manage global context and constraints for all agent operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${auditContextEnabled ? "text-text-primary" : "text-text-muted"}`}
            >
              {auditContextEnabled ? "Context Active" : "Context Disabled"}
            </span>
            <button
              type="button"
              onClick={async () => {
                const next = !auditContextEnabled;
                setAuditContextEnabled(next);
                try {
                  await persist(next, auditContext);
                  setIsSaved(true);
                  setTimeout(() => setIsSaved(false), 1500);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${auditContextEnabled ? "bg-emerald-500" : "bg-bg-elevated border border-border-subtle"}`}
            >
              <span
                className={`${auditContextEnabled ? "translate-x-4" : "translate-x-0.5"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
              />
            </button>
          </div>
          {isSaved && (
            <span className="text-xs font-medium text-emerald-500">Saved</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
        {error && (
          <Panel className="p-3 border border-border-subtle bg-bg-elevated text-rose-300 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-rose-400" />
              <span>{error}</span>
            </div>
          </Panel>
        )}
        {/* Status Card */}
        <Panel
          className={`p-4 border-l-4 ${auditContextEnabled ? "border-l-emerald-500" : "border-l-text-muted"}`}
        >
          <div className="flex items-start gap-3">
            {auditContextEnabled ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-text-muted mt-0.5" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {auditContextEnabled ? "Context Injection Enabled" : "Context Injection Paused"}
              </h3>
              <p className="text-xs text-text-secondary mt-1 max-w-2xl">
                {auditContextEnabled
                  ? "Global context is currently being injected into all agent prompts. This helps ground the AI with specific knowledge about your mission, constraints, and architecture."
                  : "Agents are running in a stateless mode without global context. Enable this to improve consistency and relevance across tasks."}
              </p>
              {auditContextEnabled && (
                <p className="text-xs font-mono text-text-muted mt-2 bg-bg-app p-2 rounded border border-border-subtle inline-block">
                  Current Summary: {formatAuditContextSummary(auditContext) || "No active context data"}
                </p>
              )}
            </div>
          </div>
        </Panel>

        {/* Main Form */}
        <div
          className={`transition-opacity duration-200 ${auditContextEnabled ? "opacity-100" : "opacity-50 pointer-events-none grayscale"}`}
        >
          <AuditContextForm
            initialContext={auditContext}
            onSave={handleSave}
            onCancel={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

