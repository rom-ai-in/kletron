import { useMemo } from "react";
import {
  Settings,
  Folder,
  Brain,
  Layers,
  MessagesSquare,
  ListTree,
  Wrench,
  Link as LinkIcon,
  Puzzle,
  ArrowRight,
} from "lucide-react";
import { Panel } from "@kletron/ui/components/design-system";
import { Button, Toggle, LLMSelector } from "@kletron/ui/components/design-system";
import type { LLMProvider } from "@kletron/ui/components/design-system";
import { CONFIG_HUB_CARDS, type ConfigHubIconKey } from "@kletron/shared/configHubCards";
import { SettingsCard } from "../components/SettingsCard";
import type { SettingsToggles } from "../types";

function HubIcon({ name }: { name: ConfigHubIconKey }) {
  const cls = "h-4 w-4 text-text-muted shrink-0";
  switch (name) {
    case "folder":
      return <Folder className={cls} />;
    case "brain":
      return <Brain className="h-4 w-4 text-status-success-text shrink-0" />;
    case "layers":
      return <Layers className={cls} />;
    case "messagesSquare":
      return <MessagesSquare className="h-4 w-4 text-primary-main shrink-0" />;
    case "listTree":
      return <ListTree className={cls} />;
    case "wrench":
      return <Wrench className={cls} />;
    case "link":
      return <LinkIcon className={cls} />;
    case "puzzle":
      return <Puzzle className={cls} />;
    default:
      return <Settings className={cls} />;
  }
}

function metaForCard(
  id: string,
  opts: {
    activeWorkspaceId: string | null;
    graphsCount: number;
    toolsCount: number;
    aiModelsMeta: string;
    hubLoading: boolean;
  },
): string {
  const ws = opts.activeWorkspaceId;
  switch (id) {
    case "workspace":
      return "Repository Settings";
    case "aiModels":
      return opts.hubLoading ? "Loading…" : opts.aiModelsMeta;
    case "context":
      return "Includes vector index & history";
    case "channels":
      return "Dedicated setup · env vars on server";
    case "graphs":
      return opts.hubLoading ? "Loading…" : `${opts.graphsCount} graphs`;
    case "tools":
      return opts.hubLoading ? "Loading…" : `${opts.toolsCount} tools available`;
    case "categories":
      return "Two modes";
    case "skills":
      return ws ? "This workspace" : "Pick a workspace";
    case "connectors":
      return ws ? "OAuth & MCP" : "Pick a workspace";
    case "plugins":
      return ws ? "This workspace" : "Pick a workspace";
    default:
      return "";
  }
}

