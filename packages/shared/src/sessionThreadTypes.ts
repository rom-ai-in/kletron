import type { ThreadApprovalMode } from "./threadApprovalTypes";
import type { ResearchDepthId } from "./researchDepth";
import type { ThreadSkillState } from "./skills/types";
import type { WorkModeId } from "./workMode";

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

/** Subset of run `state.contextAssembly` exposed to the client for sidebar / debugging. */
export type SessionContextAssemblySlice = {
  dynamicItemCount?: number;
  dynamicSnippetCount?: number;
  summaryCoveredEventCount?: number;
  derivedMemorySync?: {
    updatedPaths?: string[];
    unchangedPaths?: string[];
  };
};

/** Core session detail payload from GET /api/sessions/:id (fields vary by API version). */
export type SessionDetailPayload = {
  id: string;
  /** Persisted run mode (code vs work); drives pop-out and session-aware UI. */
  workMode?: WorkModeId;
  graphId?: string;
  title?: string;
  status?: string;
  threadApprovalMode?: ThreadApprovalMode;
  /** Persisted research depth for this run (new-message UX mirrors web agent). */
  researchDepth?: ResearchDepthId;
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
   
  tokenUsage?: any;
  conversationPagination?: ConversationPagination;
  /** Workspace / thread / graph skill resolution (GET /api/sessions/:id). */
  skills?: ThreadSkillState;
  /** Persisted run state (context assembly, conversation, skills, …). */
  state?: {
    contextAssembly?: SessionContextAssemblySlice;
  } | null;
};
