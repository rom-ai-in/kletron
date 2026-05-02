import type { WorkModeId } from "@kletron/shared/workMode";

import type { ConversationHistoryItem } from "../types";

/** First-line preview for the sidebar until the server returns / generates a title. */
export function provisionalTitleFromUserMessage(message: string | undefined): string {
  if (!message?.trim()) return "New chat";
  const line = message.trim().split(/\r?\n/)[0] ?? "";
  const t = line.trim();
  if (!t) return "New chat";
  return t.length > 100 ? `${t.slice(0, 97)}…` : t;
}

export type MergePreferredSessionOptions = {
  provisionalTitle?: string;
  /** Mode for a newly created session placeholder (sidebar filter alignment). */
  provisionalWorkMode?: WorkModeId;
  prevThreads: ConversationHistoryItem[];
};

/**
 * If `preferredId` is not in the API list yet (common right after first message / session create),
 * prepend a placeholder row so the sidebar updates immediately. Server list wins once it includes the id.
 */
export function mergePreferredIntoSessionList(
  active: ConversationHistoryItem[],
  preferredId: string | undefined,
  options: MergePreferredSessionOptions
): ConversationHistoryItem[] {
  if (!preferredId || active.some((item) => item.id === preferredId)) {
    return active;
  }
  const prevRow = options.prevThreads.find((p) => p.id === preferredId);
  const title =
    prevRow?.title?.trim() ||
    options.provisionalTitle?.trim() ||
    "New chat";
  const placeholder: ConversationHistoryItem = {
    id: preferredId,
    title: title.slice(0, 120),
    updatedAt: new Date().toISOString(),
    lastRole: prevRow?.lastRole ?? "user",
    status: prevRow?.status,
    workMode: prevRow?.workMode ?? options.provisionalWorkMode,
  };
  return [placeholder, ...active];
}

export function pickConversationIdAfterLoad(
  merged: ConversationHistoryItem[],
  preferredId: string | undefined,
  currentConversationId: string | null,
  opts?: { skipAutoSelectFirst?: boolean }
): string | null {
  if (preferredId && merged.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  if (currentConversationId && merged.some((item) => item.id === currentConversationId)) {
    return currentConversationId;
  }
  if (currentConversationId || preferredId) {
    return null;
  }
  if (opts?.skipAutoSelectFirst) {
    return null;
  }
  return merged[0]?.id ?? null;
}
