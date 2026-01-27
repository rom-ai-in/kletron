"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Terminal } from '../Terminal';
import {
    Terminal as TerminalIcon,
    X,
    Maximize2,
    Minimize2,
    ChevronUp,
    ChevronDown,
    Plus,
    MoreHorizontal
} from 'lucide-react';

interface TerminalPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 250;
const MAX_HEIGHT_RATIO = 0.7; // Max 70% of viewport

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
    isOpen,
    onToggle,
    onClose,
}) => {
    const [height, setHeight] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedHeight = localStorage.getItem('terminalPanelHeight');
            return savedHeight ? parseInt(savedHeight, 10) : DEFAULT_HEIGHT;
        }
        return DEFAULT_HEIGHT;
    });
    const [isMaximized, setIsMaximized] = useState(false);
    const [previousHeight, setPreviousHeight] = useState(DEFAULT_HEIGHT);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    // Handle resize drag
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        const startY = e.clientY;
        const startHeight = height;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = startY - e.clientY;
            const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
            const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + delta));
            setHeight(newHeight);
            setIsMaximized(false);
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            localStorage.setItem('terminalPanelHeight', height.toString());
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [height]);

    // Toggle maximize
    const handleMaximize = useCallback(() => {
        if (isMaximized) {
            setHeight(previousHeight);
            setIsMaximized(false);
        } else {
            setPreviousHeight(height);
            setHeight(window.innerHeight * MAX_HEIGHT_RATIO);
            setIsMaximized(true);
        }
    }, [isMaximized, height, previousHeight]);

    // Save height on change
    useEffect(() => {
        if (!isMaximized) {
            localStorage.setItem('terminalPanelHeight', height.toString());
        }
    }, [height, isMaximized]);

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            className="flex flex-col bg-[#0a0a0a] border-t border-zinc-800/80 animate-in slide-in-from-bottom-4 duration-200"
            style={{ height: `${height}px` }}
        >
            {/* Resize Handle */}
            <div
                className="h-[3px] w-full cursor-row-resize group hover:bg-sky-500/50 transition-colors relative"
                onMouseDown={handleMouseDown}
            >
                <div className="absolute inset-x-0 -top-1 -bottom-1" /> {/* Extended hit area */}
            </div>

            {/* Terminal Header - VS Code Style */}
            <div className="h-9 flex items-center justify-between border-b border-zinc-800/60 bg-[#0d0d0d] px-1">
                {/* Left: Tabs */}
                <div className="flex items-center gap-0.5">
                    {/* Active Terminal Tab */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0a] border-t-2 border-t-sky-500/70 text-text-primary text-xs font-medium rounded-t-sm relative group">
                        <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-300">Terminal</span>
                        <button
                            onClick={onClose}
                            className="ml-1 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
                            title="Close Terminal"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Add Terminal Button */}
                    <button
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
                        title="New Terminal"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-0.5">
                    {/* Toggle Panel Size */}
                    <button
                        onClick={handleMaximize}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
                        title={isMaximized ? "Restore Panel Size" : "Maximize Panel"}
                    >
                        {isMaximized ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                        )}
                    </button>

                    {/* Minimize/Hide Panel */}
                    <button
                        onClick={onToggle}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
                        title="Hide Panel (⌘`)"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Close Panel */}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
                        title="Close Panel"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 min-h-0 overflow-hidden p-1">
                <Terminal />
            </div>
        </div>
    );
};

/**
 * Terminal Toggle Button - To be used in status bar or header
 */
interface TerminalToggleButtonProps {
    isOpen: boolean;
    onClick: () => void;
}

export const TerminalToggleButton: React.FC<TerminalToggleButtonProps> = ({
    isOpen,
    onClick,
}) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-150 ${isOpen
                    ? 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`}
            title={isOpen ? "Hide Terminal (⌘`)" : "Show Terminal (⌘`)"}
        >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal</span>
            {!isOpen && (
                <kbd className="hidden md:inline text-[10px] px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">⌘`</kbd>
            )}
        </button>
    );
};

export default TerminalPanel;
