"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Folder, Link2, MessageSquare, Phone, Send, Settings2, Terminal } from "lucide-react";
import {
  Button,
  Checkbox,
  ConfigExplorerMonoBlock,
  ConfigExplorerSection,
  Input,
  Modal,
  Panel,
  PasswordInput,
} from "@kletron/ui/components/design-system";
import { cn } from "../../lib/utils";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";

type ChannelKey = "telegram" | "slack" | "whatsapp";

const selectControlClass = cn(
  "w-full rounded-md border border-border-subtle bg-bg-surface text-sm text-text-primary",
  "h-10 px-3 shadow-sm transition-colors",
  "hover:border-border-strong",
  "focus:outline-none focus:ring-2 focus:ring-focus-ring/50 focus:border-border-strong",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

const fieldLabelClass = "block text-[11px] font-medium uppercase tracking-wide text-text-muted";
const helpTextClass = "text-xs text-text-secondary leading-relaxed";

const CHANNELS: Array<{
  id: ChannelKey;
  name: string;
  blurb: string;
  icon: typeof Send;
}> = [
  {
    id: "telegram",
    name: "Telegram",
    blurb: "Shared bot token, per-workspace graph, /switch in chat.",
    icon: Send,
  },
  {
    id: "slack",
    name: "Slack",
    blurb: "Events API and workspace routing (same rules as Telegram).",
    icon: MessageSquare,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    blurb: "Meta Cloud API webhooks and verification.",
    icon: Phone,
  },
];

function StatusPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
        ok
          ? "border-status-success-border bg-status-success-bg text-status-success-text"
          : "border-border-subtle bg-bg-app text-text-muted"
      )}
    >
      {children}
    </span>
  );
}

