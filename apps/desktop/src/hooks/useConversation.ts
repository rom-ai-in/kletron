import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import type { ReplayImpact, FileChange } from "@numezis/ui";
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
  const [streamingText, setStreamingText] = useState("");
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
  const streamingTextRef = useRef("");

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
        `${backendUrlTrimmed}/api/sessions/${encodeURIComponent(convoId)}/edits`,
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
      const res = await fetch(`${backendUrlTrimmed}/api/sessions/${convoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load conversation (${res.status})`);
      }
      const data = (await res.json()) as ConversationDetail;
      const rawMessages = Array.isArray(data?.conversationHistory) ? data.conversationHistory : (Array.isArray(data?.messages) ? data.messages : []);
      const mapped = rawMessages
        .map((msg, index) => {
          const kindValue = String(msg?.kind ?? msg?.role ?? "").toLowerCase();
          const kind: ChatEvent["kind"] =
            kindValue === "user" || kindValue === "assistant" || kindValue === "tool" || kindValue === "system"
              ? (kindValue as ChatEvent["kind"])
              : "system";
          let content = typeof msg?.content === "string" ? msg.content : "";
          // Strip injected [System: ...] personality prefix from user messages
          if (kind === "user" && content.startsWith("[System:")) {
            const endBracket = content.indexOf("]\n\n");
            if (endBracket !== -1) {
              content = content.slice(endBracket + 3).trim();
            }
          }
          return {
            id: msg?.id,
            kind,
            role: (msg?.role ?? msg?.kind ?? "system") as ChatEvent["role"],
            content,
            // AgentEvent stores tool name in `name`, ChatEvent uses `toolName`
            toolName: msg?.toolName ?? msg?.name,
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

  async function sendMessage(options?: { personalityPrefix?: string; planMode?: boolean; text?: string }) {
    const trimmed = (options?.text ?? input).trim();
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
    setStreamingText("");
    streamingTextRef.current = "";
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
    // Pre-populate with IDs from already-loaded conversation events so that
    // streamed events whose IDs match loaded events are not appended again.
    streamedEventIdsRef.current = new Set(
      conversationEvents.filter((e) => e.id).map((e) => e.id as string)
    );

    try {
      // Determine whether to create a new session or continue existing one
      const isNewSession = !conversationId;
      const url = isNewSession
        ? `${backendUrlTrimmed}/api/sessions`
        : `${backendUrlTrimmed}/api/sessions/${conversationId}/chat`;
      const messageContent = options?.personalityPrefix
        ? `[System: ${options.personalityPrefix}]\n\n${trimmed}`
        : trimmed;
      const body = isNewSession
        ? {
            graphId: selectedGraph || undefined,
            message: messageContent,
            ...(modelConfig?.provider ? { provider: modelConfig.provider } : {}),
          }
        : {
            message: messageContent,
            ...(modelConfig?.provider ? { provider: modelConfig.provider } : {}),
          };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: abortRef.current?.signal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        // Try to extract a human-readable message from JSON error responses
        let errorMessage = errText || `Request failed: ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error) errorMessage = parsed.error;
        } catch {
          // not JSON, use raw text
        }
        throw new Error(errorMessage);
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

      // Parse NDJSON stream (instead of SSE)
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              const chunk = JSON.parse(trimmedLine);

              if (chunk.type === "init") {
                convoId = chunk.payload.runId;
                if (isNewSession && convoId) {
                  setConversationId(convoId);
                  await loadThreads?.(convoId);
                }
              } else if (chunk.type === "text_delta") {
                // Progressive text streaming
                streamingTextRef.current += chunk.payload.content;
                setStreamingText(streamingTextRef.current);
              } else if (chunk.type === "update") {
                // Full update: clear progressive text (real message is in eventStream)
                if (streamingTextRef.current) {
                  streamingTextRef.current = "";
                  setStreamingText("");
                }
                const update = chunk.payload;
                if (update.eventStream?.length) {
                  // Map events to ChatEvents
                  for (const event of update.eventStream) {
                    if (event.kind === "user") {
                      setStreamHasEvents(true);
                      continue;
                    }
                    if (event.kind === "assistant") {
                      if (event.name || event.toolName) {
                        const toolArgs = typeof event.toolArgs === "string" ? event.toolArgs : event.toolArgs ? JSON.stringify(event.toolArgs) : undefined;
                        appendChatEvent({
                          kind: "assistant", role: "assistant",
                          toolName: event.name ?? event.toolName,
                          toolArgs, toolCallId: event.toolCallId,
                          timestamp: event.timestamp,
                          thoughts: Array.isArray(event.thoughts) ? event.thoughts : undefined,
                        }, event.id);
                      } else if (event.content) {
                        appendChatEvent({
                          kind: "assistant", role: "assistant",
                          content: event.content, timestamp: event.timestamp,
                        }, event.id);
                      }
                    } else if (event.kind === "tool") {
                      appendChatEvent({
                        kind: "tool", role: "tool",
                        toolName: event.name ?? event.toolName,
                        toolOutput: event.content,
                        toolCallId: event.toolCallId,
                        timestamp: event.timestamp,
                        content: event.content,
                      }, event.id);
                    } else if (event.kind === "system") {
                      appendChatEvent({
                        kind: "system", role: "system",
                        content: event.content,
                        timestamp: event.timestamp,
                      }, event.id);
                    }
                  }
                }
                // Extract token usage from meta
                if (update.outputs?.meta?.tokenUsage) {
                  const usage = update.outputs.meta.tokenUsage as any;
                  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                  setTokenUsage({
                    input: fmtTokens(usage.totalInputTokens ?? 0),
                    output: fmtTokens(usage.totalOutputTokens ?? 0),
                  });
                }
              } else if (chunk.type === "final") {
                // Clear any residual streaming text
                streamingTextRef.current = "";
                setStreamingText("");
                // Session completed
                convoId = chunk.payload.sessionId ?? convoId;

                // Auto-generate thread title for new sessions
                if (isNewSession && convoId && trimmed) {
                  getAccessToken().then((tok) => {
                    if (!tok) return;
                    fetch(`${backendUrlTrimmed}/api/sessions/${convoId}/title`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
                      body: JSON.stringify({ generate: true, userMessage: trimmed }),
                    })
                      .then(() => loadThreads?.(convoId!))
                      .catch(() => {}); // fire-and-forget
                  }).catch(() => {});
                }
                // Process any final events not yet seen
                if (chunk.payload.eventStream?.length) {
                  for (const event of chunk.payload.eventStream) {
                    if (event.kind === "user") continue;
                    if (event.kind === "assistant") {
                      if (event.name || event.toolName) {
                        const toolArgs = typeof event.toolArgs === "string" ? event.toolArgs : event.toolArgs ? JSON.stringify(event.toolArgs) : undefined;
                        appendChatEvent({
                          kind: "assistant", role: "assistant",
                          toolName: event.name ?? event.toolName,
                          toolArgs, toolCallId: event.toolCallId,
                          timestamp: event.timestamp,
                          thoughts: Array.isArray(event.thoughts) ? event.thoughts : undefined,
                        }, event.id);
                      } else if (event.content) {
                        appendChatEvent({
                          kind: "assistant", role: "assistant",
                          content: event.content, timestamp: event.timestamp,
                        }, event.id);
                      }
                    } else if (event.kind === "tool") {
                      appendChatEvent({
                        kind: "tool", role: "tool",
                        toolName: event.name ?? event.toolName,
                        toolOutput: event.content,
                        toolCallId: event.toolCallId,
                        timestamp: event.timestamp,
                        content: event.content,
                      }, event.id);
                    }
                  }
                }
                // Extract final token usage
                if (chunk.payload.outputs?.meta?.tokenUsage) {
                  const usage = chunk.payload.outputs.meta.tokenUsage as any;
                  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                  setTokenUsage({
                    input: fmtTokens(usage.totalInputTokens ?? 0),
                    output: fmtTokens(usage.totalOutputTokens ?? 0),
                  });
                }
              } else if (chunk.type === "error") {
                didError = true;
                setSendError(chunk.payload.message);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } finally {
        reader.releaseLock();
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

    // Fire-and-forget: notify the server so the run status is updated from RUNNING
    if (conversationId) {
      getAccessToken().then((token) => {
        if (!token) return;
        fetch(`${backendUrlTrimmed}/api/sessions/${conversationId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }).catch(() => {});
    }
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
      const res = await fetch(`${backendUrlTrimmed}/api/sessions/${conversationId}/truncate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ afterIndex: editingMessageIndex }),
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

    // Detect tool-related events (handles both NEW and LEGACY data).
    // Legacy data: backend assigned kind="tool" to BOTH AI tool-call and tool-result events.
    // New data: AI tool-call → kind="assistant" with toolName set.
    const isToolRelated = (e: ChatEvent) =>
      (e.kind === "assistant" && Boolean(e.toolName)) ||
      e.kind === "tool";

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

  /**
   * Compute the impact of replaying from a given message index.
   * Analyses all events after `fromIndex` to find messages, tool calls, and file changes.
   */
  const computeReplayImpact = useCallback(
    (fromIndex: number, originalContent: string, newContent: string): ReplayImpact => {
      const eventsAfter = conversationEvents.filter(
        (e) => typeof e.messageIndex === "number" && e.messageIndex > fromIndex
      );

      let messagesRemoved = 0;
      let toolCallsRemoved = 0;
      const fileChangesMap = new Map<string, FileChange["action"]>();

      for (const event of eventsAfter) {
        if (event.kind === "user" || (event.kind === "assistant" && !event.toolName)) {
          messagesRemoved++;
        }
        if (event.kind === "assistant" && event.toolName) {
          toolCallsRemoved++;

          // Parse tool args for file changes
          const toolName = event.toolName.toLowerCase();
          let args: Record<string, unknown> = {};
          if (event.toolArgs) {
            try {
              args = JSON.parse(event.toolArgs);
            } catch {
              // ignore
            }
          }

          const filePath =
            (args.filePath as string) ??
            (args.path as string) ??
            (args.file_path as string) ??
            (args.fileName as string) ??
            "";

          if (filePath) {
            if (toolName.includes("write") || toolName.includes("create") || toolName.includes("save")) {
              // If we already have it as "modified", keep "modified"; otherwise check if new
              if (!fileChangesMap.has(filePath)) {
                // Heuristic: if tool name contains "create", mark as created
                fileChangesMap.set(
                  filePath,
                  toolName.includes("create") ? "created" : "modified"
                );
              }
            } else if (toolName.includes("delete") || toolName.includes("remove")) {
              fileChangesMap.set(filePath, "deleted");
            }
          }
        }
        if (event.kind === "tool") {
          // Tool results don't count as separate tool calls (they're the response)
        }
      }

      const fileChanges: FileChange[] = Array.from(fileChangesMap.entries()).map(
        ([path, action]) => ({ path, action })
      );

      return {
        messagesRemoved,
        toolCallsRemoved,
        fileChanges,
        originalContent,
        newContent,
      };
    },
    [conversationEvents]
  );

  /**
   * Replay from a given message: update the message, truncate everything after, then resend.
   */
  async function replayFromMessage(
    messageIndex: number,
    newContent: string,
    options?: { personalityPrefix?: string; planMode?: boolean }
  ) {
    if (!conversationId) return;
    const token = await getAccessToken();
    if (!token) {
      setSendError("Authentication expired.");
      return;
    }

    setEditingMessageSaving(true);
    setEditingMessageError(null);

    try {
      // 1. Truncate everything AFTER this message on the server (uses the unified sessions API)
      const truncateRes = await fetch(`${backendUrlTrimmed}/api/sessions/${conversationId}/truncate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ afterIndex: messageIndex + 1 }),
      });
      if (!truncateRes.ok) {
        const text = await truncateRes.text();
        throw new Error(text || `Failed to truncate conversation (${truncateRes.status})`);
      }

      // 3. Truncate local events: keep only events with messageIndex <= messageIndex
      setConversationEvents((prev) =>
        prev.filter((e) => typeof e.messageIndex === "number" && e.messageIndex <= messageIndex)
          .map((e) =>
            e.messageIndex === messageIndex ? { ...e, content: newContent.trim() } : e
          )
      );

      // 4. Clear editing state
      cancelEditMessage();

      // 5. Clear diffs (they're from the old branch)
      setDiffs?.(() => []);
      handledEditIdsRef.current = new Set();

      // 6. Now re-send the edited message to get a new agent response
      // We set the input to the edited content and trigger sendMessage
      setInput(newContent.trim());
    } catch (error) {
      setEditingMessageError((error as Error)?.message || "Unable to replay from this message.");
    } finally {
      setEditingMessageSaving(false);
    }
  }

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
    streamingText,
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
    computeReplayImpact,
    replayFromMessage,
    resetConversation,
    abortRef,
    tokenUsage,
  };
}
