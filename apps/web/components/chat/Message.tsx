"use client";

import { format } from "date-fns";

interface MessageProps {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

export function Message({ role, content, timestamp }: MessageProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${isUser ? 'bg-primary text-white' : 'bg-surface border border-subtle'}`}
            >
                {content}
                {timestamp && (
                    <div className="text-xs mt-1 opacity-60">
                        {format(timestamp, 'h:mm a')}
                    </div>
                )}
            </div>
        </div>
    );
}