export function ChannelsConfigView() {
  const { workspaces, activeWorkspaceId, loading: wsLoading } = useWorkspace();
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspaceId) setSelectedWsId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const [activeModal, setActiveModal] = useState<ChannelKey | null>(null);

  const webhookBase = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/channels` : ""),
    []
  );

  const [appStatus, setAppStatus] = useState<{
    encryptionConfigured: boolean;
    telegram: { telegramBotConfigured: boolean; telegramWebhookSecretConfigured: boolean };
  } | null>(null);
  const [botToken, setBotToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saveAppMsg, setSaveAppMsg] = useState<string | null>(null);

  const loadAppCreds = useCallback(async () => {
    try {
      const res = await fetch("/api/channels/app-credentials");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.telegram) {
        setAppStatus({
          encryptionConfigured: Boolean(data.encryptionConfigured),
          telegram: data.telegram,
        });
      }
    } catch {
      /* offline, wrong origin, or server down — avoid unhandled rejection in effects */
    }
  }, []);

  useEffect(() => {
    void loadAppCreds().catch(() => undefined);
  }, [loadAppCreds]);

  const saveAppCreds = async () => {
    setSaveAppMsg(null);
    try {
      const res = await fetch("/api/channels/app-credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram: {
            ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
            ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Save failed");
      setSaveAppMsg("Saved.");
      setBotToken("");
      setWebhookSecret("");
      await loadAppCreds();
    } catch (e) {
      setSaveAppMsg((e as Error).message ?? "Error");
    }
  };

  const [wsEnabled, setWsEnabled] = useState(true);
  const [defaultGraphId, setDefaultGraphId] = useState("");
  const [graphs, setGraphs] = useState<Array<{ _id?: string; id?: string; name?: string }>>([]);
  const [wsSaveMsg, setWsSaveMsg] = useState<string | null>(null);

  const loadGraphs = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-graphs");
      const data = await res.json().catch(() => ({}));
      setGraphs(Array.isArray(data?.graphs) ? data.graphs : []);
    } catch {
      setGraphs([]);
    }
  }, []);

  useEffect(() => {
    void loadGraphs().catch(() => undefined);
  }, [loadGraphs]);

  const loadWsSettings = useCallback(async (wsId: string) => {
    if (!wsId) return;
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(wsId)}/channel-settings?channel=telegram`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setWsEnabled(data.enabled !== false);
        setDefaultGraphId(typeof data.defaultGraphId === "string" ? data.defaultGraphId : "");
      }
    } catch {
      /* network error — keep previous workspace form state */
    }
  }, []);

  useEffect(() => {
    if (selectedWsId) void loadWsSettings(selectedWsId).catch(() => undefined);
  }, [selectedWsId, loadWsSettings]);

  const saveWsSettings = async () => {
    if (!selectedWsId) return;
    setWsSaveMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(selectedWsId)}/channel-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "telegram",
          enabled: wsEnabled,
          defaultGraphId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Save failed");
      setWsSaveMsg("Workspace channel settings saved.");
    } catch (e) {
      setWsSaveMsg((e as Error).message ?? "Error");
    }
  };

  const [externalUserId, setExternalUserId] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");

  const linkTelegram = async () => {
    const id = externalUserId.trim();
    if (!id || !selectedWsId) {
      setLinkMsg("Select a workspace and enter your Telegram user id.");
      setLinkStatus("err");
      return;
    }
    setLinkStatus("saving");
    setLinkMsg(null);
    try {
      const res = await fetch("/api/channels/identity-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "telegram", externalUserId: id, workspaceId: selectedWsId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLinkMsg(typeof data?.error === "string" ? data.error : "Link failed");
        setLinkStatus("err");
        return;
      }
      setLinkMsg("Linked. Use /switch in Telegram to choose a workspace for agent messages.");
      setLinkStatus("ok");
    } catch {
      setLinkMsg("Request failed");
      setLinkStatus("err");
    }
  };

  const activeMeta = CHANNELS.find((c) => c.id === activeModal);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((w) => ({
        id: w.id,
        label: w.name || w.id,
      })),
    [workspaces]
  );

  const graphOptions = useMemo(
    () =>
      graphs.map((g) => {
        const id = String(g._id ?? g.id ?? "");
        return { id, label: g.name || id };
      }),
    [graphs]
  );

  const selectedWorkspaceLabel = workspaceOptions.find((w) => w.id === selectedWsId)?.label ?? "—";

  const openModal = (id: ChannelKey) => {
    setActiveModal(id);
    if (id === "telegram") {
      void loadAppCreds().catch(() => undefined);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <Panel className="border border-border-subtle bg-bg-elevated/50 p-5">
        <p className={helpTextClass}>
          Choose a workspace below for status and for settings that depend on the workspace. Open a channel card to configure webhooks, tokens, and linking. Tokens stay on the server; use{" "}
          <code className="rounded border border-border-subtle bg-bg-app px-1 font-mono text-[11px]">/switch</code> in Telegram to change the active workspace per chat.
        </p>
        <p className={cn(helpTextClass, "mt-2 text-text-muted")}>
          Groups: context is per chat — whoever runs <code className="font-mono text-[11px]">/switch</code> sets the workspace for that group until someone changes it.
        </p>
      </Panel>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full min-w-0 space-y-2 sm:max-w-md">
          <label htmlFor="ch-page-workspace" className={fieldLabelClass}>
            Workspace (for status & workspace-scoped settings)
          </label>
          <select
            id="ch-page-workspace"
            className={selectControlClass}
            value={selectedWsId ?? ""}
            onChange={(e) => setSelectedWsId(e.target.value || null)}
            disabled={wsLoading || workspaceOptions.length === 0}
          >
            {workspaceOptions.length === 0 ? (
              <option value="">No workspaces</option>
            ) : (
              workspaceOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <section className="w-full min-w-0" aria-labelledby="ch-channels-heading">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-text-muted" aria-hidden />
          <h2 id="ch-channels-heading" className="text-sm font-semibold text-text-primary">
            Channels
          </h2>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => openModal(ch.id)}
                className="group w-full min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
              >
                <Panel className="h-full border border-border-subtle p-5 transition-colors group-hover:border-border-strong group-hover:bg-bg-elevated/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-primary-main" aria-hidden />
                        <h3 className="text-sm font-semibold text-text-primary">{ch.name}</h3>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{ch.blurb}</p>

                      {ch.id === "telegram" && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <StatusPill ok={Boolean(appStatus?.telegram.telegramBotConfigured)}>
                            App bot {appStatus?.telegram.telegramBotConfigured ? "set" : "missing"}
                          </StatusPill>
                          <StatusPill ok={Boolean(appStatus?.encryptionConfigured)}>
                            {appStatus?.encryptionConfigured ? "Secrets encrypted" : "No encrypt key"}
                          </StatusPill>
                          <StatusPill ok={wsEnabled}>{selectedWorkspaceLabel}: {wsEnabled ? "on" : "off"}</StatusPill>
                        </div>
                      )}

                      {ch.id === "slack" && (
                        <p className="mt-3 text-[11px] text-text-muted">Webhook path: /slack · configure in dialog</p>
                      )}
                      {ch.id === "whatsapp" && (
                        <p className="mt-3 text-[11px] text-text-muted">Callback: /whatsapp · Meta verify token (env)</p>
                      )}

                      <p className="mt-4 text-[11px] font-medium text-primary-main">Open settings →</p>
                    </div>
                    <div className="mt-0.5 shrink-0 text-text-muted transition-colors group-hover:text-text-primary">
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </div>
                  </div>
                </Panel>
              </button>
            );
          })}
        </div>
      </section>

      <Modal
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title="Channel settings"
        subtitle={activeMeta?.name ?? ""}
      >
        {activeModal === "telegram" && (
          <div className="w-full min-w-0 space-y-4">
            <p className={cn(helpTextClass, "px-0")}>
              Workspace <span className="font-medium text-text-primary">{selectedWorkspaceLabel}</span> is used for defaults and identity link below. Change it from the main page selector.
            </p>

            <ConfigExplorerSection title="App-wide Telegram bot" icon={Terminal} iconClassName="text-status-info-text">
              <div className="w-full min-w-0 space-y-4">
                <div className="space-y-2">
                  <span className={fieldLabelClass}>Webhook URL</span>
                  <p className="text-xs text-text-secondary">Set in BotFather / Telegram API.</p>
                  <ConfigExplorerMonoBlock className="w-full break-all text-text-primary">
                    {webhookBase || "…"}/telegram
                  </ConfigExplorerMonoBlock>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span>
                    Encryption:{" "}
                    {appStatus?.encryptionConfigured ? (
                      <span className="text-status-success-text">key configured</span>
                    ) : (
                      <span className="text-status-warning-text">set KLETRON_CHANNEL_SECRETS_KEY on the server</span>
                    )}
                  </span>
                  <span className="hidden sm:inline text-border-subtle">·</span>
                  <span>Bot: {appStatus?.telegram.telegramBotConfigured ? "configured" : "not set"}</span>
                  <span className="hidden sm:inline text-border-subtle">·</span>
                  <span>Webhook secret: {appStatus?.telegram.telegramWebhookSecretConfigured ? "set" : "none"}</span>
                </div>

                <div className="w-full space-y-4 border-t border-border-subtle pt-4">
                  <div className="space-y-2">
                    <label htmlFor="dlg-ch-bot-token" className={fieldLabelClass}>
                      Bot token
                    </label>
                    <p className="text-[11px] text-text-muted">Leave blank to keep the current token.</p>
                    <PasswordInput
                      id="dlg-ch-bot-token"
                      size="md"
                      fullWidth
                      autoComplete="off"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="Enter new token or leave unchanged"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="dlg-ch-webhook-secret" className={fieldLabelClass}>
                      Webhook secret (optional)
                    </label>
                    <p className="text-[11px] text-text-muted">Must match X-Telegram-Bot-Api-Secret-Token.</p>
                    <PasswordInput
                      id="dlg-ch-webhook-secret"
                      size="md"
                      fullWidth
                      autoComplete="off"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder="Optional verification token"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button size="md" variant="primary" type="button" onClick={() => void saveAppCreds()} className="w-full sm:w-auto">
                      Save app credentials
                    </Button>
                  </div>
                  {saveAppMsg && (
                    <p
                      className={cn(
                        "text-sm",
                        saveAppMsg === "Saved." ? "text-status-success-text" : "text-status-error-text"
                      )}
                      role="status"
                    >
                      {saveAppMsg}
                    </p>
                  )}
                </div>
              </div>
            </ConfigExplorerSection>

            <ConfigExplorerSection title="Workspace defaults (Telegram)" icon={Folder} iconClassName="text-status-success-text">
              <div className="w-full min-w-0 space-y-4">
                <p className="text-xs text-text-muted">
                  Applies to <span className="font-medium text-text-secondary">{selectedWorkspaceLabel}</span>. Switch workspace on the main page if needed.
                </p>
                <div className="border-t border-border-subtle pt-2">
                  <Checkbox
                    size="sm"
                    checked={wsEnabled}
                    onChange={setWsEnabled}
                    label="Enable Telegram for this workspace"
                    description="When off, this workspace ignores Telegram routing."
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="dlg-ch-graph" className={fieldLabelClass}>
                    Default agent graph
                  </label>
                  <select
                    id="dlg-ch-graph"
                    className={selectControlClass}
                    value={defaultGraphId}
                    onChange={(e) => setDefaultGraphId(e.target.value)}
                    disabled={!selectedWsId}
                  >
                    <option value="">(first available graph)</option>
                    {graphOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    size="md"
                    variant="primary"
                    type="button"
                    onClick={() => void saveWsSettings()}
                    disabled={!selectedWsId}
                    className="w-full sm:w-auto"
                  >
                    Save workspace channel settings
                  </Button>
                </div>
                {wsSaveMsg && (
                  <p
                    className={cn(
                      "text-sm",
                      wsSaveMsg.includes("saved") ? "text-status-success-text" : "text-status-error-text"
                    )}
                    role="status"
                  >
                    {wsSaveMsg}
                  </p>
                )}
              </div>
            </ConfigExplorerSection>

            <ConfigExplorerSection title="Link your Telegram account" icon={Link2} iconClassName="text-primary-main">
              <div className="w-full min-w-0 space-y-4">
                <p className={helpTextClass}>
                  Links your Kletron user to a Telegram id for workspace <span className="font-medium text-text-primary">{selectedWorkspaceLabel}</span>. Get your numeric id from @userinfobot.
                </p>
                <div className="space-y-2">
                  <label htmlFor="dlg-ch-tg-id" className={fieldLabelClass}>
                    Telegram user id
                  </label>
                  <Input
                    id="dlg-ch-tg-id"
                    size="md"
                    fullWidth
                    value={externalUserId}
                    onChange={(e) => setExternalUserId(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                    disabled={linkStatus === "saving"}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    size="md"
                    variant="secondary"
                    type="button"
                    disabled={linkStatus === "saving" || !selectedWsId}
                    onClick={() => void linkTelegram()}
                    className="w-full sm:w-auto"
                  >
                    {linkStatus === "saving" ? "Saving…" : "Link account"}
                  </Button>
                </div>
                {linkMsg && (
                  <p
                    className={cn(
                      "text-sm",
                      linkStatus === "ok" ? "text-status-success-text" : "text-status-error-text"
                    )}
                    role="status"
                  >
                    {linkMsg}
                  </p>
                )}
              </div>
            </ConfigExplorerSection>
          </div>
        )}

        {activeModal === "slack" && (
          <div className="w-full min-w-0 space-y-6 text-sm text-text-secondary">
            <p className={helpTextClass}>
              Point Slack&apos;s Events API request URL to the path below. Signing secrets and per-workspace toggles will follow the same pattern as Telegram when extended in the API.
            </p>
            <div className="space-y-2">
              <span className={fieldLabelClass}>Events / interactivity URL</span>
              <ConfigExplorerMonoBlock className="w-full break-all text-text-primary">{webhookBase}/slack</ConfigExplorerMonoBlock>
            </div>
            <Panel className="border border-border-subtle bg-bg-elevated/40 p-4">
              <p className="text-xs text-text-muted">
                Routing in the app uses the same workspace resolution as Telegram once your Slack app is verified. Configure OAuth and signing in your Slack app settings; store secrets via server env or future
                workspace channel settings.
              </p>
            </Panel>
          </div>
        )}

        {activeModal === "whatsapp" && (
          <div className="w-full min-w-0 space-y-6 text-sm text-text-secondary">
            <p className={helpTextClass}>
              Meta sends verification and messages to the callback URL. Set the verify token in the environment (<code className="rounded bg-bg-muted px-1 font-mono text-[11px]">CHANNEL_WHATSAPP_VERIFY_TOKEN</code>
              ) to match your Meta app configuration.
            </p>
            <div className="space-y-2">
              <span className={fieldLabelClass}>Callback URL</span>
              <ConfigExplorerMonoBlock className="w-full break-all text-text-primary">{webhookBase}/whatsapp</ConfigExplorerMonoBlock>
            </div>
            <Panel className="border border-border-subtle bg-bg-elevated/40 p-4">
              <p className="text-xs text-text-muted">
                Full WhatsApp routing will align with Telegram once the webhook handler stores workspace context the same way. Until then, use this URL for Meta dashboard setup and token verification.
              </p>
            </Panel>
          </div>
        )}
      </Modal>
    </div>
  );
}
