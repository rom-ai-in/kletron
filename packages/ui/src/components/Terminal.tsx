"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../hooks/useTheme';

const TERMINAL_WS_URL = 'ws://localhost:3002'; // Port defined in scripts/terminal-worker.ts

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const Terminal: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const { theme } = useTheme();
    const [status, setStatus] = useState<ConnectionStatus>('connecting');

    // Focus the terminal
    const focusTerminal = useCallback(() => {
        if (terminalRef.current) {
            terminalRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (!containerRef.current || terminalRef.current) return;

        const term = new XTerm({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
            lineHeight: 1.2,
            scrollback: 5000,
            theme: {
                background: '#09090b', // zinc-950 (Hardcoded for terminal)
                foreground: '#e4e4e7', // zinc-200
                cursor: '#a1a1aa',     // zinc-400 (more visible)
                cursorAccent: '#09090b',
                selectionBackground: 'rgba(56, 189, 248, 0.3)', // sky-400 selection
                selectionForeground: '#ffffff',
            }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        term.open(containerRef.current);
        terminalRef.current = term;

        // Write welcome message while connecting
        term.writeln('\x1b[90mConnecting to terminal...\x1b[0m');

        // Connect to WebSocket
        const socket = new WebSocket(TERMINAL_WS_URL);
        socketRef.current = socket;

        socket.onopen = () => {
            setStatus('connected');
            term.clear(); // Clear the "connecting" message
            const attachAddon = new AttachAddon(socket);
            term.loadAddon(attachAddon);

            // Fit after connection
            setTimeout(() => {
                fitAddon.fit();
                // Send initial resize
                socket.send(JSON.stringify({
                    type: 'resize',
                    cols: term.cols,
                    rows: term.rows
                }));
                // Auto-focus the terminal
                term.focus();
            }, 100);
        };

        socket.onerror = () => {
            setStatus('error');
            term.writeln('\x1b[31m✗ Failed to connect to terminal server.\x1b[0m');
            term.writeln('\x1b[90mMake sure the terminal worker is running (npm run dev)\x1b[0m');
        };

        socket.onclose = () => {
            if (status !== 'error') {
                setStatus('disconnected');
                term.writeln('\r\n\x1b[33m⚠ Terminal disconnected\x1b[0m');
            }
        };

        // Initial fit
        fitAddon.fit();

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
            terminalRef.current = null;
            socketRef.current = null;
        };
    }, []);

    // Theme updates are handled at initialization for the terminal.
    useEffect(() => {
        if (!terminalRef.current) return;
        // Keep terminal dark for consistent terminal feel
        terminalRef.current.options.theme = {
            background: '#09090b',
            foreground: '#e4e4e7',
            cursor: '#a1a1aa',
            cursorAccent: '#09090b',
            selectionBackground: 'rgba(56, 189, 248, 0.3)',
            selectionForeground: '#ffffff',
        };
    }, [theme]);

    // Re-fit when visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && fitAddonRef.current) {
                setTimeout(() => fitAddonRef.current?.fit(), 100);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return (
        <div
            ref={containerRef}
            className="h-full w-full cursor-text focus:outline-none"
            onClick={focusTerminal}
            style={{ minHeight: '100px' }}
        />
    );
};

