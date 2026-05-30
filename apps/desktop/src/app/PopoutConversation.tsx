import { useEffect, useState, useMemo, useCallback } from "react";
import { MessageList } from "@kletron/ui/components/Agent/MessageList";
import { ThreadContextRail } from "@kletron/ui/components/Agent/ThreadContextRail";
import { ThreadSkillsRail } from "@kletron/ui/components/Agent/ThreadSkillsRail";
import { MessageActions } from "@kletron/ui/components/Agent/MessageActions";
import { useMessageEdit } from "@kletron/ui/hooks/useMessageEdit";
import { ReplayConfirmDialog } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";
import { InputBar } from "@kletron/ui/components/CommandCenter/InputBar";
import { InlineDiffReview } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import { PendingSessionEditsStrip, Selector } from "@kletron/ui/components/design-system";
import { ThreadApprovalModeSelector } from "@kletron/ui/components/Agent/ThreadApprovalModeSelector";
import { useAgentSession } from "@kletron/ui/hooks/useAgentSession";
import { effectiveLlmStripHealth } from "@kletron/ui/hooks/effectiveLlmStripHealth";
import { AgentSessionEngineStrip } from "@kletron/ui/components/Agent/AgentSessionEngineStrip";
import type { ResearchDepthId } from "@kletron/shared/researchDepth";
import { WorkspaceConnectorsHint } from "@kletron/ui/components/CommandCenter/WorkspaceConnectorsHint";
import { Settings2, GraduationCap, X, AlertTriangle } from "lucide-react";
import {
  CAPABILITY_DROPPED_BANNER_TAIL,
  CAPABILITY_DROPPED_SLIM_CTA_LABEL,
  capabilityDroppedSlimBarTitle,
  formatDroppedToolsListPhrase,
} from "@kletron/shared/capabilityDroppedToolsUx";

import { useAuth } from "../hooks/useAuth";
import { useStableAgentRequestHeaders } from "../hooks/useStableAgentRequestHeaders";
import { useSettings } from "../hooks/useSettings";
import { useWorkspace } from "../hooks/useWorkspace";
import { useConversation } from "../hooks/useConversation";
import { useDiffs } from "../hooks/useDiffs";
import type { LlmConfig } from "../types";

export interface PopoutConversationProps {
  threadId: string;
}

