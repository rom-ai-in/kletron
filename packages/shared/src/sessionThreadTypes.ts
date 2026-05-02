import type { ThreadApprovalMode } from "./threadApprovalTypes";

/** Pagination slice returned with GET /api/sessions/:id */
export type ConversationPagination = {
  total: number;
  start: number;
  end: number;
  limit?: number;
  hasOlder: boolean;
  hasNewer?: boolean;
  nextBeforeIndex?: number | null;
};

/** Core session detail payload from GET /api/sessions/:id (fields vary by API version). */
export type SessionDetailPayload = {
  id: string;
  graphId?: string;
  title?: string;
  status?: string;
  threadApprovalMode?: ThreadApprovalMode;
  source?: string | null;
  startedAt?: string | null;
  graph?: {
    name: string;
    nodeCount: number;
    nodes: Array<{ id: string; label: string }>;
  } | null;
  conversationHistory?: unknown[];
  nodeOrder?: string[];
  nodeStatuses?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenUsage?: any;
  conversationPagination?: ConversationPagination;
};
