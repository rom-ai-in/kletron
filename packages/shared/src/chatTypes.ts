// ─── Canonical Chat Types ─────────────────────────────────────────────────────
// Single source of truth for thread/message/conversation types.
// All consumers (desktop, web, UI components) import from here.

/** Kind discriminator for chat events. */
export type ChatEventKind = 'user' | 'assistant' | 'tool' | 'system' | 'error';

/**
 * Canonical ChatEvent — represents any message-level event in a conversation.
 * Merge of desktop `types.ts`, `MessageList.tsx`, and `ConversationCenter.tsx`.
 */
export interface ChatEvent {
    id?: string;
    kind: ChatEventKind;
    role?: 'user' | 'assistant' | 'tool' | 'system';
    content?: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
    toolCallId?: string;
    /** Whether this tool result is an error (explicit server signal). */
    isError?: boolean;
    timestamp?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    /** Array of internal reasoning steps (extracted from <think> blocks). */
    thoughts?: string[];
    /** Single block of long-form reasoning (alternative to thoughts array). */
    thinking?: string;
    /** Opaque index for edit controls — passed through to actions slot. */
    messageIndex?: number | null;
    /** True when the event was created optimistically on the client. */
    local?: boolean;
}

/**
 * Grouped render item — either a standalone message or a batch of tool events.
 */
export type RenderItem =
    | { type: 'event'; event: ChatEvent }
    | { type: 'tools'; events: ChatEvent[] };

/**
 * Server-side agent event shape — used for deserializing raw events from the API.
 */
export interface ServerAgentEvent {
    id?: string;
    kind?: ChatEventKind;
    role?: string;
    content?: string;
    /** Tool name — set by backend guessToolName() */
    name?: string;
    toolName?: string;
    toolCallId?: string;
    toolArgs?: string;
    toolOutput?: string;
    isError?: boolean;
    timestamp?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    thoughts?: string[];
}

/** Streaming state machine for the UI. */
export type StreamingState = 'idle' | 'streaming' | 'stopped' | 'error';

/** Stream status (alias used by web app). */
export type StreamStatus = StreamingState;

/** Live status for a thread in the sidebar. */
export type ThreadLiveStatus = 'running' | 'completed' | 'idle' | 'waiting' | 'error';

/**
 * Map GET /api/sessions row `status` plus local streaming to {@link ThreadLiveStatus}.
 * Used by web agent and desktop so sidebar dots match server run state.
 */
export function sessionStatusToSidebarLiveStatus(
    status: string | undefined,
    isStreaming: boolean,
): ThreadLiveStatus {
    if (isStreaming) return 'running';
    const s = (status ?? '').toUpperCase();
    switch (s) {
        case 'RUNNING':
            return 'running';
        case 'COMPLETED':
            return 'completed';
        case 'FAILED':
            return 'error';
        case 'PAUSED':
        case 'PENDING':
            return 'waiting';
        case 'CANCELLED':
            return 'idle';
        default:
            return 'idle';
    }
}

/**
 * NDJSON stream chunk types — shared between server routes and client parsers.
 */
import type { AgentWorkflowResult, AgentWorkflowUpdate } from './types';
import type { ThreadApprovalMode } from './threadApprovalTypes';
import type { WorkModeId } from './workMode';
import type { ResearchDepthId } from './researchDepth';

/**
 * Per-`streamReactAgentMessages` KPIs (one NDJSON `stream_metrics` chunk per invocation).
 * Use for diagnosing slow send → first token vs LM generation throughput.
 */
export type AgentStreamKpiV1 = {
    v: 1;
    runId?: string;
    agentName: string;
    provider: string;
    model: string;
    /** LangGraph stream mode */
    streamMode: 'values' | 'values_messages';
    /** ms: entry → LLM resolved + chat model constructed */
    llmResolveAndModelMs: number;
    /** ms: entry → after `createReactAgent` */
    agentBuildMs: number;
    /** ms: entry → `agent.stream()` returned (iterator ready) */
    streamOpenMs: number;
    /** ms: entry → first `for await` body (first event from graph stream) */
    firstStreamEventMs: number | null;
    /** Token-style streaming only (not LM Studio values-only path) */
    firstTextDeltaMs: number | null;
    firstReasoningDeltaMs: number | null;
    /** Values-only / full-message path: first assistant message passed to `onMessage` */
    firstAssistantOnMessageMs: number | null;
    /** min(firstTextDelta, firstReasoning, firstAssistantOnMessage) — UX “time to first visible” */
    timeToFirstVisibleMs: number | null;
    /** Wall ms for entire `for await` loop */
    streamLoopMs: number;
    /** ms from first stream event to loop end (pure “generation” window); null if no events */
    generationWindowMs: number | null;
    /** Sum of string lengths passed to `onTextDelta` */
    outputDeltaChars: number;
    /** From LangChain `usage_metadata` when present */
    outputTokensFromUsage: number;
    /** Heuristic: outputDeltaChars / 4 */
    approxOutputTokensFromChars: number;
    /** outputTokensFromUsage / (streamLoopMs/1000) when usage > 0 */
    effectiveOutputTps: number | null;
    effectiveOutputTpm: number | null;
    /** Same as effective* but using generationWindowMs */
    generationTps: number | null;
    generationTpm: number | null;
    /** Executor prep before this call (executeRunStreaming wall clock) */
    upstreamPrepMs?: number;
    /** Executor wall ms from run start to this stream finishing */
    wallMsExecutorToStreamEnd?: number;
    /** Count of tool messages in the final LangGraph transcript (successful stream). */
    toolCallCount?: number;
};

export type StreamChunk =
    | { type: 'init'; payload: { runId: string; graphId: string } }
    | { type: 'update'; payload: AgentWorkflowUpdate }
    | { type: 'text_delta'; payload: { content: string } }
    | { type: 'reasoning_delta'; payload: { content: string } }
    | { type: 'stream_metrics'; payload: AgentStreamKpiV1 }
    | { type: 'activity'; payload: { label?: string; detail?: string } }
    | { type: 'final'; payload: AgentWorkflowResult }
    | { type: 'error'; payload: { message: string } };

/** Conversation history item (thread list). */
export interface ConversationHistoryItem {
    id: string;
    title: string;
    updatedAt?: string;
    /** Legacy `active`/`archived` or agent graph run status (`RUNNING`, `COMPLETED`, …). */
    status?: string;
    lastRole?: 'user' | 'assistant' | 'system' | 'tool';
    /** Run creation mode; omitted on older clients until API returns it. */
    workMode?: WorkModeId;
    /** Exhaustive (default) vs fast agent depth; omitted on older runs. */
    researchDepth?: ResearchDepthId;
}

/** Conversation detail (thread detail with history). */
export interface ConversationDetail extends ConversationHistoryItem {
    messages?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
    conversationHistory?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
    threadApprovalMode?: ThreadApprovalMode;
    source?: string | null;
}

/** Message type for the web-app simple chat view. */
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: string;
    toolName?: string;
    toolArgs?: string;
    toolOutput?: string;
    toolCallId?: string;
    isError?: boolean;
    thoughts?: string[];
    thinking?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}
