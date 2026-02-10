import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import * as pty from 'node-pty';
import os from 'os';
import fs from 'fs';

const PORT = 3002;

console.log(`🚀 Terminal Worker starting on port ${PORT}...`);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('Client connected to terminal worker');

    // Parse cwd from query string (sent by the Terminal component)
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const requestedCwd = url.searchParams.get('cwd');
    const cwd = requestedCwd && fs.existsSync(requestedCwd) ? requestedCwd : process.cwd();

    // Default shell - use explicit /bin/bash as safer fallback than zsh
    // This is often more reliably in path for spawned processes
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');

    console.log(`Spawning pty with shell: ${shell}, cwd: ${cwd}`);

    // Create pty with error handling
    let ptyProcess;
    try {
        ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd,
            env: process.env as any
        });
    } catch (error) {
        console.error('Failed to spawn pty:', error);
        ws.send('\r\n*** Terminal initialization failed. Shell may not be available. ***\r\n');
        ws.close();
        return;
    }

    // Send data from pty to websocket
    ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`pty exited with code ${exitCode} signal ${signal}`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    // Receive data from websocket to pty
    ws.on('message', (message) => {
        // We expect raw string input for keystrokes, OR a JSON command for resize
        const msgStr = message.toString();

        // Heuristic: if starts with { and contains "cols", it's a resize command
        // This is a simple protocol; xterm-addon-attach sends raw data usually.
        // But for resize we need a custom channel or special handling.
        // Let's assume raw data unless we detect a special prefix we implement in frontend.
        // Actually, xterm-addon-attach doesn't handle resize automatically via WS text frames usually.
        // Example protocol: Text = Input. Binary header = Resize?
        // Let's try to interpret everything as input first.

        // Handling resize: The frontend will send a JSON stringified object if we build it that way.
        // Let's try to parse as JSON first.
        try {
            if (msgStr.startsWith('{')) {
                const parsed = JSON.parse(msgStr);
                if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
                    ptyProcess.resize(parsed.cols, parsed.rows);
                    return;
                }
            }
        } catch (e) {
            // Not JSON, ignore
        }

        ptyProcess.write(msgStr);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        ptyProcess.kill();
    });
});

console.log(`✅ Terminal Worker ready on ws://localhost:${PORT}`);
