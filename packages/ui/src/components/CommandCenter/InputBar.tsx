'use client';

import React from 'react';
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
  /** Token usage display */
  tokenUsage?: { input: string; output: string } | null;
  /** Plan mode badge */
  planMode?: boolean;
  /** Connection status dot: true = healthy, false = unhealthy, 'checking' = testing */
  connected?: boolean | 'checking';
  /** Custom tooltip for the status dot */
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
  tokenUsage,
  planMode = false,
  connected = true,
  connectionLabel,
  className = '',
}: InputBarProps) {
  return (
    <div className={`px-4 pb-3 pt-1 ${className}`}>
      {/* Plan mode indicator */}
      {planMode && (
        <div className="flex items-center gap-2 px-3 py-1 mb-1 rounded-lg bg-blue-500/8 border border-blue-500/15">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Plan Mode</span>
          <span className="text-[11px] text-text-muted">Agent will propose a plan without writing code</span>
        </div>
      )}

      {/* Context Chips */}
      {contextChips && contextChips.length > 0 && (
        <div className="pb-1.5">
          <ContextChips chips={contextChips} onDismiss={onDismissChip} size="sm" />
        </div>
      )}

      {/* Input Area */}
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
          footerLeft={
            <div className="flex items-center gap-1">
              {onPaperclipClick && (
                <button
                  type="button"
                  onClick={onPaperclipClick}
                  className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                  title="Attach file, screenshot, or photo"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
              )}
              {onDictationClick && (
                <button
                  type="button"
                  onClick={onDictationClick}
                  className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                  title="Dictation (Ctrl+M)"
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          }
          footerRight={
            <div className="flex items-center gap-2">
              {graphSelector}
              {modelSelector}
              <span
                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  connected === 'checking'
                    ? 'bg-yellow-500 animate-pulse'
                    : connected
                      ? 'bg-status-success'
                      : 'bg-status-error'
                }`}
                title={connectionLabel || (connected === 'checking' ? 'Checking LLM…' : connected ? 'LLM Connected' : 'LLM Disconnected')}
              />
            </div>
          }
        />
        {tokenUsage && (
          <div className="mt-1.5 text-[11px] text-text-muted font-mono">
            Tokens: {tokenUsage.input ?? '—'} in · {tokenUsage.output ?? '—'} out
          </div>
        )}
      </div>
    </div>
  );
}
