'use client';

import React, { forwardRef, useEffect, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { buttonVariants } from './Button';

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

    const sendStopButton =
      showSendButton && (onSend || onStop) ? (
        <button
          type="button"
          onClick={sending ? onStop : onSend}
          disabled={!sending && !canSend}
          className={cn(
            buttonVariants({
              variant: sending ? 'danger' : 'primary',
              size: 'icon',
            }),
            'z-20 shrink-0 transition-transform duration-200 active:scale-95'
          )}
          aria-label={sending ? 'Stop generation' : 'Send message'}
        >
          {sending ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      ) : null;

    return (
      <div
        className={cn(
          'relative min-w-0 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5 shadow-lg transition-all duration-200 focus-within:border-white/[0.14] focus-within:bg-white/[0.05] focus-within:shadow-xl',
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
            'w-full resize-none border-none bg-transparent p-0 text-[14px] font-medium text-text-primary outline-none focus:ring-0',
            'placeholder:text-text-muted/50 scrollbar-elegant',
            inputClassName
          )}
          {...props}
        />

        {(footerLeft || footerRight || showSendButton) && (
          <div className="relative mt-2.5 min-h-8 min-w-0">
            <div
              className={cn(
                'flex min-w-0 items-center gap-2',
                sendStopButton && 'pr-10'
              )}
            >
              {/* Do not use overflow-hidden here: Selector menus are position:absolute and open upward — clipping would hide them. */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">{footerLeft}</div>
              {footerRight}
            </div>
            {sendStopButton && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center">
                <div className="pointer-events-auto">{sendStopButton}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