export type ConfigurationViewProps = {
  openPortalPath: (path: string) => void;
  activeWorkspaceId: string | null;
  graphsCount: number;
  toolsCount: number;
  aiModelsMeta: string;
  hubLoading: boolean;
  portalConfigSnapshot: {
    loading: boolean;
    error: string | null;
    embeddingLine?: string | null;
    contextLine?: string | null;
  };
  /** Device */
  backendUrl: string;
  setBackendUrl: (v: string) => void;
  backendConnected: boolean;
  backendUrlValid: boolean;
  userEmail?: string | null;
  hasAccessToken: boolean;
  loginPending: boolean;
  loginError: string | null;
  onSignOut: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  settingsToggles: SettingsToggles;
  setSettingsToggles: React.Dispatch<React.SetStateAction<SettingsToggles>>;
  providers: LLMProvider[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  /** Archived threads */
  archivedThreads: Array<{ id: string; title?: string | null }>;
  archivedLoading: boolean;
  onRefreshArchived: () => void;
  onOpenArchivedThread: (id: string) => void;
};

export function ConfigurationView({
  openPortalPath,
  activeWorkspaceId,
  graphsCount,
  toolsCount,
  aiModelsMeta,
  hubLoading,
  portalConfigSnapshot,
  backendUrl,
  setBackendUrl,
  backendConnected,
  backendUrlValid,
  userEmail,
  hasAccessToken,
  loginPending,
  loginError,
  onSignOut,
  onSignIn,
  onRegister,
  settingsToggles,
  setSettingsToggles,
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  archivedThreads,
  archivedLoading,
  onRefreshArchived,
  onOpenArchivedThread,
}: ConfigurationViewProps) {
  const metaOpts = useMemo(
    () => ({
      activeWorkspaceId,
      graphsCount,
      toolsCount,
      aiModelsMeta,
      hubLoading,
    }),
    [activeWorkspaceId, graphsCount, toolsCount, aiModelsMeta, hubLoading],
  );

  const aiModelsHighlight = useMemo(() => {
    const m = aiModelsMeta.trim().toLowerCase();
    return m !== "" && m !== "not configured";
  }, [aiModelsMeta]);

  return (
    <div className="flex h-full flex-col bg-bg-app overflow-hidden min-h-0">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4 shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
            <Settings className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary">Configuration</h1>
            <p className="text-sm text-text-muted">One place to manage AI providers and Graph flows.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CONFIG_HUB_CARDS.map((card) => {
            const meta = metaForCard(card.id, metaOpts);
            const highlight =
              card.highlightEligible && card.id === "aiModels" ? aiModelsHighlight : false;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => openPortalPath(card.href)}
                className="group text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Panel
                  className={`p-4 h-full transition-colors group-hover:border-border-strong ${
                    highlight ? "border-status-success-border" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <HubIcon name={card.icon} />
                        <h2
                          className={`text-sm font-semibold ${
                            highlight ? "text-status-success-text" : "text-text-primary"
                          }`}
                        >
                          {card.title}
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{card.description}</p>
                      <p className="mt-3 text-[11px] text-text-muted">{meta}</p>
                    </div>
                    <div className="mt-0.5 text-text-muted group-hover:text-text-primary transition-colors">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Panel>
              </button>
            );
          })}
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">This device</h2>
          <p className="text-xs text-text-muted">
            Backend URL, sign-in, and local preferences are stored on this computer only.
          </p>
          <SettingsCard>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-text-primary">Backend URL</div>
                <div className="text-xs text-text-muted">Connect to your Kletron backend.</div>
              </div>
              <input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="w-56 rounded-md bg-bg-app px-2 py-1 text-xs text-text-primary ring-1 ring-inset ring-border-subtle/90 focus:outline-none focus:ring-border-strong"
                placeholder="https://app.kletron.com"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <div className="text-sm font-medium text-text-primary">Backend reachability</div>
              <span
                className={`flex items-center gap-1.5 text-xs ${backendConnected ? "text-status-success-text" : "text-status-error-text"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${backendConnected ? "bg-status-success" : "bg-status-error"}`} />
                {!backendUrlValid ? "Invalid URL" : backendConnected ? "Reachable" : "Unreachable"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-text-primary">Account</div>
                <div className="text-xs text-text-muted">{userEmail || "Sign in to access threads."}</div>
              </div>
              <div className="flex items-center gap-2">
                {hasAccessToken ? (
                  <Button size="xs" variant="secondary" onClick={onSignOut}>
                    Sign out
                  </Button>
                ) : (
                  <>
                    <Button size="xs" variant="secondary" onClick={onSignIn} disabled={!backendUrlValid || loginPending}>
                      {loginPending ? "Signing in…" : "Sign in"}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={onRegister} disabled={!backendUrlValid || loginPending}>
                      Create account
                    </Button>
                  </>
                )}
              </div>
            </div>
            {loginError ? <div className="px-3 py-2 text-xs text-status-error-text">{loginError}</div> : null}
          </SettingsCard>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">Models (this app)</h3>
            <LLMSelector
              providers={providers}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">Embeddings &amp; context</h3>
            <p className="text-xs text-text-muted">
              Read-only snapshot from your workspace. Edit in the web app.
            </p>
            {portalConfigSnapshot.error ? (
              <div className="text-xs text-status-error-text">{portalConfigSnapshot.error}</div>
            ) : null}
            <SettingsCard>
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">Embeddings</div>
                  <div className="text-xs text-text-muted">
                    {portalConfigSnapshot.loading
                      ? "Loading…"
                      : !activeWorkspaceId
                        ? "Select a workspace to view status"
                        : portalConfigSnapshot.embeddingLine ?? "—"}
                  </div>
                </div>
                <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app/config/embeddings")}>
                  Edit in portal
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">Context injection</div>
                  <div className="text-xs text-text-muted">
                    {portalConfigSnapshot.loading
                      ? "Loading…"
                      : !activeWorkspaceId
                        ? "Select a workspace to view status"
                        : portalConfigSnapshot.contextLine ?? "—"}
                  </div>
                </div>
                <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app/config/context")}>
                  Edit in portal
                </Button>
              </div>
            </SettingsCard>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">General</h3>
            <SettingsCard>
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">Prevent sleep while running</div>
                  <div className="text-xs text-text-muted">Keep your computer awake while the agent runs.</div>
                </div>
                <Toggle
                  size="sm"
                  checked={settingsToggles.preventSleep}
                  onChange={(c) => setSettingsToggles((p) => ({ ...p, preventSleep: c }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">Require Cmd+Enter to send</div>
                  <div className="text-xs text-text-muted">Multiline prompts require Cmd+Enter to send.</div>
                </div>
                <Toggle
                  size="sm"
                  checked={settingsToggles.requireCmdEnter}
                  onChange={(c) => setSettingsToggles((p) => ({ ...p, requireCmdEnter: c }))}
                />
              </div>
            </SettingsCard>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">Appearance</h3>
            <SettingsCard>
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">Compact density</div>
                  <div className="text-xs text-text-muted">Reduce padding across the interface.</div>
                </div>
                <Toggle
                  size="sm"
                  checked={settingsToggles.compactDensity}
                  onChange={(c) => setSettingsToggles((p) => ({ ...p, compactDensity: c }))}
                />
              </div>
            </SettingsCard>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">Archived threads</h3>
            <p className="text-xs text-text-muted">
              Threads archived from the sidebar. Open one to continue in the agent view.
            </p>
            <Button size="sm" variant="secondary" onClick={onRefreshArchived} disabled={archivedLoading}>
              {archivedLoading ? "Loading…" : "Refresh list"}
            </Button>
            <div className="space-y-2">
              {archivedThreads.length === 0 && !archivedLoading ? (
                <div className="glass-card px-3 py-4 text-xs text-text-muted text-center rounded-md">No archived threads.</div>
              ) : null}
              {archivedThreads.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 glass-card px-3 py-2 rounded-md">
                  <span className="text-sm truncate min-w-0">{t.title || t.id}</span>
                  <Button size="xs" variant="secondary" onClick={() => onOpenArchivedThread(t.id)}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6">
          <Panel className="p-4">
            <p className="text-xs text-text-secondary">
              Tip: each section is deep-linkable in the browser. Share links like{" "}
              <span className="font-mono">/app/agent-graphs</span> with your team.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
