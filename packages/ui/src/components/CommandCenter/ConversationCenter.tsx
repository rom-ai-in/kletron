'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Brain, RotateCcw, X, Copy, Check } from 'lucide-react';
import { ToolInvocation } from '../Agent/ToolInvocation';
import { MarkdownRenderer } from '../Agent/MarkdownRenderer';
import { ThinkingBubble } from '../Agent/ThinkingBubble';
import { ThoughtsPanel } from '../Agent/ThoughtsPanel';
import { Textarea } from '../design-system';


export interface ChatEvent {
  id?: string;
  kind: 'user' | 'assistant' | 'tool' | 'system' | 'error';
  role?: string;
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolOutput?: string;
  toolCallId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  thoughts?: string[];
  /** Single block of long-form reasoning (alternative to thoughts array) */
  thinking?: string;
  messageIndex?: number | null;
  local?: boolean;
}

export type RenderItem =
  | { type: 'event'; event: ChatEvent }
  | { type: 'tools'; events: ChatEvent[] };

export interface ConversationCenterProps {
  renderItems: RenderItem[];
  streaming?: boolean;
  streamHasEvents?: boolean;
  /** Progressive streaming text (token-by-token from LLM) */
  streamingText?: string;
  sendError?: string | null;
  conversationLoading?: boolean;
  conversationId?: string | null;
  threadTitle?: string;
  threadUpdatedAt?: string;
  /** Message editing — click-to-edit */
  editingMessageIndex?: number | null;
  editingMessageDraft?: string;
  editingMessageSaving?: boolean;
  editingMessageError?: string | null;
  onStartEdit?: (index: number, content: string) => void;
  /** Called when user wants to resend the edited message */
  onResendEdit?: () => void;
  onCancelEdit?: () => void;
  onEditDraftChange?: (value: string) => void;
  /** Diff review (rendered inline) */
  diffReview?: React.ReactNode;
  /** Show tool calls in compact (single-line) mode */
  compactTools?: boolean;
  /** Empty state */
  emptyState?: React.ReactNode;
  className?: string;
}

