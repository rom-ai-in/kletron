import { useCallback, useRef, useState } from "react";
import type { Message } from "@kletron/shared/chatTypes";
import type { GetRequestHeaders } from "@kletron/shared";
import type { SessionDetailPayload } from "@kletron/shared/sessionThreadTypes";
import { apiFetch } from "@kletron/shared";
import { normalizeMessage } from "./useSessionStream";

export type HistoryPageState = {
  total: number;
  start: number;
  end: number;
  hasOlder: boolean;
};

export interface UseAgentThreadOptions {
  apiOrigin?: string;
  getRequestHeaders?: GetRequestHeaders;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export interface UseAgentThreadReturn {
  sessionDetail: SessionDetailPayload | null;
  setSessionDetail: React.Dispatch<React.SetStateAction<SessionDetailPayload | null>>;
  sessionDetailLoading: boolean;
  historyPage: HistoryPageState;
  setHistoryPage: React.Dispatch<React.SetStateAction<HistoryPageState>>;
  loadingOlder: boolean;
  setLoadingOlder: React.Dispatch<React.SetStateAction<boolean>>;
  loadSessionDetail: (
    sid: string,
    options?: { mergeMessages?: boolean; beforeIndex?: number; appendOlder?: boolean }
  ) => Promise<void>;
}

/**
 * Shared session hydration + paginated history loading (GET /api/sessions/:id).
 * Mirrors apps/web agent page behavior for merge/replace/appendOlder and deduplication.
 */
export function useAgentThread({
  apiOrigin,
  getRequestHeaders,
  setMessages,
}: UseAgentThreadOptions): UseAgentThreadReturn {
  const [sessionDetail, setSessionDetail] = useState<SessionDetailPayload | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState<HistoryPageState>({
    total: 0,
    start: 0,
    end: 0,
    hasOlder: false,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);

  const sessionHydrateSeqRef = useRef(0);

  const loadSessionDetail = useCallback(
    async (
      sid: string,
      options?: { mergeMessages?: boolean; beforeIndex?: number; appendOlder?: boolean }
    ) => {
      const isReplaceLoad = !options?.mergeMessages && !options?.appendOlder;
      let seq = 0;
      if (isReplaceLoad) {
        seq = ++sessionHydrateSeqRef.current;
        setSessionDetailLoading(true);
      }
      try {
        const query = new URLSearchParams();
        query.set("limit", "120");
        if (typeof options?.beforeIndex === "number") {
          query.set("beforeIndex", String(options.beforeIndex));
        }
        const path = `/api/sessions/${sid}?${query.toString()}`;
        const res = await apiFetch({
          apiOrigin,
          path,
          getRequestHeaders,
          method: "GET",
        });
        if (res.ok) {
          const data = (await res.json()) as SessionDetailPayload;
          setSessionDetail(data);
          if (data?.conversationPagination) {
            if (options?.appendOlder) {
              setHistoryPage((prev) => ({
                total: data.conversationPagination!.total ?? prev.total,
                start: data.conversationPagination!.start ?? prev.start,
                end: Math.max(prev.end, data.conversationPagination!.end ?? 0),
                hasOlder: Boolean(data.conversationPagination!.hasOlder),
              }));
            } else {
              setHistoryPage({
                total: data.conversationPagination!.total ?? 0,
                start: data.conversationPagination!.start ?? 0,
                end: data.conversationPagination!.end ?? 0,
                hasOlder: Boolean(data.conversationPagination!.hasOlder),
              });
            }
          }

          if (data.conversationHistory?.length) {
            const rawMessages = data.conversationHistory
              .filter((e: any) => e.kind === "user" || e.kind === "assistant" || e.kind === "tool")
              .map((e: any) =>
                normalizeMessage({
                  id: e.id,
                  role: e.kind === "tool" ? "tool" : e.kind,
                  content: e.content ?? "",
                  timestamp: e.timestamp,
                  toolName: e.toolName ?? e.name,
                  toolArgs: typeof e.toolArgs === "string" ? e.toolArgs : e.toolArgs ? JSON.stringify(e.toolArgs) : undefined,
                  toolOutput: e.kind === "tool" ? e.content : undefined,
                  toolCallId: e.toolCallId,
                  isError: e.isError,
                  thoughts: e.thoughts,
                  thinking: e.thinking,
                })
              );

            const seenIds = new Set<string>();
            const loadedMessages: typeof rawMessages = [];
            for (let i = 0; i < rawMessages.length; i++) {
              const m = rawMessages[i];
              if (seenIds.has(m.id)) continue;
              if (loadedMessages.length > 0) {
                const prev = loadedMessages[loadedMessages.length - 1];
                if (
                  prev.role === m.role &&
                  (prev.content ?? "").trim() === (m.content ?? "").trim() &&
                  (prev.content ?? "").trim() !== ""
                ) {
                  continue;
                }
              }
              seenIds.add(m.id);
              loadedMessages.push(m);
            }

            if (options?.appendOlder) {
              setMessages((prev) => {
                const seen = new Set<string>(prev.map((m: Message) => m.id));
                const olderUnique = loadedMessages.filter((m: Message) => !seen.has(m.id));
                return [...olderUnique, ...prev];
              });
            } else if (options?.mergeMessages) {
              setMessages((prev) => {
                if (prev.length > loadedMessages.length) return prev;
                return loadedMessages;
              });
            } else {
              setMessages(loadedMessages);
            }
          } else if (isReplaceLoad) {
            setMessages([]);
          }
        }
      } catch (e) {
        console.error("Failed to load session detail:", e);
      } finally {
        if (isReplaceLoad && seq === sessionHydrateSeqRef.current) {
          setSessionDetailLoading(false);
        }
      }
    },
    [apiOrigin, getRequestHeaders, setMessages]
  );

  return {
    sessionDetail,
    setSessionDetail,
    sessionDetailLoading,
    historyPage,
    setHistoryPage,
    loadingOlder,
    setLoadingOlder,
    loadSessionDetail,
  };
}
