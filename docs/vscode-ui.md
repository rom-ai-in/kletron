# VS Code Extension UI Design

The extension will expose several UI surfaces:

## 1. Chat / Agent Panel
- Webview panel (`ChatPanel.tsx`)
- Shows conversation history, input box, action buttons.
- Communicates with extension via `postMessage`.
- Renders React-based controls (messages list, prompt/agent inputs) and streams backend responses in real time.
- Includes a small status badge, embedded diff preview, and an **Apply diff** action that forwards the latest hunk to the backend.

## 2. Explorer / Tree View
- `AgentTreeProvider.ts`
- Lists active agents, runs, audits.
- Commands on items: open chat panel, run analysis, apply diff.
- Each run node shows its current status and exposes `contextValue == agentRun` so the tree menu can trigger `numezis.applyDiff` with the selected `runId`.

## 3. Status Bar & Commands
- Status bar item shows connection status.
- Global commands (in `package.json`):
  - `numezis.connectBackend`
  - `numezis.openChat`
  - `numezis.runDriftAnalysis`
- `numezis.applyDiff` is also exposed so a tree context item and keyboard shortcut can reapply a diff without reopening the chat.
- The status bar reflects the stored `numezis.backendUrl` configuration and prompts the user to reconnect when the backend URL is empty.

## 4. Diff & Edit UI
- Uses `vscode.workspace.applyEdit` or `vscode.commands.executeCommand('vscode.diff')`.
- Diff view shows proposed changes from backend.
- After a run completes the extension fetches `/api/agent/diff/{runId}`, opens a diff editor (empty “before” document vs. diff hunk), and caches the latest hunk so the chat panel can trigger `applyDiff` without refetching.

## 5. Settings
- `backendUrl` (string)
- API token (required). Copy it from the Numezis Code account page (`/account`).
- Settings are surfaced under `numezis.backendUrl` and `numezis.apiToken`; changes are persisted globally so the `connectBackend` command can pre-fill the last URL/token pair.
