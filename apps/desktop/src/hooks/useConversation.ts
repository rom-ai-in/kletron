import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Message } from "@kletron/shared/chatTypes";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { parseThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { useSessionStream } from "@kletron/ui/hooks/useSessionStream";
import { normalizeToWorkModeId, type WorkModeId } from "@kletron/shared/workMode";
import { normalizeResearchDepth, type ResearchDepthId } from "@kletron/shared/researchDepth";
import { useAgentThread } from "@kletron/ui/hooks/useAgentThread";
import { useSessionEdits } from "@kletron/ui/hooks/useSessionEdits";
import type {
  ChatEvent,
  DiffRequest,
  LlmConfig,
  RenderItem,
  WorkspaceInfo,
} from "../types";
import { buildHunks, normalizeContent } from "../utils";
import { provisionalTitleFromUserMessage } from "../utils/threadListMerge";

function messageToChatEvent(m: Message, messageIndex: number): ChatEvent {
  const role = m.role;
  const kind: ChatEvent["kind"] =
    role === "tool" ? "tool" : role === "user" ? "user" : role === "assistant" ? "assistant" : "system";
  return {
    id: m.id,
    kind,
    role,
    content: m.content,
    toolName: m.toolName,
    toolArgs: m.toolArgs,
    toolOutput: m.toolOutput,
    toolCallId: m.toolCallId,
    isError: m.isError,
    timestamp: m.timestamp,
    thoughts: m.thoughts,
    thinking: m.thinking,
    metadata: m.metadata,
    messageIndex,
  };
}

function resolveLlmModel(modelConfig: LlmConfig | null): string | undefined {
  if (!modelConfig?.provider) return undefined;
  const p = modelConfig.provider;
  const block = modelConfig[p] as { model?: string; deployment?: string } | undefined;
  return block?.model ?? block?.deployment;
}

export function useConversation(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  conversationId: string | null,
  setConversationId: (id: string | null) => void,
  workspace: WorkspaceInfo | null,
  modelConfig: LlmConfig | null,
  selectedGraph: string | null,
  _graphName?: string,
  loadThreads?: (preferredId?: string, options?: { provisionalTitle?: string }) => Promise<void>,
  setDiffs?: (fn: (prev: DiffRequest[]) => DiffRequest[]) => void,
  activeWorkspaceId?: string | null,
  activeCategory?: string
) {
  const [conversationLoading, setConversationLoading] = useState(false);
  const [streamHasEvents, setStreamHasEvents] = useState(false);
  const [threadApprovalMode, setThreadApprovalMode] = useState<ThreadApprovalMode>("inherit");
  const [conversationRunSource, setConversationRunSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [researchDepth, setResearchDepth] = useState<ResearchDepthId>("exhaustive");

  const getRequestHeaders = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return {};
    const h: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (activeWorkspaceId) h["x-workspace-id"] = activeWorkspaceId;
    return h;
  }, [getAccessToken, activeWorkspaceId]);

  const onTitleGenerate = useCallback(
    (runId: string, userMessage: string) => {
      const generateTitle = async () => {
        const MAX_RETRIES = 2;
        const RETRY_DELAY_MS = 1500;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const tok = await getAccessToken();
            if (!tok) return;
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tok}`,
            };
            if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;

            const res = await fetch(`${backendUrlTrimmed}/api/sessions/${runId}/title`, {
              method: "PUT",
              headers,
              body: JSON.stringify({ generate: true, userMessage }),
            });
            if (res.ok) {
              await loadThreads?.(runId);
              return;
            }
            console.warn(`[title-gen] Attempt ${attempt + 1} returned ${res.status}`);
          } catch (e) {
            console.warn(`[title-gen] Attempt ${attempt + 1} failed:`, e);
          }
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          }
        }
        console.error("[title-gen] All retries exhausted for session", runId);
      };
      void generateTitle();
    },
    [backendUrlTrimmed, getAccessToken, activeWorkspaceId, loadThreads]
  );

  const stream = useSessionStream({
    sessionId: conversationId,
    selectedGraphId: selectedGraph ?? "",
    llmProvider: modelConfig?.provider ?? "azure",
    llmModel: resolveLlmModel(modelConfig),
    workspaceId: activeWorkspaceId ?? null,
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders,
    category: activeCategory ?? null,
    workMode: normalizeToWorkModeId(activeCategory ?? "code"),
    threadApprovalMode,
    onSessionCreated: (runId, _graphId, firstUserMessage) => {
      setConversationId(runId);
      void loadThreads?.(runId, {
        provisionalTitle: provisionalTitleFromUserMessage(firstUserMessage),
      });
    },
    onTitleGenerate,
    researchDepth,
  });

  const sessionEdits = useSessionEdits({
    sessionId: conversationId,
    isStreaming: stream.streamStatus === "streaming",
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders,
  });

  const agentThread = useAgentThread({
    apiOrigin: backendUrlTrimmed,
    getRequestHeaders,
    setMessages: stream.setMessages,
  });

  const {
    loadSessionDetail,
    loadingOlder,
    setLoadingOlder,
    historyPage,
    setSessionDetail,
    setHistoryPage,
  } = agentThread;

  // Keep run source + approval mode aligned with the *current* session only.
  // Previously, leaving an automation thread (or opening New chat) left `conversationRunSource`
  // stuck on "automation", which greyed out ThreadApprovalModeSelector forever.
  useEffect(() => {
    if (!conversationId) {
      setConversationRunSource(null);
      return;
    }
    const d = agentThread.sessionDetail;
    if (!d?.id || d.id !== conversationId) {
      setConversationRunSource(null);
      return;
    }
    setThreadApprovalMode(parseThreadApprovalMode(d.threadApprovalMode));
    setConversationRunSource(typeof d.source === "string" ? d.source : null);
  }, [conversationId, agentThread.sessionDetail]);

  useEffect(() => {
    const d = agentThread.sessionDetail;
    if (!conversationId || d?.id !== conversationId) return;
    if (d.researchDepth != null) {
      setResearchDepth(normalizeResearchDepth(d.researchDepth));
    }
  }, [conversationId, agentThread.sessionDetail]);

  const prevStreamStatusRef = useRef(stream.streamStatus);
  useEffect(() => {
    const wasStreaming = prevStreamStatusRef.current === "streaming";
    prevStreamStatusRef.current = stream.streamStatus;
    if (stream.streamStatus !== "streaming" && conversationId && wasStreaming) {
      void loadSessionDetail(conversationId, { mergeMessages: true });
      void loadThreads?.(conversationId);
    }
  }, [stream.streamStatus, conversationId, loadSessionDetail, loadThreads]);

  useEffect(() => {
    const detailId = agentThread.sessionDetail?.id;
    const detailStatus = agentThread.sessionDetail?.status;
    if (!conversationId || !detailId || detailId !== conversationId) return;
    if (stream.sending) return;
    if (detailStatus !== "RUNNING" && detailStatus !== "PENDING") return;

    const id = window.setInterval(() => {
      void loadSessionDetail(conversationId, { mergeMessages: true });
    }, 2000);
    return () => window.clearInterval(id);
  }, [
    conversationId,
    agentThread.sessionDetail?.id,
    agentThread.sessionDetail?.status,
    stream.sending,
    loadSessionDetail,
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevSendingRef = useRef(false);

  const conversationEvents = useMemo(() => {
    return stream.messages.map((m, i) => messageToChatEvent(m, i));
  }, [stream.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream.messages, stream.eventStream]);

  useEffect(() => {
    if (stream.eventStream.length > 0) setStreamHasEvents(true);
  }, [stream.eventStream]);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    const was = prevSendingRef.current;
    prevSendingRef.current = stream.sending;
    if (was && !stream.sending && conversationId) {
      void loadThreads?.(conversationId);
    }
  }, [stream.sending, loadThreads, conversationId]);

  useEffect(() => {
    if (!workspace?.path || !setDiffs || !conversationId) return;
    let cancelled = false;
    void (async () => {
      const pending = sessionEdits.pendingEdits.filter((p) => p.toolName === "write_file");
      const nextDiffs: DiffRequest[] = [];
      for (const edit of pending) {
        if (!edit?.id) continue;
        const filePath = String((edit.args as any)?.filePath ?? (edit.args as any)?.path ?? "");
        const nextContentRaw = (edit.args as any)?.content;
        const targetContent = typeof nextContentRaw === "string" ? nextContentRaw : "";
        if (!filePath) continue;
        let baseContent = "";
        try {
          baseContent = await window.kletron.readFile(filePath);
        } catch {
          baseContent = "";
        }
        const normalizedBase = normalizeContent(baseContent);
        const normalizedTarget = normalizeContent(targetContent);
        if (normalizedBase === normalizedTarget) continue;
        const hunks = buildHunks(edit.id, filePath, normalizedBase, normalizedTarget);
        if (hunks.length === 0) continue;
        nextDiffs.push({ editId: edit.id, filePath, baseContent: normalizedBase, targetContent: normalizedTarget, hunks });
      }
      if (cancelled) return;
      setDiffs(() => nextDiffs);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionEdits.pendingEdits, workspace?.path, conversationId, setDiffs]);

  async function loadConversation(convoId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setConversationLoading(true);
    stream.setMessages([]);
    setLoadError(null);
    setDiffs?.(() => []);
    try {
      await loadSessionDetail(convoId);
    } catch (error) {
      stream.setMessages([]);
      setLoadError((error as Error)?.message || "Unable to load conversation.");
    } finally {
      setConversationLoading(false);
    }
  }

  const handleLoadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlder || !historyPage.hasOlder) return;
    setLoadingOlder(true);
    try {
      await loadSessionDetail(conversationId, {
        beforeIndex: historyPage.start,
        appendOlder: true,
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, historyPage.hasOlder, historyPage.start, loadSessionDetail, setLoadingOlder]);

  const sendError = stream.errorMessage ?? loadError ?? null;

  async function sendMessage(options?: { planMode?: boolean; text?: string }) {
    if (!backendReady) {
      setLoadError("Backend disconnected or invalid.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setLoadError("Authentication expired. Please sign in again.");
      return;
    }
    setLoadError(null);
    try {
      await stream.handleSend({ text: options?.text, planMode: options?.planMode });
    } catch (e) {
      const rawMessage = (e as Error)?.message ?? String(e);
      if (rawMessage.includes("Failed to fetch") || rawMessage.includes("fetch failed") || rawMessage.includes("NetworkError")) {
        console.error("[useConversation]", rawMessage);
      }
    }
  }

  function stopStreaming() {
    stream.handleStop();
  }

  async function truncateAndResend(messageIndex: number, newContent: string) {
    if (!conversationId) return;
    const token = await getAccessToken();
    if (!token) throw new Error("Authentication expired.");

    const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;

    const truncateRes = await fetch(`${backendUrlTrimmed}/api/sessions/${conversationId}/truncate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ afterIndex: messageIndex }),
    });

    if (!truncateRes.ok) {
      const text = await truncateRes.text();
      throw new Error(text || `Failed to truncate conversation (${truncateRes.status})`);
    }

    stream.setMessages((prev) => prev.filter((_, i) => i < messageIndex));
    setDiffs?.(() => []);

    await stream.handleSend({ text: newContent });
  }

  function resetConversation() {
    stream.setMessages([]);
    setSessionDetail(null);
    setHistoryPage({ total: 0, start: 0, end: 0, hasOlder: false });
    setResearchDepth("exhaustive");
  }

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let toolBuffer: ChatEvent[] = [];
    const flushTools = () => {
      if (toolBuffer.length > 0) {
        items.push({ type: "tools", events: toolBuffer });
        toolBuffer = [];
      }
    };

    const isToolRelated = (e: ChatEvent) =>
      (e.kind === "assistant" && Boolean(e.toolName)) || e.kind === "tool";

    for (const event of conversationEvents) {
      if (isToolRelated(event)) {
        toolBuffer.push(event);
        continue;
      }
      flushTools();
      items.push({ type: "event", event });
    }
    flushTools();
    return items;
  }, [conversationEvents]);

  async function updateThreadApprovalMode(mode: ThreadApprovalMode) {
    setThreadApprovalMode(mode);
    if (!conversationId) return;
    const token = await getAccessToken();
    if (!token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (activeWorkspaceId) headers["x-workspace-id"] = activeWorkspaceId;
    await fetch(`${backendUrlTrimmed}/api/sessions/${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ threadApprovalMode: mode }),
    }).catch(() => {});
  }

  function onThreadApprovalSelect(mode: ThreadApprovalMode) {
    if (mode === "full_auto_thread") {
      const key = `kletron-full-auto-thread-ok-${activeWorkspaceId ?? "default"}`;
      if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
        const ok = window.confirm(
          "Full auto: tools run without prompts, including writes and shell. Kletron admin tools and your workspace blocklist still require approval. Continue?"
        );
        if (!ok) return;
        sessionStorage.setItem(key, "1");
      }
    }
    void updateThreadApprovalMode(mode);
  }

  const tokenUsageFormatted = useMemo(() => {
    const u = stream.tokenUsage;
    if (!u || typeof u.totalTokens !== "number") return null;
    return {
      input: u.totalInputTokens >= 1000 ? `${(u.totalInputTokens / 1000).toFixed(1)}k` : String(u.totalInputTokens),
      output: u.totalOutputTokens >= 1000 ? `${(u.totalOutputTokens / 1000).toFixed(1)}k` : String(u.totalOutputTokens),
    };
  }, [stream.tokenUsage]);

  /** Prefer persisted session workMode when hydrated; else workspace category (main window). */
  const threadWorkMode = useMemo((): WorkModeId => {
    const d = agentThread.sessionDetail;
    if (d?.id === conversationId && d.workMode != null) {
      return d.workMode;
    }
    return normalizeToWorkModeId(activeCategory ?? "code");
  }, [agentThread.sessionDetail, conversationId, activeCategory]);

  const sessionStatus = useMemo(() => {
    const d = agentThread.sessionDetail;
    if (!conversationId || d?.id !== conversationId) return null;
    return d.status ?? null;
  }, [agentThread.sessionDetail, conversationId]);

  const serverRunActive = sessionStatus === "RUNNING" || sessionStatus === "PENDING";
  const runActive = stream.sending || serverRunActive;
  const runStartedAt = stream.runStartedAt ?? (
    agentThread.sessionDetail?.id === conversationId
      ? agentThread.sessionDetail.startedAt ?? null
      : null
  );

  return {
    conversationEvents,
    conversationLoading: conversationLoading || agentThread.sessionDetailLoading,
    streaming: stream.sending,
    runActive,
    sessionStatus,
    runStartedAt,
    streamingState: stream.streamStatus as import("../types").StreamingState,
    streamingMessage: null,
    streamHasEvents,
    streamingText: stream.streamingText,
    streamingReasoning: stream.streamingReasoning,
    input: stream.input,
    setInput: stream.setInput,
    sendError,
    setSendError: (msg: string | null) => {
      setLoadError(msg);
    },
    messagesEndRef,
    renderItems,
    loadConversation,
    sendMessage,
    stopStreaming,
    resetConversation,
    truncateAndResend,
    tokenUsage: tokenUsageFormatted,
    threadApprovalMode,
    onThreadApprovalSelect,
    conversationRunSource,
    historyPage,
    loadingOlder,
    onLoadOlderMessages: handleLoadOlderMessages,
    sessionEdits,
    capabilityDroppedTools: stream.capabilityDroppedTools,
    threadWorkMode,
    researchDepth,
    setResearchDepth,
  };
}
