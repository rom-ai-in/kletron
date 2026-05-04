"use client";

import { useRef, useEffect } from "react";
import { Message } from "./Message";

interface ThreadFeedProps {
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp?: Date;
    }>;
    isLoading?: boolean;
}

export function ThreadFeed({ messages, isLoading = false }: ThreadFeedProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto pb-4">
            {messages.length === 0 && !isLoading ? (
                <div className="text-center text-subtle py-8">No messages yet</div>
            ) : (
                <>
                    {messages.map((message, index) => (
                        <Message
                            key={index}
                            role={message.role}
                            content={message.content}
                            timestamp={message.timestamp}
                        />
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start mt-4">
                            <div className="bg-surface border border-subtle rounded-lg p-3 max-w-[70%]">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            <div ref={messagesEndRef} />
        </div>
    );
}