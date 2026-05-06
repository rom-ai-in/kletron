'use client';

import React, { useMemo } from 'react';
import { Paperclip, Mic } from 'lucide-react';
import { ChatInput } from '../ui/ChatInput';
import type { ContextChip } from '../Agent/ContextChips';

export interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Context chips */
  contextChips?: ContextChip[];
  onDismissChip?: (id: string) => void;
  /** Multimodal paperclip menu */
  onPaperclipClick?: () => void;
  /** Dictation */
  onDictationClick?: () => void;
  /** Agent graph mode selector (Ask / Plan / Code) rendered in footer */
  graphSelector?: React.ReactNode;
  /** Model selector rendered in footer */
  modelSelector?: React.ReactNode;
  /** Per-chat tool policy mode (ThreadApprovalModeSelector) */
  approvalSelector?: React.ReactNode;
  /** Research depth (agent sessions) — same row as graph / LLM on web */
  depthSelector?: React.ReactNode;
  /**
   * When set, replaces the default strip built from graphSelector + modelSelector + approval + depth
   * (e.g. LangGraph vs Codex engine switcher from {@link AgentSessionEngineStrip}).
   */
  sessionStripOverride?: React.ReactNode;
  /** Plan mode badge */
  planMode?: boolean;
  /** True when slash skill chips (or similar) make send valid without textarea text. */
  allowSendWhenEmpty?: boolean;
  /** @deprecated LLM health is shown on the LLM `Selector` (web parity); ignored by this component. */
  connected?: boolean | 'checking';
  /** @deprecated Ignored (see `connected`). */
  connectionLabel?: string;
  className?: string;
}

export function InputBar({
  value,
  onChange,
  onSend,
  onStop,
  sending = false,
  disabled = false,
  placeholder = 'Describe what you want to build...',
  onKeyDown,
  contextChips,
  onDismissChip,
  onPaperclipClick,
  onDictationClick,
  graphSelector,
  modelSelector,
  approvalSelector,
  depthSelector,
  sessionStripOverride,
  planMode = false,
  allowSendWhenEmpty = false,
  connected: _connected = true,
  connectionLabel: _connectionLabel,
  className = '',
}: InputBarProps) {
  const leadingFooter = useMemo(() => {
    if (!onPaperclipClick && !onDictationClick) return null;
    return (
      <>
        {onPaperclipClick && (
          <button
            type="button"
            onClick={onPaperclipClick}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
            title="Attach file, screenshot, or photo"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
        )}
        {onDictationClick && (
          <button
            type="button"
            onClick={onDictationClick}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-state-hover hover:text-text-primary"
            title="Dictation (Ctrl+M)"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        )}
      </>
    );
  }, [onPaperclipClick, onDictationClick]);

  const sessionStrip = useMemo(() => {
    if (sessionStripOverride) return sessionStripOverride;
    if (!graphSelector && !modelSelector && !approvalSelector && !depthSelector) return null;
    return (
      <div className="flex min-w-0 flex-nowrap items-center gap-x-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-elegant sm:gap-x-2">
        {graphSelector}
        {modelSelector}
        {approvalSelector}
        {depthSelector}
      </div>
    );
  }, [sessionStripOverride, graphSelector, modelSelector, approvalSelector, depthSelector]);

  return (
    <div className={`px-4 pb-3 pt-1 ${className}`}>
      {planMode && (
        <div className="mb-1 flex items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/8 px-3 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Plan Mode</span>
          <span className="text-[11px] text-text-muted">Agent will propose a plan without writing code</span>
        </div>
      )}

      <div>
        <ChatInput
          value={value}
          onChange={onChange}
          onSend={onSend}
          onStop={onStop}
          sending={sending}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          leadingFooter={leadingFooter ?? undefined}
          sessionStrip={sessionStrip ?? undefined}
          allowSendWhenEmpty={allowSendWhenEmpty}
          inlineChips={contextChips}
          onDismissInlineChip={onDismissChip}
        />
      </div>
    </div>
  );
}
