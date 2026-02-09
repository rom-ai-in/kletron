import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatEvent,
  ConversationDetail,
  DiffRequest,
  LlmConfig,
  PendingEdit,
  RenderItem,
  ServerAgentEvent,
  StreamingState,
  WorkspaceInfo,
} from "../types";
import { buildHunks, normalizeContent, wait } from "../utils";

export function useConversation(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>,
  conversationId: string | null,
  setConversationId: (id: string | null) => void,
  workspace: WorkspaceInfo | null,
  modelConfig: LlmConfig | null,
  selectedGraph: string | null,
  graphName?: string,
  loadThreads?: (preferredId?: string) => Promise<void>,
  setDiffs?: (fn: (prev: DiffRequest[]) => DiffRequest[]) => void
) {
  const [conversationEvents, setConversationEvents] = useState<ChatEvent[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [streamHasEvents, setStreamHasEvents] = useState(false);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState<string>("");
  const [editingMessageSaving, setEditingMessageSaving] = useState(false);
  const [editingMessageError, setEditingMessageError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ input: string; output: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamedEventIdsRef = useRef<Set<string>>(new Set());
  const handledEditIdsRef = useRef<Set<string>>(new Set());

  // Scroll to bottom on new events
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationEvents, streamingMessage]);

  // Validate editing message
  useEffect(() => {
    if (editingMessageIndex === null) return;
    const editedEvent = conversationEvents.find((e) => e.messageIndex === editingMessageIndex);
    if (!editedEvent) cancelEditMessage();
  }, [editingMessageIndex, conversationEvents]);

  async function fetchPendingEdits(convoId: string, token: string) {
    if (!workspace?.path || !setDiffs) return;
    try {
      const res = await fetch(
        `${backendUrlTrimmed}/api/agent/edits?conversationId=${encodeURIComponent(convoId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const edits = (await res.json()) as PendingEdit[];
      if (!Array.isArray(edits) || edits.length === 0) return;

      const newDiffs: DiffRequest[] = [];

      for (const edit of edits) {
        if (!edit?.id || handledEditIdsRef.current.has(edit.id)) continue;
        if (edit.toolName !== "write_file") {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        const filePath = String((edit.args as any)?.filePath ?? (edit.args as any)?.path ?? "");
        const nextContentRaw = (edit.args as any)?.content;
        const targetContent = typeof nextContentRaw === "string" ? nextContentRaw : "";
        if (!filePath) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        let baseContent = "";
        try {
          baseContent = await window.numezis.readFile(filePath);
        } catch {
          baseContent = "";
        }

        const normalizedBase = normalizeContent(baseContent);
        const normalizedTarget = normalizeContent(targetContent);

        if (normalizedBase === normalizedTarget) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        const hunks = buildHunks(edit.id, filePath, normalizedBase, normalizedTarget);
        if (hunks.length === 0) {
          handledEditIdsRef.current.add(edit.id);
          continue;
        }

        newDiffs.push({ editId: edit.id, filePath, baseContent: normalizedBase, targetContent: normalizedTarget, hunks });
      }

      if (newDiffs.length > 0) {
        setDiffs((prev) => {
          const existing = new Set(prev.map((d) => d.editId));
          const merged = [...prev];
          for (const diff of newDiffs) {
            if (!existing.has(diff.editId)) merged.push(diff);
          }
          return merged;
        });
      }
    } catch {
      // ignore
    }
  }

  async function loadConversation(convoId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setConversationLoading(true);
    setSendError(null);
    setDiffs?.(() => []);
    setEditingMessageIndex(null);
    setEditingMessageDraft("");
    setEditingMessageError(null);
    handledEditIdsRef.current = new Set();
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/agent/${convoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load conversation (${res.status})`);
      }
      const data = (await res.json()) as ConversationDetail;
      const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
      const mapped = rawMessages
        .map((msg, index) => {
          const kindValue = String(msg?.kind ?? msg?.role ?? "").toLowerCase();
          const kind: ChatEvent["kind"] =
            kindValue === "user" || kindValue === "assistant" || kindValue === "tool" || kindValue === "system"
              ? (kindValue as ChatEvent["kind"])
              : "system";
          const content = typeof msg?.content === "string" ? msg.content : "";
          return {
            id: msg?.id,
            kind,
            role: (msg?.role ?? msg?.kind ?? "system") as ChatEvent["role"],
            content,
            toolName: msg?.toolName,
            toolArgs: typeof msg?.toolArgs === "string" ? msg.toolArgs : msg?.toolArgs ? JSON.stringify(msg.toolArgs) : undefined,
            toolOutput: typeof msg?.toolOutput === "string" ? msg.toolOutput : msg?.toolOutput ? JSON.stringify(msg.toolOutput) : undefined,
            toolCallId: msg?.toolCallId,
            timestamp: msg?.timestamp,
            metadata: msg?.metadata,
            thoughts: Array.isArray(msg?.thoughts) ? msg.thoughts : undefined,
            messageIndex: index,
          } as ChatEvent;
        })
        .filter((event) => {
          if (event.kind === "system" || event.kind === "tool") return true;
          return Boolean(event.content || event.toolName);
        });
      setConversationEvents(mapped);
    } catch (error) {
      setConversationEvents([]);
      setSendError((error as Error)?.message || "Unable to load conversation.");
    } finally {
      setConversationLoading(false);
    }

    try {
      const refreshed = await getAccessToken();
      if (refreshed) {
        await fetchPendingEdits(convoId, refreshed);
      }
    } catch {
      // ignore
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    if (!backendReady) {
      setSendError("Backend disconnected or invalid.");
      return;
    }

    setSendError(null);
    setStreaming(true);
    setStreamingState("streaming");
    setStreamingMessage(null);
    setStreamHasEvents(false);
    setTokenUsage(null);
    setConversationEvents((prev) => [
      ...prev,
      { kind: "user", role: "user", content: trimmed, timestamp: new Date().toISOString(), local: true },
    ]);
    setInput("");

    const token = await getAccessToken();
    if (!token) {
      setSendError("Authentication expired. Please sign in again.");
      setStreaming(false);
      setStreamingState("error");
      return;
    }

    let didAbort = false;
    let didError = false;
    let convoId: string | null = null;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    streamedEventIdsRef.current = new Set();

    const ensureConversationId = async () => {
      if (conversationId) return conversationId;
      const res = await fetch(`${backendUrlTrimmed}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: selectedGraph ? `Agent Session (${graphName ?? "Graph"})` : "Agent Session",
        }),
        signal: abortRef.current?.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to create session (${res.status})`);
      }
      const data = await res.json();
      if (!data?.id) throw new Error("Failed to create session.");
      setConversationId(data.id);
      await loadThreads?.(data.id);
      return data.id as string;
    };

    try {
      convoId = await ensureConversationId();
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let receivedAnyEvent = false;

        const streamOnce = async () => {
          const response = await fetch(`${backendUrlTrimmed}/api/agent/${convoId}/chat`, {
            method: "POST",
            headers: {
              Accept: "text/event-stream",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: trimmed,
              ...(modelConfig?.provider ? { llmProvider: modelConfig.provider } : {}),
              ...(selectedGraph ? { graphId: selectedGraph } : {}),
            }),
            signal: abortRef.current?.signal,
          });

          if (!response.ok || !response.body) {
            const errText = await response.text().catch(() => "");
            throw new Error(errText || `Request failed: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const appendChatEvent = (chatEvent: ChatEvent, eventId?: string) => {
            const id = eventId ?? chatEvent.id;
            if (id && streamedEventIdsRef.current.has(id)) return;
            if (id) streamedEventIdsRef.current.add(id);
            setConversationEvents((prev) => [...prev, { ...chatEvent, id }]);
            setStreamHasEvents(true);
          };

          const appendAssistantContent = (content: string, eventId?: string, timestamp?: string) => {
            if (!content?.trim()) return;
            appendChatEvent({ kind: "assistant", role: "assistant", content, timestamp }, eventId);
          };

          const handleServerEvent = (event: ServerAgentEvent & { type?: string; error?: string }) => {
            receivedAnyEvent = true;

            // Capture token usage from stream events
            if (event.type === "usage" || event.type === "token_usage") {
              const usage = event as any;
              const inputTokens = usage.inputTokens ?? usage.input_tokens ?? usage.promptTokens ?? 0;
              const outputTokens = usage.outputTokens ?? usage.output_tokens ?? usage.completionTokens ?? 0;
              const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
              setTokenUsage({ input: fmtTokens(inputTokens), output: fmtTokens(outputTokens) });
              return;
            }

            if ("error" in event && event.error) {
              didError = true;
              setSendError(event.error);
              return;
            }
            if (event.type === "error" && (event as any).message) {
              didError = true;
              setSendError(String((event as any).message));
              return;
            }
            if (event.type === "diff" && setDiffs) {
              const diffEvent = event as any;
              const baseContent = normalizeContent(diffEvent.originalContent);
              const targetContent = normalizeContent(diffEvent.newContent);
              const hunks = buildHunks(diffEvent.editId, diffEvent.filePath, baseContent, targetContent);
              if (hunks.length > 0) {
                setDiffs((prev) => [
                  ...prev,
                  { editId: diffEvent.editId, filePath: diffEvent.filePath, baseContent, targetContent, hunks },
                ]);
              }
              setStreamHasEvents(true);
              return;
            }
            if (event.type === "thinking") {
              appendChatEvent({ kind: "system", role: "system", content: "Agent is reasoning...", timestamp: new Date().toISOString() });
              return;
            }
            if (event.type === "tool_call") {
              const toolArgsRaw = (event as any).args ?? (event as any).toolArgs;
              const toolArgs = typeof toolArgsRaw === "string" ? toolArgsRaw : toolArgsRaw ? JSON.stringify(toolArgsRaw) : undefined;
              appendChatEvent({
                kind: "assistant",
                role: "assistant",
                toolName: (event as any).toolName ?? "tool",
                toolArgs,
                toolCallId: (event as any).toolId,
                timestamp: new Date().toISOString(),
              });
              return;
            }
            if (event.type === "tool_result") {
              const resultRaw = (event as any).result ?? (event as any).output ?? (event as any).error;
              const toolOutput = typeof resultRaw === "string" ? resultRaw : resultRaw ? JSON.stringify(resultRaw) : undefined;
              appendChatEvent({
                kind: "tool",
                role: "tool",
                toolName: (event as any).toolName ?? "tool",
                toolOutput,
                toolCallId: (event as any).toolId,
                timestamp: new Date().toISOString(),
              });
              return;
            }
            if (event.type === "message" && (event as any).role === "assistant") {
              appendAssistantContent(String((event as any).content ?? ""), (event as any).id);
              return;
            }
            if (event.kind === "user") {
              setStreamHasEvents(true);
              return;
            }
            if (event.kind === "assistant") {
              if (event.toolName) {
                const toolArgs = typeof event.toolArgs === "string" ? event.toolArgs : event.toolArgs ? JSON.stringify(event.toolArgs) : undefined;
                appendChatEvent({
                  kind: "assistant", role: "assistant", toolName: event.toolName, toolArgs,
                  toolCallId: event.toolCallId, timestamp: event.timestamp,
                  thoughts: Array.isArray(event.thoughts) ? event.thoughts : undefined,
                }, event.id);
                return;
              }
              if (typeof event.content === "string") {
                appendAssistantContent(event.content, event.id, event.timestamp);
              }
              return;
            }
            if (event.kind === "tool") {
              const toolOutput =
                typeof event.toolOutput === "string" ? event.toolOutput
                  : event.toolOutput ? JSON.stringify(event.toolOutput)
                    : typeof event.content === "string" ? event.content : undefined;
              appendChatEvent({
                kind: "tool", role: "tool", toolName: event.toolName, toolOutput,
                toolCallId: event.toolCallId, timestamp: event.timestamp,
                content: typeof event.content === "string" ? event.content : undefined,
              }, event.id);
              return;
            }
            if (event.kind === "system") {
              appendChatEvent({
                kind: "system", role: "system", content: event.content,
                metadata: event.metadata, timestamp: event.timestamp,
              }, event.id);
            }
          };

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const payload = line.replace(/^data:\s*/, "");
                if (payload === "[DONE]") continue;
                try {
                  handleServerEvent(JSON.parse(payload));
                } catch {
                  // ignore
                }
              }
            }

            if (buffer.trim().startsWith("data:")) {
              const payload = buffer.replace(/^data:\s*/, "").trim();
              if (payload && payload !== "[DONE]") {
                try {
                  handleServerEvent(JSON.parse(payload));
                } catch {
                  // ignore
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        };

        try {
          await streamOnce();
          break;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") {
            didAbort = true;
            throw error;
          }
          if (receivedAnyEvent) throw error;
          if (attempt >= maxAttempts) throw error;
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
          await wait(delay + Math.random() * 250);
        }
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        didError = true;
        setSendError(String(error));
      } else {
        didAbort = true;
      }
    } finally {
      if (didError) setStreamingState("error");
      else if (didAbort) setStreamingState("stopped");
      else setStreamingState("idle");
      setStreaming(false);
      setStreamingMessage(null);
      abortRef.current = null;
      if (convoId) await fetchPendingEdits(convoId, token!);
      await loadThreads?.(convoId ?? undefined);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingMessage(null);
    setStreamingState("stopped");
  }

  function startEditMessage(index: number, content: string) {
    setEditingMessageIndex(index);
    setEditingMessageDraft(content);
    setEditingMessageError(null);
  }

  function cancelEditMessage() {
    setEditingMessageIndex(null);
    setEditingMessageDraft("");
    setEditingMessageError(null);
  }

  async function saveEditedMessage() {
    if (editingMessageIndex === null || !conversationId) return;
    const nextContent = editingMessageDraft.trim();
    if (!nextContent) {
      setEditingMessageError("Message content cannot be empty.");
      return;
    }
    setEditingMessageSaving(true);
    setEditingMessageError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired.");
      const res = await fetch(`${backendUrlTrimmed}/api/agent/update-message`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, index: editingMessageIndex, content: nextContent }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update message (${res.status})`);
      }
      setConversationEvents((prev) =>
        prev.map((msg) => (msg.messageIndex === editingMessageIndex ? { ...msg, content: nextContent } : msg))
      );
      cancelEditMessage();
    } catch (error) {
      setEditingMessageError((error as Error)?.message || "Unable to update message.");
    } finally {
      setEditingMessageSaving(false);
    }
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
    for (const event of conversationEvents) {
      const isToolEvent = (event.kind === "assistant" && Boolean(event.toolName)) || event.kind === "tool";
      if (isToolEvent) {
        toolBuffer.push(event);
        continue;
      }
      flushTools();
      items.push({ type: "event", event });
    }
    flushTools();
    return items;
  }, [conversationEvents]);

  function resetConversation() {
    setConversationEvents([]);
    setSendError(null);
    setStreamingState("idle");
    streamedEventIdsRef.current = new Set();
    handledEditIdsRef.current = new Set();
  }

  return {
    conversationEvents,
    setConversationEvents,
    conversationLoading,
    streaming,
    streamingState,
    streamingMessage,
    streamHasEvents,
    input,
    setInput,
    sendError,
    setSendError,
    editingMessageIndex,
    editingMessageDraft,
    setEditingMessageDraft,
    editingMessageSaving,
    editingMessageError,
    messagesEndRef,
    renderItems,
    loadConversation,
    sendMessage,
    stopStreaming,
    startEditMessage,
    cancelEditMessage,
    saveEditedMessage,
    resetConversation,
    abortRef,
    tokenUsage,
  };
}
