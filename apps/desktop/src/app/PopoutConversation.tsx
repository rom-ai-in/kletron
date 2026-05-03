import { useEffect, useState, useMemo, useCallback } from "react";
import { MessageList } from "@kletron/ui/components/Agent/MessageList";
import { MessageActions } from "@kletron/ui/components/Agent/MessageActions";
import { useMessageEdit } from "@kletron/ui/hooks/useMessageEdit";
import { ReplayConfirmDialog } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";
import { InputBar } from "@kletron/ui/components/CommandCenter/InputBar";
import { InlineDiffReview } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import { PendingSessionEditsStrip, Selector } from "@kletron/ui/components/design-system";
import { ThreadApprovalModeSelector } from "@kletron/ui/components/Agent/ThreadApprovalModeSelector";
import { useAgentSession } from "@kletron/ui/hooks/useAgentSession";

import { useAuth } from "../hooks/useAuth";
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

  const getAgentRequestHeaders = useCallback(async () => {
    const token = await auth.getAccessToken();
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
    return h;
  }, [auth.getAccessToken, activeWorkspaceId]);

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
    (async () => {
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

      {/* Conversation — scroll area + work-mode strip + composer (matches main desktop agent) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-elegant">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            {conversation.capabilityDroppedTools.length > 0 && (
              <div className="px-2 pt-3">
                <div
                  className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning-text"
                  role="status"
                >
                  Some tools requested by this graph are disabled by workspace capabilities:{" "}
                  <span className="font-mono">{conversation.capabilityDroppedTools.join(", ")}</span>
                </div>
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

        {/* Input Bar */}
        <div className="mx-auto w-full max-w-3xl shrink-0">
          <InputBar
            value={conversation.input}
            onChange={conversation.setInput}
            onSend={() => void conversation.sendMessage()}
            onStop={conversation.stopStreaming}
            sending={conversation.streaming}
            disabled={conversation.streaming || !backendReady || !auth.auth?.accessToken}
            placeholder="Continue the conversation..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void conversation.sendMessage();
              }
            }}
            connected={
              backendConnected
                ? agentSession.llmSelectorLoading
                  ? "checking"
                  : agentSession.llmStatus === "loading"
                    ? "checking"
                    : agentSession.llmStatus === "success"
                : false
            }
            modelSelector={
              <Selector
                label="LLM"
                value={agentSession.llmProvider}
                options={agentSession.llmOptions}
                onSelect={agentSession.handleLlmChange}
                size="sm"
                direction="up"
                loading={agentSession.llmSelectorLoading}
                status={agentSession.llmSelectorLoading ? "none" : agentSession.llmStatus}
                menuAlign="end"
                statusTooltip={agentSession.llmSelectorLoading ? null : agentSession.llmStatusDetail}
              />
            }
            approvalSelector={
              <ThreadApprovalModeSelector
                value={conversation.threadApprovalMode}
                onSelect={conversation.onThreadApprovalSelect}
                disabled={conversation.conversationRunSource === "automation"}
                disabledReason="Approval mode is fixed for automation threads."
              />
            }
          />
        </div>
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
