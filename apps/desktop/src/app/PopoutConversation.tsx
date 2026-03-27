import { useEffect, useState } from "react";
import { MessageList } from "@kletron/ui/components/Agent/MessageList";
import { MessageActions } from "@kletron/ui/components/Agent/MessageActions";
import { useMessageEdit } from "@kletron/ui/hooks/useMessageEdit";
import { ReplayConfirmDialog } from "@kletron/ui/components/CommandCenter/ReplayConfirmDialog";
import { InputBar } from "@kletron/ui/components/CommandCenter/InputBar";
import { InlineDiffReview } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@kletron/ui/components/CommandCenter/InlineDiffReview";
import { LLMSelector } from "@kletron/ui/components/design-system";

import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useWorkspace } from "../hooks/useWorkspace";
import { useConversation } from "../hooks/useConversation";
import { useDiffs } from "../hooks/useDiffs";
import { useModels } from "../hooks/useModels";


export interface PopoutConversationProps {
  threadId: string;
}

export default function PopoutConversation({ threadId }: PopoutConversationProps) {
  const settingsHook = useSettings();
  const { backendUrlTrimmed, backendUrlValid, backendConnected, setBackendConnected } = settingsHook;

  const auth = useAuth(backendUrlTrimmed, backendUrlValid);
  const backendReady = backendUrlValid && backendConnected;

  const workspace = useWorkspace(backendUrlTrimmed, auth.getAccessToken);
  const models = useModels(backendUrlTrimmed, backendReady, auth.getAccessToken);
  const diffs = useDiffs(workspace.workspace);


  const [conversationId, setConversationId] = useState<string | null>(threadId);

  const conversation = useConversation(
    backendUrlTrimmed,
    backendReady,
    auth.getAccessToken,
    conversationId,
    setConversationId,
    workspace.workspace,
    models.modelConfig,
    models.selectedGraph,
    models.selectedGraphName,
    undefined,
    diffs.setDiffs
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
    if (!backendUrlValid) { setBackendConnected(false); return; }
    (async () => {
      try {
        const res = await fetch(`${backendUrlTrimmed}/api/auth/me`, {
          headers: auth.auth?.accessToken ? { Authorization: `Bearer ${auth.auth.accessToken}` } : undefined,
        });
        setBackendConnected(res.status > 0);
      } catch { setBackendConnected(false); }
    })();
  }, [backendUrlTrimmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const inlineDiffs: InlineDiff[] = diffs.diffs.map((d) => ({
    editId: d.editId,
    filePath: d.filePath,
    hunks: d.hunks,
  }));

  return (
    <div className="flex h-screen flex-col text-text-primary">
      {/* Title Bar */}
      <header className="flex h-10 items-center glass-titlebar px-4 pl-[76px] app-region-drag">
        <span className="text-xs font-medium text-text-secondary truncate">
          Pop-out Thread
        </span>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant flex flex-col">
        <MessageList
          events={conversation.renderItems.flatMap(i => i.type === 'event' ? [i.event] : i.events)}
          streaming={conversation.streaming}
          streamingText={conversation.streamingText}
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
        {inlineDiffs.length > 0 && (
          <InlineDiffReview
            diffs={inlineDiffs}
            onAccept={(editId) => diffs.applyAllDiff(editId)}
            onReject={(editId) => diffs.rejectAllDiff(editId)}
            onOpenInIDE={(filePath) => {
              try { (window as any).kletron?.openInVSCode?.(filePath); } catch { /* ignore */ }
            }}
          />
        )}
        {conversation.sendError && (
          <div className="mx-4 my-2 rounded border border-status-error-border bg-status-error-bg px-3 py-2 text-[12px] text-status-error-text">
            {conversation.sendError}
          </div>
        )}
      </div>

      {/* Input Bar */}
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
        connected={backendConnected}
        tokenUsage={conversation.tokenUsage}
        modelSelector={
          <LLMSelector
            providers={models.providers}
            selectedProvider={models.selectedProvider}
            selectedModel={models.selectedModel}
            onProviderChange={models.changeProvider}
            onModelChange={models.setSelectedModel}
            compact
          />
        }
      />
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