export default function PopoutConversation({ threadId }: PopoutConversationProps) {
  const settingsHook = useSettings();
  const { backendUrlTrimmed, backendUrlValid, backendConnected, setBackendConnected } = settingsHook;

  const auth = useAuth(backendUrlTrimmed, backendUrlValid);
  const backendReady = backendUrlValid && backendConnected;

  const workspace = useWorkspace(backendUrlTrimmed, auth.getAccessToken);
  const activeWorkspaceId = workspace.workspaceSummary?.id ?? null;

  const getAgentRequestHeaders = useStableAgentRequestHeaders(auth.getAccessToken, activeWorkspaceId);

  const openPortalPath = useCallback((path: string) => {
    try {
      const base = backendUrlTrimmed.replace(/\/$/, "");
      void (window as { kletron?: { openExternal?: (u: string) => Promise<boolean> } }).kletron?.openExternal?.(`${base}${path}`);
    } catch {
      /* ignore */
    }
  }, [backendUrlTrimmed]);

  const agentSession = useAgentSession({
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders: getAgentRequestHeaders,
  });

  const diffs = useDiffs(workspace.workspace);

  const modelConfigForStream = useMemo((): LlmConfig | null => {
    if (!agentSession.llmConfigData) return null;
    return {
      ...agentSession.llmConfigData,
      provider: agentSession.llmProvider,
    } as LlmConfig;
  }, [agentSession.llmConfigData, agentSession.llmProvider]);

  const selectedGraphTitle = useMemo(() => {
    const id = agentSession.selectedGraphId;
    const fromApi = agentSession.agentGraphs.find((g) => String(g._id) === id);
    if (fromApi) return fromApi.name;
    return agentSession.graphSelectOptions.find((o) => o.id === id)?.label;
  }, [agentSession.selectedGraphId, agentSession.agentGraphs, agentSession.graphSelectOptions]);

  const [conversationId, setConversationId] = useState<string | null>(threadId);

  const conversation = useConversation(
    backendUrlTrimmed,
    backendReady,
    auth.getAccessToken,
    conversationId,
    setConversationId,
    workspace.workspace,
    modelConfigForStream,
    agentSession.selectedGraphId || null,
    selectedGraphTitle,
    undefined,
    diffs.setDiffs,
    activeWorkspaceId
  );

  const agentLlmStrip = useMemo(
    () =>
      effectiveLlmStripHealth({
        llmStatus: agentSession.llmStatus,
        llmStatusDetail: agentSession.llmStatusDetail,
      }),
    [
      agentSession.llmStatus,
      agentSession.llmStatusDetail,
      conversationId,
    ],
  );

  const capabilityDroppedToolsKey = useMemo(
    () => [...conversation.capabilityDroppedTools].sort().join("\0"),
    [conversation.capabilityDroppedTools],
  );
  const [capabilityToolsBannerDismissed, setCapabilityToolsBannerDismissed] = useState(false);
  useEffect(() => {
    setCapabilityToolsBannerDismissed(false);
  }, [capabilityDroppedToolsKey]);

  const editControl = useMessageEdit({
    sessionId: conversationId,
    events: conversation.conversationEvents,
    streaming: conversation.streaming,
    onTruncateAndResend: conversation.truncateAndResend,
  });

  // Load conversation on mount
  useEffect(() => {
    if (threadId && auth.auth?.accessToken && backendReady) {
      void conversation.loadConversation(threadId);
    }
  }, [threadId, auth.auth?.accessToken, backendReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Probe backend
  useEffect(() => {
    if (!backendUrlValid) {
      setBackendConnected(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
          headers: auth.auth?.accessToken ? { Authorization: `Bearer ${auth.auth.accessToken}` } : undefined,
        });
        setBackendConnected(res.status > 0);
      } catch {
        setBackendConnected(false);
      }
    })();
  }, [backendUrlTrimmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const inlineDiffs: InlineDiff[] = diffs.diffs.map((d) => ({
    editId: d.editId,
    filePath: d.filePath,
    hunks: d.hunks,
  }));

  const isCodeMode = conversation.threadWorkMode === "code";

  return (
    <div className="flex h-screen flex-col text-text-primary">
      {/* Title Bar */}
      <header className="flex h-10 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
        <span className="text-xs font-medium text-text-secondary truncate">
          Pop-out Thread
        </span>
      </header>

      {/* Conversation — scroll area + work-mode strip + composer; skills rail on the right like main window */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-elegant">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            {conversation.capabilityDroppedTools.length > 0 &&
              !(conversation.conversationLoading && conversationId) &&
              !capabilityToolsBannerDismissed && (
              <div className="px-2 pt-3">
                <div
                  className="flex flex-col gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning-text sm:flex-row sm:items-start sm:gap-3"
                  role="status"
                >
                  <p className="min-w-0 flex-1 leading-snug">
                    This graph can use{" "}
                    <span className="font-medium text-status-warning-text">
                      {formatDroppedToolsListPhrase(conversation.capabilityDroppedTools)}
                    </span>
                    {CAPABILITY_DROPPED_BANNER_TAIL}
                  </p>
                  <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1 sm:flex-col sm:items-end sm:justify-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-status-warning-text underline-offset-2 hover:underline"
                      onClick={() =>
                        openPortalPath("/app/config/connectors")
                      }
                    >
                      <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Connectors
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-status-warning-text underline-offset-2 hover:underline"
                      onClick={() =>
                        openPortalPath("/app/skills")
                      }
                    >
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Skills
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-status-warning-text hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Dismiss"
                      onClick={() => setCapabilityToolsBannerDismissed(true)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {conversation.capabilityDroppedTools.length > 0 &&
              !(conversation.conversationLoading && conversationId) &&
              capabilityToolsBannerDismissed && (
              <div className="px-2 pt-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-1.5 text-[10px] font-medium text-status-warning-text hover:opacity-90"
                  title={capabilityDroppedSlimBarTitle(conversation.capabilityDroppedTools)}
                  onClick={() => setCapabilityToolsBannerDismissed(false)}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {CAPABILITY_DROPPED_SLIM_CTA_LABEL}
                </button>
              </div>
            )}
            <MessageList
              events={conversation.renderItems.flatMap(i => i.type === 'event' ? [i.event] : i.events)}
              streaming={conversation.streaming}
              streamingText={conversation.streamingText}
              streamingReasoning={conversation.streamingReasoning}
              activityEvents={conversation.conversationEvents}
              pendingApprovalCount={conversation.sessionEdits.pendingEdits.length}
              className="flex-1 min-h-0 p-0 px-2 py-4"
              messageActions={(event) => (
                <MessageActions
                  event={event}
                  onStartEdit={() => editControl.startEditMessage(event.messageIndex!, event.content ?? "")}
                />
              )}
              editingMessageIndex={editControl.editingMessageIndex}
              editingMessageDraft={editControl.editingMessageDraft}
              editingMessageSaving={editControl.editingMessageSaving}
              editingMessageError={editControl.editingMessageError}
              onEditDraftChange={(draft) => editControl.setEditingMessageDraft(draft)}
              onCancelEdit={editControl.cancelEditMessage}
              onResendEdit={editControl.handleResendEdit}
            />
            {isCodeMode && inlineDiffs.length > 0 && (
              <InlineDiffReview
                diffs={inlineDiffs}
                onAccept={(editId) => {
                  void (async () => {
                    await conversation.sessionEdits.approveEdit(editId);
                    await diffs.applyAllDiff(editId);
                  })();
                }}
                onReject={(editId) => {
                  void conversation.sessionEdits.rejectEdit(editId);
                  diffs.rejectAllDiff(editId);
                }}
                onOpenInIDE={(filePath) => {
                  try { (window as any).kletron?.openInVSCode?.(filePath); } catch { /* ignore */ }
                }}
              />
            )}
            {conversation.sendError && (
              <div className="mx-2 my-2 rounded border border-status-error-border bg-status-error-bg px-3 py-2 text-[12px] text-status-error-text">
                {conversation.sendError}
              </div>
            )}
          </div>
        </div>

        {!isCodeMode && (
          <PendingSessionEditsStrip
            pendingEdits={conversation.sessionEdits.pendingEdits}
            flushNotice={conversation.sessionEdits.flushNotice}
            dismissFlushNotice={conversation.sessionEdits.dismissFlushNotice}
            processingOp={conversation.sessionEdits.processingOp}
            approvingAll={conversation.sessionEdits.approvingAll}
            rejectingAll={conversation.sessionEdits.rejectingAll}
            approveEdit={async (editId, toolName) => {
              await conversation.sessionEdits.approveEdit(editId, toolName);
              await diffs.applyAllDiff(editId);
            }}
            approveEditForSession={async (editId, toolName) => {
              await conversation.sessionEdits.approveEditForSession(editId, toolName);
            }}
            rejectEdit={(editId, toolName) => {
              void conversation.sessionEdits.rejectEdit(editId, toolName);
              diffs.rejectAllDiff(editId);
            }}
            approveAll={async () => {
              await conversation.sessionEdits.approveAll();
              diffs.resetDiffs();
            }}
            rejectAll={async () => {
              await conversation.sessionEdits.rejectAll();
              diffs.resetDiffs();
            }}
          />
        )}

        {/* Input Bar + connectors (web parity: outer px-4, inner max-w-3xl) */}
        <div className="flex flex-none flex-col shrink-0 px-4 pb-3 pt-1">
          <div className="relative mx-auto w-full max-w-3xl">
            <InputBar
            className="px-0 pb-0 pt-0"
            value={conversation.input}
            onChange={conversation.setInput}
            onSend={() => void conversation.sendMessage()}
            onStop={conversation.stopStreaming}
            sending={conversation.streaming}
            disabled={conversation.streaming || !backendReady || !auth.auth?.accessToken}
            placeholder={
              conversation.streaming
                ? "Add a follow-up (queued until agent finishes). Press / for slash commands (skills, plan, workspace)."
                : "Write your message… Press / for slash commands (skills, plan, workspace)."
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void conversation.sendMessage();
              }
            }}
            sessionStripOverride={
              <AgentSessionEngineStrip
                primaryControls={
                  <>
                    <Selector
                      label="GRAPH"
                      value={agentSession.selectedGraphId}
                      options={agentSession.graphSelectOptions}
                      onSelect={agentSession.handleGraphChange}
                      size="sm"
                      direction="up"
                      loading={agentSession.graphSelectorLoading}
                    />
                    <Selector
                      label={agentLlmStrip.selectorLabel}
                      value={agentSession.llmProvider}
                      options={agentSession.llmOptions}
                      onSelect={agentSession.handleLlmChange}
                      size="sm"
                      direction="up"
                      loading={agentSession.llmSelectorLoading}
                      status={agentSession.llmSelectorLoading ? "none" : agentLlmStrip.status}
                      menuAlign="end"
                      statusTooltip={agentSession.llmSelectorLoading ? null : agentLlmStrip.detail}
                    />
                    {agentSession.llmProvider === "codex" &&
                    (agentSession.codexModelsLoading || agentSession.codexModelOptions.length > 0) ? (
                      <Selector
                        label="Model"
                        value={
                          agentSession.selectedCodexModel &&
                          agentSession.codexModelOptions.some((o) => o.id === agentSession.selectedCodexModel)
                            ? agentSession.selectedCodexModel
                            : (agentSession.codexModelOptions[0]?.id ?? "")
                        }
                        options={agentSession.codexModelOptions}
                        onSelect={(id) => {
                          agentSession.handleCodexModelChange(id);
                          conversation.applyCodexModelSelection(id);
                        }}
                        size="sm"
                        direction="up"
                        loading={agentSession.codexModelsLoading}
                        status="none"
                      />
                    ) : null}
                  </>
                }
                trailingControls={
                  <>
                    <ThreadApprovalModeSelector
                      value={conversation.threadApprovalMode}
                      onSelect={conversation.onThreadApprovalSelect}
                      disabled={conversation.conversationRunSource === "automation"}
                      disabledReason="Tool policy mode is fixed for automation threads."
                    />
                    <label className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      <span className="shrink-0">Depth</span>
                      <select
                        value={conversation.researchDepth}
                        onChange={(e) =>
                          conversation.setResearchDepth(e.target.value as ResearchDepthId)
                        }
                        disabled={!!conversationId}
                        title={
                          conversationId
                            ? "Research depth is fixed for this thread (set when the session was created)."
                            : "Exhaustive: more tools and context. Fast: fewer steps and shorter replies."
                        }
                        className="max-w-[120px] rounded border border-white/[0.12] bg-bg-elevated py-0.5 pl-1.5 pr-6 text-[10px] font-normal normal-case text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="exhaustive">Exhaustive</option>
                        <option value="fast">Fast</option>
                      </select>
                    </label>
                  </>
                }
              />
            }
            />
          </div>
          <WorkspaceConnectorsHint
            apiOrigin={backendUrlTrimmed}
            workspaceId={activeWorkspaceId}
            getRequestHeaders={getAgentRequestHeaders}
            onOpenConnectors={() => openPortalPath("/app/config/connectors")}
            className="mt-2"
          />
        </div>
        </div>
        {conversationId ? (
          <div className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-y-auto scrollbar-elegant border-l border-white/[0.06] bg-bg-surface">
            <ThreadSkillsRail
              skills={conversation.threadSkills}
              layout="inline"
              openSkillsControl={
                <button
                  type="button"
                  className="ml-auto text-[10px] font-medium text-status-info-text hover:underline"
                  onClick={() => openPortalPath("/app/skills")}
                >
                  Open
                </button>
              }
            />
            <ThreadContextRail footprint={conversation.threadContextFootprint} layout="inline" />
          </div>
        ) : null}
      </div>
      {/* Replay Confirmation Dialog */}
      <ReplayConfirmDialog
        open={editControl.replayDialogOpen}
        impact={editControl.replayImpact}
        onConfirm={() => void editControl.executeReplay()}
        onCancel={editControl.cancelReplay}
        loading={editControl.editingMessageSaving}
      />
    </div>
  );
}
