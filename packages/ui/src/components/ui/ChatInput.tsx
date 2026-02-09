'use client';

import React, { forwardRef, useEffect, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ChatInputProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  sending?: boolean;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  maxHeight?: number;
  showSendButton?: boolean;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      onStop,
      sending = false,
      footerLeft,
      footerRight,
      containerClassName,
      inputClassName,
      maxHeight = 160,
      showSendButton = true,
      placeholder = 'Ask anything…',
      className,
      disabled,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      const node = innerRef.current;
      if (!node) return;
      node.style.height = 'auto';
      const nextHeight = Math.min(node.scrollHeight, maxHeight);
      node.style.height = `${nextHeight}px`;
    }, [value, maxHeight]);

    const setRefs = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    };

    const canSend = !!value.trim() && !disabled;

    return (
      <div
        className={cn(
          'rounded-xl border border-border-subtle bg-bg-elevated p-3 shadow-sm transition focus-within:border-border-strong',
          containerClassName,
          className
        )}
      >
        <textarea
          ref={setRefs}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className={cn(
            'w-full resize-none border-none bg-transparent p-0 text-[13px] font-medium text-text-primary outline-none focus:ring-0',
            'placeholder:text-text-muted/60 scrollbar-elegant',
            inputClassName
          )}
          {...props}
        />

        {(footerLeft || footerRight || showSendButton) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {footerLeft}
            </div>
            <div className="flex items-center gap-2">
              {footerRight}
              {showSendButton && (onSend || onStop) && (
                <button
                  type="button"
                  onClick={sending ? onStop : onSend}
                  disabled={!sending && !canSend}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200',
                    sending
                      ? 'bg-bg-surface border border-border-subtle text-status-error-text scale-110 active:scale-95'
                      : 'bg-text-primary text-bg-surface hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed'
                  )}
                  aria-label={sending ? 'Stop generation' : 'Send message'}
                >
                  {sending ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
