'use client';

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * macOS-style traffic light buttons (close, minimize, maximize).
 * Uses the standard macOS traffic light colors intentionally.
 */
export interface TrafficLightsProps {
    className?: string;
}

export const TrafficLights: React.FC<TrafficLightsProps> = ({ className }) => {
    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
    );
};
