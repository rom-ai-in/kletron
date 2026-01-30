# VS Code Extension Architecture

The architecture is split into two main layers:

1. **VS Code Extension** – client that runs inside the editor.
2. **Backend API** – existing Next.js app (runs on Node) that hosts all agent logic, file operations and data persistence.

```
+-----------------+          +-------------------------------------+
| VS Code         |<-------> | Backend API (Next.js / Node)        |
| Extension (ts)  |          |                                     |
+-----------------+          +-------------------------------------+
```

* The extension communicates over HTTP/HTTPS (or WebSocket for streaming).
* All heavy‑lifting (agent execution, diff generation, drift analysis) stays in the backend.
* The extension focuses on UI (webview chat panel, tree views, status bar) and local file operations via VS Code APIs.

## File Structure (high level)
```
├─ vscode-extension/          # Extension source
│  ├─ src/
│  │  ├─ extension.ts         # Activation & command registration
│  │  ├─ panels/
│  │  │  └─ ChatPanel.tsx      # Webview panel for chat
│  │  ├─ commands/
│  │  │  └─ connect.ts         # Command to test backend connectivity
│  │  ├─ utils/
│  │  │  └─ backendClient.ts   # HTTP client wrapper
│  │  ├─ package.json
│  │  └─ tsconfig.json
├─ docs/
│  ├─ architecture-vscode.md   # This file
│  ├─ vscode-ui.md
│  ├─ vscode-protocol.md
│  └─ testing-vscode-extension.md
├─ app/
│  └─ page.tsx                  # Static landing screen pointing to the VS Code extension
```

## Runtime Flow

The VS Code extension is the primary entry point for interactive work. The Next.js web workbench has been retired in favor of a landing page (`app/page.tsx`) that simply explains the deprecation and links to the `numezis.studio` Marketplace offering.

```mermaid
graph TD
  A[VS Code Extension] -->|HTTP POST /api/agent/run| B(Backend API)
  B -->|HTTP GET /api/agent/status/{runId}| A
  A -->|HTTP GET /api/editor/file/tree| B
  A -->|HTTP POST /api/editor/file/read| B
  A -->|HTTP POST /api/editor/file/write| B
  B -->|File system + diff/apply helpers| C[Repository Files]
  B -->|Health & metadata| D[Monitoring / Logs]
  A -->|Configuration + commands| E[User Settings / UI]
```

The extension also polls or subscribes to run status updates, surfaces diffs via `vscode.diff`, and sends apply requests back to the backend when the user approves a change.
