'use client';

import React, { useMemo } from 'react';
import { Paperclip, Mic } from 'lucide-react';
import { ChatInput } from '../ui/ChatInput';
import { ContextChips } from '../Agent/ContextChips';
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
  /** Thread approval mode (agent sessions) */
  approvalSelector?: React.ReactNode;
  /** Research depth (agent sessions) — same row as graph / LLM on web */
  depthSelector?: React.ReactNode;
  /** Token usage display */
  tokenUsage?: { input: string; output: string } | null;
  /** Plan mode badge */
  planMode?: boolean;
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
  tokenUsage,
  planMode = false,
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
    if (!graphSelector && !modelSelector && !approvalSelector && !depthSelector) return null;
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {graphSelector}
        {modelSelector}
        {approvalSelector}
        {depthSelector}
      </div>
    );
  }, [graphSelector, modelSelector, approvalSelector, depthSelector]);

  return (
    <div className={`px-4 pb-3 pt-1 ${className}`}>
      {planMode && (
        <div className="mb-1 flex items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/8 px-3 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Plan Mode</span>
          <span className="text-[11px] text-text-muted">Agent will propose a plan without writing code</span>
        </div>
      )}

      {contextChips && contextChips.length > 0 && (
        <div className="pb-1.5">
          <ContextChips chips={contextChips} onDismiss={onDismissChip} size="sm" />
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
        />
        {tokenUsage && (
          <div className="mt-1.5 font-mono text-[11px] text-text-muted">
            Tokens: {tokenUsage.input ?? '—'} in · {tokenUsage.output ?? '—'} out
          </div>
        )}
      </div>
    </div>
  );
}
