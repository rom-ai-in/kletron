import type { Dispatch, SetStateAction } from "react";
import { Brain } from "lucide-react";
import {
  Button,
  Toggle,
  LLMSelector,
  EnvironmentConfig,
} from "@kletron/ui/components/design-system";
import type { LLMProvider } from "@kletron/ui/components/design-system";
import type { Skill } from "@kletron/ui/components/CommandCenter/SkillsManager";
import { SkillsManager } from "@kletron/ui/components/CommandCenter/SkillsManager";
import { AutomationsDashboard } from "@kletron/ui/components/CommandCenter/AutomationsDashboard";
import type { Automation } from "@kletron/ui/components/CommandCenter/AutomationsDashboard";
import {
  DesktopPortalStatusLinesSkeleton,
  DesktopSettingsGraphRowsSkeleton,
} from "../components/DesktopLoadingSkeletons";
import { DesktopPrimaryNav } from "./DesktopPrimaryNav";
import { AccountView } from "./AccountView";
import { PORTAL_LINK_GROUPS } from "../portalLinks";
import { SETTINGS_SECTIONS, formatRelativeTime } from "../utils";
import { SettingsCard, DeviceOnlyPortalBanner } from "../components/SettingsCard";
import type { ActiveView, SettingsSectionId, SettingsToggles, EnvVariable, AgentGraphSummary } from "../types";

type SkillsHookBindings = {
  skills: Skill[];
  addSkill: (name: string) => void;
  removeSkill: (skillId: string) => void;
  toggleSkill: (skillId: string, enabled: boolean) => void;
};

type AutomationsHookLike = {
  automations: Automation[];
  loading: boolean;
  error: string | null;
  remove: (id: string) => Promise<void>;
  runNow: (id: string) => Promise<string | undefined>;
};

type Props = {
  activeSettingsSection: SettingsSectionId;
  setActiveSettingsSection: (id: SettingsSectionId) => void;
  setActiveView: (v: ActiveView) => void;
  openPortalPath: (path: string) => void;
  backendUrl: string;
  setBackendUrl: (v: string) => void;
  backendConnected: boolean;
  backendUrlValid: boolean;
  userEmail?: string | null;
  userFullName?: string | null;
  hasAccessToken: boolean;
  loginPending: boolean;
  loginError: string | null;
  onSignOut: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  settingsToggles: SettingsToggles;
  setSettingsToggles: Dispatch<SetStateAction<SettingsToggles>>;
  providers: LLMProvider[];
  selectedProvider: string | null;
  selectedModel: string | null;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  portalConfigSnapshot: {
    loading: boolean;
    error: string | null;
    embeddingLine?: string | null;
    contextLine?: string | null;
  };
  activeWorkspaceId: string | null;
  skillsHook: SkillsHookBindings;
  automationsHook: AutomationsHookLike;
  automationsWorkspaceBanner: { label?: string; root?: string };
  onAutomationRan: (threadId: string, automationName?: string) => void;
  onOpenAutomationThread: (sessionId: string) => void;
  graphsForPanel: AgentGraphSummary[];
  agentGraphsLoading: boolean;
  agentSession: {
    selectedGraphId: string | null;
    handleGraphChange: (id: string) => void;
    refreshGraphs: () => void | Promise<void>;
  };
  envVariables: EnvVariable[];
  setEnvVariables: Dispatch<SetStateAction<EnvVariable[]>>;
};

