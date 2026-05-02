"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Folder, Link2, MessageSquare, Phone, Send, Terminal } from "lucide-react";
import {
  Button,
  Card,
  ConfigExplorerMonoBlock,
  ConfigExplorerSection,
  Input,
  Modal,
  Panel,
} from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";

type ChannelKey = "telegram" | "slack" | "whatsapp";

const CHANNELS: Array<{
  id: ChannelKey;
  name: string;
  blurb: string;
  meta: string;
  icon: typeof Send;
}> = [
  {
    id: "telegram",
    name: "Telegram",
    blurb: "Bot token, webhook, default graph per workspace.",
    meta: "Configure below + link your user id",
    icon: Send,
  },
  {
    id: "slack",
    name: "Slack",
    blurb: "Events API URL verification is live; routing uses the same workspace rules as Telegram.",
    meta: "See modal for URL",
    icon: MessageSquare,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    blurb: "Meta webhook verification; full routing aligns with Telegram when enabled.",
    meta: "See modal for URL",
    icon: Phone,
  },
];

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

  // App-wide Telegram credentials
  const [appStatus, setAppStatus] = useState<{
    encryptionConfigured: boolean;
    telegram: { telegramBotConfigured: boolean; telegramWebhookSecretConfigured: boolean };
  } | null>(null);
  const [botToken, setBotToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saveAppMsg, setSaveAppMsg] = useState<string | null>(null);

  const loadAppCreds = useCallback(async () => {
    const res = await fetch("/api/channels/app-credentials");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.telegram) {
      setAppStatus({
        encryptionConfigured: Boolean(data.encryptionConfigured),
        telegram: data.telegram,
      });
    }
  }, []);

  useEffect(() => {
    void loadAppCreds();
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

  // Per-workspace Telegram settings
  const [wsEnabled, setWsEnabled] = useState(true);
  const [defaultGraphId, setDefaultGraphId] = useState("");
  const [graphs, setGraphs] = useState<Array<{ _id?: string; id?: string; name?: string }>>([]);
  const [wsSaveMsg, setWsSaveMsg] = useState<string | null>(null);

  const loadGraphs = useCallback(async () => {
    const res = await fetch("/api/agent-graphs");
    const data = await res.json().catch(() => ({}));
    setGraphs(Array.isArray(data?.graphs) ? data.graphs : []);
  }, []);

  useEffect(() => {
    void loadGraphs();
  }, [loadGraphs]);

  const loadWsSettings = useCallback(async (wsId: string) => {
    if (!wsId) return;
    const res = await fetch(`/api/workspaces/${encodeURIComponent(wsId)}/channel-settings?channel=telegram`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setWsEnabled(data.enabled !== false);
      setDefaultGraphId(typeof data.defaultGraphId === "string" ? data.defaultGraphId : "");
    }
  }, []);

  useEffect(() => {
    if (selectedWsId) void loadWsSettings(selectedWsId);
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

  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          Set the shared Telegram bot token here (stored encrypted when <code className="font-mono text-[11px]">KLETRON_CHANNEL_SECRETS_KEY</code> is set). Then, for each workspace, choose the default agent graph and whether Telegram is enabled. In Telegram, use{" "}
          <code className="font-mono text-[11px]">/switch</code> to change the active workspace for that chat.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Groups: workspace context is per chat — whoever runs <code className="font-mono text-[11px]">/switch</code> sets the bot&apos;s workspace for that group until someone changes it.
        </p>
      </Panel>

      <ConfigExplorerSection title="App-wide Telegram bot" icon={Terminal} iconClassName="text-status-info-text">
        <p className="text-xs">
          Webhook URL (set in BotFather / Telegram API):{" "}
          <ConfigExplorerMonoBlock className="mt-1 break-all text-text-primary">
            {webhookBase || "…"}/telegram
          </ConfigExplorerMonoBlock>
        </p>
        <p className="text-xs text-text-muted mt-2">
          Encryption:{" "}
          {appStatus?.encryptionConfigured ? (
            <span className="text-status-success-text">KLETRON_CHANNEL_SECRETS_KEY is set</span>
          ) : (
            <span className="text-status-warning-text">Set KLETRON_CHANNEL_SECRETS_KEY on the server to encrypt tokens.</span>
          )}
          {" · "}
          Bot configured: {appStatus?.telegram.telegramBotConfigured ? "yes" : "no"} · Webhook secret:{" "}
          {appStatus?.telegram.telegramWebhookSecretConfigured ? "yes" : "no"}
        </p>
        <div className="mt-3 space-y-2 max-w-md">
          <label className="text-[11px] text-text-muted">Bot token (leave blank to keep current)</label>
          <Input
            size="sm"
            fullWidth
            type="password"
            autoComplete="off"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="••••••••"
          />
          <label className="text-[11px] text-text-muted">Webhook secret (optional)</label>
          <Input
            size="sm"
            fullWidth
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Matches X-Telegram-Bot-Api-Secret-Token"
          />
          <Button size="sm" variant="secondary" onClick={() => void saveAppCreds()}>
            Save app credentials
          </Button>
          {saveAppMsg && (
            <p className={`text-xs ${saveAppMsg === "Saved." ? "text-status-success-text" : "text-status-error-text"}`}>
              {saveAppMsg}
            </p>
          )}
        </div>
      </ConfigExplorerSection>

      <ConfigExplorerSection title="Workspace defaults" icon={Folder} iconClassName="text-status-success-text">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Workspace</label>
            <select
              className="w-full max-w-md rounded-md border border-border-subtle bg-bg-base px-2 py-2 text-sm text-text-primary"
              value={selectedWsId ?? ""}
              onChange={(e) => setSelectedWsId(e.target.value || null)}
              disabled={wsLoading}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={wsEnabled}
              onChange={(e) => setWsEnabled(e.target.checked)}
              className="rounded border-border-subtle"
            />
            Enable Telegram for this workspace
          </label>
          <div>
            <label className="text-[11px] text-text-muted block mb-1">Default agent graph</label>
            <select
              className="w-full max-w-md rounded-md border border-border-subtle bg-bg-base px-2 py-2 text-sm text-text-primary"
              value={defaultGraphId}
              onChange={(e) => setDefaultGraphId(e.target.value)}
            >
              <option value="">(first available graph)</option>
              {graphs.map((g) => {
                const id = String(g._id ?? g.id ?? "");
                return (
                  <option key={id} value={id}>
                    {g.name || id}
                  </option>
                );
              })}
            </select>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void saveWsSettings()} disabled={!selectedWsId}>
            Save workspace channel settings
          </Button>
          {wsSaveMsg && (
            <p className={`text-xs ${wsSaveMsg.includes("saved") ? "text-status-success-text" : "text-status-error-text"}`}>
              {wsSaveMsg}
            </p>
          )}
        </div>
      </ConfigExplorerSection>

      <ConfigExplorerSection title="Link your Telegram account" icon={Link2} iconClassName="text-primary-main">
        <p className="text-xs text-text-secondary mb-2">
          Uses the selected workspace above for the link record. Get your numeric id from @userinfobot.
        </p>
        <div className="flex flex-wrap items-end gap-2 max-w-md">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] text-text-muted block mb-1">Telegram user id</label>
            <Input
              size="sm"
              fullWidth
              value={externalUserId}
              onChange={(e) => setExternalUserId(e.target.value)}
              placeholder="123456789"
              inputMode="numeric"
              disabled={linkStatus === "saving"}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={linkStatus === "saving" || !selectedWsId}
            onClick={() => void linkTelegram()}
          >
            {linkStatus === "saving" ? "Saving…" : "Link"}
          </Button>
        </div>
        {linkMsg && (
          <p
            className={`text-xs mt-2 ${linkStatus === "ok" ? "text-status-success-text" : "text-status-error-text"}`}
          >
            {linkMsg}
          </p>
        )}
      </ConfigExplorerSection>

      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Channel reference</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveModal(ch.id)}
                className="group text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
              >
                <Panel className="h-full p-4 transition-colors group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-primary-main" aria-hidden />
                        <h3 className="text-sm font-semibold text-text-primary">{ch.name}</h3>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{ch.blurb}</p>
                      <p className="mt-3 text-[11px] text-text-muted">{ch.meta}</p>
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
      </div>

      <Modal
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title="Messenger channel"
        subtitle={activeMeta?.name ?? "Details"}
      >
        {activeModal === "telegram" && (
          <div className="space-y-4 text-sm text-text-secondary">
            <p>
              Configuration is done in the sections above (app bot token, per-workspace graph, link). Webhook:{" "}
              <code className="break-all rounded bg-bg-muted px-1 font-mono text-[11px] text-text-primary">
                {webhookBase}/telegram
              </code>
            </p>
          </div>
        )}
        {activeModal === "slack" && (
          <div className="space-y-4 text-sm text-text-secondary">
            <p>Events API URL:</p>
            <ConfigExplorerMonoBlock className="break-all text-text-primary">{webhookBase}/slack</ConfigExplorerMonoBlock>
            <p className="text-xs text-text-muted">Slack signing secret can be stored in workspace channel settings when that UI is extended.</p>
          </div>
        )}
        {activeModal === "whatsapp" && (
          <div className="space-y-4 text-sm text-text-secondary">
            <p>Set CHANNEL_WHATSAPP_VERIFY_TOKEN for Meta verification. Callback:</p>
            <ConfigExplorerMonoBlock className="break-all text-text-primary">{webhookBase}/whatsapp</ConfigExplorerMonoBlock>
          </div>
        )}
      </Modal>
    </div>
  );
}