export function ConversationCenter({
  renderItems,
  streaming = false,
  streamHasEvents = false,
  streamingText,
  sendError,
  conversationLoading = false,
  conversationId,
  // threadTitle and threadUpdatedAt intentionally omitted — header removed
  editingMessageIndex,
  editingMessageDraft,
  editingMessageSaving = false,
  editingMessageError,
  onStartEdit,
  onResendEdit,
  onCancelEdit,
  onEditDraftChange,
  compactTools = false,
  diffReview,
  emptyState,
  className = '',
}: ConversationCenterProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [renderItems, streaming]);

  // Empty state when no conversation is loaded
  if (!conversationId && !streaming && renderItems.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-4 text-text-muted ${className}`}>
        {emptyState ?? (
          <>
            <Brain className="w-14 h-14 opacity-15" />
            <div className="text-center">
              <div className="text-base font-medium text-text-secondary">Command Center</div>
              <div className="text-[13px] mt-1.5 text-text-muted">Start a new thread or select one from the sidebar</div>
            </div>
            <div className="flex flex-col gap-1.5 text-[12px] mt-3">
              <span>
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px]">⌘N</kbd> New Thread
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px]">⌘B</kbd> Toggle Sidebar
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px]">/</kbd> Command Menu
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto px-6 py-6 scrollbar-elegant scroll-smooth ${className}`}>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Loading state */}
        {conversationLoading && (
          <div className="border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted rounded-md">
            Loading thread...
          </div>
        )}

        {/* Messages */}
        {renderItems.map((item, idx) => {
          if (item.type === 'tools') {
            // Pair tool-call events with their results.
            // Handles both NEW data (AI call → kind="assistant") and
            // LEGACY data (AI call → kind="tool" with toolArgs and empty content).
            // Uses toolCallId/toolName matching (not sequential order) for multi-tool-call support.
            const isCall = (e: ChatEvent) =>
              (e.kind === 'assistant' && Boolean(e.toolName)) ||
              (e.kind === 'tool' && Boolean(e.toolArgs) && !e.content?.trim());

            const calls: ChatEvent[] = [];
            const results: ChatEvent[] = [];
            for (const e of item.events) {
              if (isCall(e)) calls.push(e);
              else results.push(e);
            }

            const pairs: { call?: ChatEvent; result?: ChatEvent }[] = [];
            const usedResults = new Set<number>();
            for (const call of calls) {
              let matchIdx = -1;
              if (call.toolCallId) {
                matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolCallId === call.toolCallId);
              }
              if (matchIdx === -1 && call.toolName) {
                matchIdx = results.findIndex((r, i) => !usedResults.has(i) && r.toolName === call.toolName);
              }
              if (matchIdx === -1) {
                matchIdx = results.findIndex((_, i) => !usedResults.has(i));
              }
              if (matchIdx >= 0) {
                usedResults.add(matchIdx);
                pairs.push({ call, result: results[matchIdx] });
              } else {
                pairs.push({ call });
              }
            }
            for (let i = 0; i < results.length; i++) {
              if (!usedResults.has(i)) {
                pairs.push({ result: results[i] });
              }
            }
            return (
              <div key={`tools-${idx}`}>
                {pairs.map((pair, i) => (
                  <ToolInvocation
                    key={`tools-${idx}-${i}`}
                    name={pair.call?.toolName ?? pair.result?.toolName ?? 'tool'}
                    args={pair.call?.toolArgs}
                    output={pair.result?.toolOutput ?? pair.result?.content}
                    compact={compactTools}
                  />
                ))}
              </div>
            );
          }

          const event = item.event;
          const isUser = event.kind === 'user';
          const isAssistant = event.kind === 'assistant' && !event.toolName;
          const isSystem = event.kind === 'system';

          if (isSystem) {
            return (
              <div key={`sys-${idx}-${event.id ?? 'msg'}`} className="px-1 py-1.5 text-[11px] text-text-muted">
                {event.content}
              </div>
            );
          }
          if (!isUser && !isAssistant) return null;

          const isEditing =
            typeof event.messageIndex === 'number' &&
            event.messageIndex === editingMessageIndex;

          const canEdit =
            isUser &&
            conversationId &&
            !streaming &&
            typeof event.messageIndex === 'number';

          return (
            <div key={`event-${idx}-${event.id ?? 'msg'}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`group max-w-[85%] rounded-xl px-4 py-3 text-[14px] leading-relaxed transition-all duration-200 ${
                  isUser
                    ? isEditing
                      ? 'border border-brand-primary/40 bg-white/[0.06] text-text-primary ring-1 ring-brand-primary/20'
                      : 'bg-white/[0.04] text-text-primary hover:bg-white/[0.06] cursor-text'
                    : 'bg-transparent text-text-secondary pl-0'
                }`}
                onClick={() => {
                  if (canEdit && !isEditing) {
                    onStartEdit?.(event.messageIndex!, event.content || '');
                  }
                }}
                title={canEdit && !isEditing ? 'Click to edit and resend' : undefined}
              >
                {/* Message content */}
                <div className="min-w-0 relative">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingMessageDraft ?? ''}
                        onChange={(e) => onEditDraftChange?.(e.target.value)}
                        disabled={editingMessageSaving}
                        noResize
                        className="!bg-transparent !border-none !ring-0 !shadow-none !p-0 text-[14px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            onResendEdit?.();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancelEdit?.();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
                        <span className="text-[10px] text-text-muted">
                          <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[9px] font-mono">⌘↵</kbd> resend · <kbd className="px-1 py-0.5 rounded bg-bg-elevated border border-border-subtle text-[9px] font-mono">esc</kbd> cancel
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCancelEdit?.(); }}
                            disabled={editingMessageSaving}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onResendEdit?.(); }}
                            disabled={editingMessageSaving}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Resend
                          </button>
                        </div>
                      </div>
                      {editingMessageError && (
                        <div className="text-[10px] text-status-error-text">{editingMessageError}</div>
                      )}
                    </div>
                  ) : isAssistant ? (
                    <>
                      {/* Thoughts / reasoning panel (collapsible) — same logic as MessageList */}
                      {event.thoughts && event.thoughts.length > 0 ? (
                        <div className="mb-1.5">
                          <ThoughtsPanel thoughts={event.thoughts} />
                        </div>
                      ) : event.thinking ? (
                        <div className="mb-1.5">
                          <ThoughtsPanel thoughts={[event.thinking]} isReasoning />
                        </div>
                      ) : null}
                      <MarkdownRenderer content={event.content ?? ''} />
                      {/* Copy button — appears on hover */}
                      {event.content && (
                        <button
                          type="button"
                          onClick={() => handleCopy(event.id ?? `msg-${idx}`, event.content!)}
                          className="absolute -top-1 right-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary hover:bg-white/5"
                          title={copiedId === (event.id ?? `msg-${idx}`) ? 'Copied!' : 'Copy message'}
                        >
                          {copiedId === (event.id ?? `msg-${idx}`) ? (
                            <Check className="w-3.5 h-3.5 text-status-success-text" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    event.content
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Inline diff review */}
        {diffReview}

        {/* Progressive text streaming — show accumulated tokens with cursor */}
        {streaming && streamingText && (
          <div className="rounded-xl px-4 py-3 text-[14px] bg-transparent text-text-secondary">
            <MarkdownRenderer content={streamingText} />
            <span className="inline-block w-[2px] h-[14px] bg-text-muted align-text-bottom ml-0.5 animate-pulse" />
          </div>
        )}
        {/* Thinking indicator (shown when streaming but no progressive text yet) */}
        {streaming && !streamingText && !streamHasEvents && <ThinkingBubble isActive summary="Working on it..." />}
        {streaming && !streamingText && streamHasEvents && <ThinkingBubble isActive summary="Agent is running..." />}

        {/* Error */}
        {sendError && (
          <div className="border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-text rounded-md">
            {sendError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
