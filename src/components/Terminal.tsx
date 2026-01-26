"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../hooks/useTheme';

const TERMINAL_WS_URL = 'ws://localhost:3002'; // Port defined in scripts/terminal-worker.ts

export const Terminal: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const { theme } = useTheme();

    useEffect(() => {
        if (!containerRef.current || terminalRef.current) return;

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#09090b', // zinc-950 (Hardcoded for terminal)
                foreground: '#e4e4e7', // zinc-200
                cursor: '#71717a',     // zinc-500
                selectionBackground: 'rgba(255, 255, 255, 0.16)',
            }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Connect to WebSocket
        const socket = new WebSocket(TERMINAL_WS_URL);
        const attachAddon = new AttachAddon(socket);
        term.loadAddon(attachAddon);

        term.open(containerRef.current);
        fitAddon.fit();
        terminalRef.current = term;

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'resize',
                    cols: term.cols,
                    rows: term.rows
                }));
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            term.dispose();
            socket.close();
            resizeObserver.disconnect();
        };
    }, []);

    // Theme updates are handled at initialization for the terminal.
    // In a multi-theme app, we would re-run term.options.theme here.
    useEffect(() => {
        if (!terminalRef.current) return;
        // Keep terminal dark for consistent terminal feel
        terminalRef.current.options.theme = {
            background: '#09090b',
            foreground: '#e4e4e7',
            cursor: '#71717a',
            selectionBackground: 'rgba(255, 255, 255, 0.16)',
        };
    }, [theme]);

    return <div ref={containerRef} className="h-full w-full" />;
};