export function DesktopSettingsView({
  activeSettingsSection,
  setActiveSettingsSection,
  setActiveView,
  openPortalPath,
  backendUrl,
  setBackendUrl,
  backendConnected,
  backendUrlValid,
  userEmail,
  userFullName,
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
  portalConfigSnapshot,
  activeWorkspaceId,
  skillsHook,
  automationsHook,
  automationsWorkspaceBanner,
  onAutomationRan,
  onOpenAutomationThread,
  graphsForPanel,
  agentGraphsLoading,
  agentSession,
  envVariables,
  setEnvVariables,
}: Props) {
  return (
    <div className="flex h-screen flex-col text-text-primary min-h-0">
      <header className="flex h-10 shrink-0 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
        <span className="text-xs font-medium text-text-secondary">Settings</span>
      </header>
      <DesktopPrimaryNav activeView="settings" onSelect={(v) => setActiveView(v)} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="flex w-60 flex-col glass-sidebar px-2 py-3 shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Sections</div>
          <div className="mt-2 flex flex-col gap-1 overflow-y-auto scrollbar-elegant">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSettingsSection(section.id)}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  activeSettingsSection === section.id
                    ? "bg-state-selected text-text-primary"
                    : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto px-6 py-4 scrollbar-elegant">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {activeSettingsSection === "configuration" && (
              <>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
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
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-text-primary">Web portal</div>
                        <div className="text-xs text-text-muted">Organization, billing, and full workspace settings in the browser.</div>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app")}>
                        Open in browser
                      </Button>
                    </div>
                  </SettingsCard>
                </section>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Models</h2>
                  <LLMSelector
                    providers={providers}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onProviderChange={onProviderChange}
                    onModelChange={onModelChange}
                  />
                </section>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-text-primary">Embeddings &amp; context</h2>
                  <p className="text-xs text-text-muted">
                    Read-only snapshot from your workspace. Edit vectors, injection, and related options in the web app.
                  </p>
                  {portalConfigSnapshot.error ? (
                    <div className="text-xs text-status-error-text">{portalConfigSnapshot.error}</div>
                  ) : null}
                  <SettingsCard>
                    <div className="flex items-center justify-between gap-4 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-text-primary">Embeddings</div>
                        <div className="text-xs text-text-muted">
                          {!activeWorkspaceId
                            ? "Select a workspace to view status"
                            : portalConfigSnapshot.loading
                              ? <DesktopPortalStatusLinesSkeleton />
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
                          {!activeWorkspaceId
                            ? "Select a workspace to view status"
                            : portalConfigSnapshot.loading
                              ? <DesktopPortalStatusLinesSkeleton />
                              : portalConfigSnapshot.contextLine ?? "—"}
                        </div>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => openPortalPath("/app/config/context")}>
                        Edit in portal
                      </Button>
                    </div>
                  </SettingsCard>
                </section>
              </>
            )}
            {activeSettingsSection === "portal" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Web portal</h2>
                  <p className="text-xs text-text-muted">
                    Organization, billing, account, and full workspace configuration open in your browser at the same host as your
                    backend URL.
                  </p>
                </div>
                {PORTAL_LINK_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{group.title}</h3>
                    <SettingsCard>
                      {group.items.map((item) => (
                        <div key={item.path} className="flex items-center justify-between gap-4 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-text-primary">{item.label}</div>
                            {item.description ? <div className="text-xs text-text-muted">{item.description}</div> : null}
                          </div>
                          <Button size="xs" variant="ghost" onClick={() => openPortalPath(item.path)}>
                            Open in browser
                          </Button>
                        </div>
                      ))}
                    </SettingsCard>
                  </div>
                ))}
              </section>
            )}
            {activeSettingsSection === "general" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">General</h2>
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
            )}
            {activeSettingsSection === "personalization" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Appearance</h2>
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
            )}
            {activeSettingsSection === "connectors" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Connectors</h2>
                <DeviceOnlyPortalBanner portalPath="/app/config/connectors" onOpenPortal={openPortalPath} />
                <p className="text-xs text-text-muted">
                  OAuth and MCP integrations for your workspace are managed in the web app.
                </p>
              </section>
            )}
            {activeSettingsSection === "account" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Account</h2>
                <AccountView
                  embedded
                  email={userEmail}
                  fullName={userFullName}
                  openPortalPath={openPortalPath}
                  onSignOut={onSignOut}
                  hasSession={hasAccessToken}
                />
              </section>
            )}
            {activeSettingsSection === "skills" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Skills</h2>
                <p className="text-xs text-text-muted">
                  Skills extend the agent&apos;s capabilities by connecting to external tools and platforms.
                </p>
                <SkillsManager
                  skills={skillsHook.skills}
                  onAdd={skillsHook.addSkill}
                  onRemove={skillsHook.removeSkill}
                  onToggle={skillsHook.toggleSkill}
                />
              </section>
            )}
            {activeSettingsSection === "automations" && (
              <section className="space-y-3">
                <p className="text-xs text-text-muted">
                  Manage automations in the dedicated view for full create/edit, or browse the list below.
                </p>
                <Button size="sm" variant="secondary" onClick={() => setActiveView("automations")}>
                  Open automations
                </Button>
                {automationsHook.error ? (
                  <div className="text-xs text-status-error-text">{automationsHook.error}</div>
                ) : null}
                <AutomationsDashboard
                  automations={automationsHook.automations}
                  loading={automationsHook.loading}
                  workspaceLabel={automationsWorkspaceBanner.label}
                  workspaceRootHint={automationsWorkspaceBanner.root}
                  onRemove={(id) => void automationsHook.remove(id)}
                  onRunNow={async (id) => {
                    const tid = await automationsHook.runNow(id);
                    if (tid) {
                      const auto = automationsHook.automations.find((a) => a.id === id);
                      onAutomationRan(tid, auto?.name);
                    }
                  }}
                  onOpenInBrowser={(id) => openPortalPath(`/app/automations/${encodeURIComponent(id)}`)}
                  onOpenThread={onOpenAutomationThread}
                />
              </section>
            )}
            {activeSettingsSection === "graphs" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Agent Graphs</h2>
                <DeviceOnlyPortalBanner portalPath="/app/agent-graphs" onOpenPortal={openPortalPath} />
                <p className="text-xs text-text-muted">
                  Agent graphs define different workflows for the AI. Select a graph when starting a conversation to guide the
                  agent&apos;s behavior.
                </p>
                {agentGraphsLoading ? (
                  <DesktopSettingsGraphRowsSkeleton count={4} />
                ) : (
                  <>
                {graphsForPanel.length === 0 ? (
                  <div className="glass-card rounded-md px-3 py-4 text-xs text-text-muted text-center">
                    No agent graphs available. Configure them in the web portal.
                  </div>
                ) : null}
                <div className="space-y-2">
                  {graphsForPanel.map((graph) => (
                    <div
                      key={graph.id}
                      className={`rounded-md px-3 py-2.5 transition-colors cursor-pointer ${
                        agentSession.selectedGraphId === graph.id ? "glass-selected" : "glass-card"
                      }`}
                      onClick={() => agentSession.handleGraphChange(graph.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-text-muted" />
                          <span className="text-sm font-medium text-text-primary">{graph.name}</span>
                        </div>
                        {agentSession.selectedGraphId === graph.id ? (
                          <span className="text-[10px] text-status-success-text font-medium">Active</span>
                        ) : null}
                      </div>
                      {graph.description ? <p className="mt-1 text-xs text-text-muted pl-6">{graph.description}</p> : null}
                      {graph.updatedAt ? (
                        <p className="mt-0.5 text-[10px] text-text-muted pl-6">Updated {formatRelativeTime(graph.updatedAt)}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                  </>
                )}
                <Button size="sm" variant="secondary" onClick={() => void agentSession.refreshGraphs()} disabled={agentGraphsLoading}>
                  Reload Graphs
                </Button>
              </section>
            )}
            {activeSettingsSection === "environments" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Environment Variables</h2>
                <DeviceOnlyPortalBanner portalPath="/app/config/workspace" onOpenPortal={openPortalPath} />
                <EnvironmentConfig
                  variables={envVariables}
                  onAdd={(v) => setEnvVariables((p) => [...p, v])}
                  onRemove={(key) => setEnvVariables((p) => p.filter((x) => x.key !== key))}
                  onEdit={(key, value) => setEnvVariables((p) => p.map((x) => (x.key === key ? { ...x, value } : x)))}
                />
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
