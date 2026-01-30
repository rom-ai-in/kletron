# Testing the VS Code Extension

## Unit Tests
- Use `@vscode/test-electron` or `vitest` for node‑based tests.
- Focus on `BackendClient` (base URL normalization, header injection, happy-path polling), command registrations, and the `AgentTreeProvider` refresh cycle.
- Add a lightweight mock of the backend to simulate `/api/agent/run` responses so the `ChatPanel` logic can be exercised without hitting a real server.

## Integration Tests
1. Start the Next.js dev server (`pnpm dev`).
2. In the extension workspace (`vscode-extension/`), run `npm run compile`.
3. Launch the VS Code test runner (`pnpm vscode:test` or `npm run test` depending on the workspace) that:
   - Starts a headless VS Code instance.
   - Installs the compiled extension.
   - Executes `numezis.connectBackend` (optionally pointed at a mock backend) and asserts the status bar text/content updates.
   - Opens the Chat panel, submits a prompt, and confirms the panel receives status updates plus a diff hunk.

## End‑to‑End Manual Flow
1. Install the extension from the Marketplace (`numezis.studio`) or via a generated `.vsix`.
2. Open VS Code, configure `numezis.backendUrl` (and optionally `numezis.apiToken`).
3. Run **Numezis: Open Chat** and type a prompt; watch the React-based webview stream responses and surface the diff preview.
4. Review the proposed diff through the automatically opened VS Code diff editor, and click the **Apply diff** button to send the patch to `/api/agent/apply/{runId}`.
5. Browse the Numezis tree view to see the run history and reapply diffs via the context menu.
6. Confirm the Next.js landing page (`/`) now shows the deprecation banner and links to the VS Code extension, ensuring no editors remain on the public workbench.
