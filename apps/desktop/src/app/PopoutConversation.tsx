import { useEffect, useState } from "react";
import { ConversationCenter } from "@numezis/ui/components/CommandCenter/ConversationCenter";
import { InputBar } from "@numezis/ui/components/CommandCenter/InputBar";
import { InlineDiffReview } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import type { InlineDiff } from "@numezis/ui/components/CommandCenter/InlineDiffReview";
import { LLMSelector } from "@numezis/ui/components/design-system";

import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useWorkspace } from "../hooks/useWorkspace";
import { useConversation } from "../hooks/useConversation";
import { useDiffs } from "../hooks/useDiffs";
import { useModels } from "../hooks/useModels";
import { usePersonality } from "../hooks/usePersonality";

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
  const personality = usePersonality();

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
      <ConversationCenter
        renderItems={conversation.renderItems}
        streaming={conversation.streaming}
        streamHasEvents={conversation.streamHasEvents}
        streamingText={conversation.streamingText}
        sendError={conversation.sendError}
        conversationLoading={conversation.conversationLoading}
        conversationId={conversationId}
        editingMessageIndex={conversation.editingMessageIndex}
        editingMessageDraft={conversation.editingMessageDraft}
        editingMessageSaving={conversation.editingMessageSaving}
        editingMessageError={conversation.editingMessageError}
        onStartEdit={conversation.startEditMessage}
        onResendEdit={conversation.saveEditedMessage}
        onCancelEdit={conversation.cancelEditMessage}
        onEditDraftChange={conversation.setEditingMessageDraft}
        diffReview={
          inlineDiffs.length > 0 ? (
            <InlineDiffReview
              diffs={inlineDiffs}
              onAccept={(editId) => diffs.applyAllDiff(editId)}
              onReject={(editId) => diffs.rejectAllDiff(editId)}
              onOpenInIDE={(filePath) => {
                try { (window as any).numezis?.openInVSCode?.(filePath); } catch { /* ignore */ }
              }}
            />
          ) : undefined
        }
      />

      {/* Input Bar */}
      <InputBar
        value={conversation.input}
        onChange={conversation.setInput}
        onSend={() => void conversation.sendMessage({
          personalityPrefix: personality.getSystemPromptPrefix(),
        })}
        onStop={conversation.stopStreaming}
        sending={conversation.streaming}
        disabled={conversation.streaming || !backendReady || !auth.auth?.accessToken}
        placeholder="Continue the conversation..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void conversation.sendMessage({ personalityPrefix: personality.getSystemPromptPrefix() });
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
    </div>
  );
}
