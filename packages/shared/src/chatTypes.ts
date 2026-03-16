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
 * NDJSON stream chunk types — shared between server routes and client parsers.
 */
import type { AgentWorkflowResult, AgentWorkflowUpdate } from './types';

export type StreamChunk =
    | { type: 'init'; payload: { runId: string; graphId: string } }
    | { type: 'update'; payload: AgentWorkflowUpdate }
    | { type: 'text_delta'; payload: { content: string } }
    | { type: 'final'; payload: AgentWorkflowResult }
    | { type: 'error'; payload: { message: string } };

/** Conversation history item (thread list). */
export interface ConversationHistoryItem {
    id: string;
    title: string;
    updatedAt?: string;
    status?: 'active' | 'archived';
    lastRole?: 'user' | 'assistant' | 'system' | 'tool';
}

/** Conversation detail (thread detail with history). */
export interface ConversationDetail extends ConversationHistoryItem {
    messages?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
    conversationHistory?: Array<ServerAgentEvent & { kind?: string; role?: string; content?: string }>;
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
