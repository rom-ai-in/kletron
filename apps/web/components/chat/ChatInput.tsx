"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Smile } from "lucide-react";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = "Message..." }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || disabled) return;
        onSend(message);
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [message]);

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className="w-full min-h-[40px] max-h-[200px] overflow-y-auto resize-none px-3 py-2 bg-surface border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-surface-disabled disabled:text-subtle"
                />
            </div>

            <button
                type="submit"
                disabled={!message.trim() || disabled}
                className="p-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground disabled:bg-surface-disabled disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-5 h-5" />
            </button>
        </form>
    );
}