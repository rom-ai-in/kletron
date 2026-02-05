# Contributing

## Where New Code Goes
- **UI components / hooks**: `packages/ui`
- **Shared types & schemas**: `packages/shared`
- **Server logic (DB, auth, vector, LLM config)**: `packages/server`
- **Agent graphs / tools / workflows**: `packages/agent-core`
- **MCP client wrapper**: `packages/mcp-client`
- **Next.js routes & pages**: `apps/web`
- **CLI**: `apps/cli`
- **MCP server tools**: `apps/mcp-server`
- **VS Code extension**: `apps/vscode-extension`

## Boundaries
- UI code must not import runtime server modules (types-only imports are fine).
- Shared package stays pure (no filesystem, network, or DB code).
- Prefer importing from `@numezis/*` aliases instead of deep relative paths.

## Scripts
- `npm run dev` launches MCP server + LangGraph dev + web UI.
- `npm run start` launches MCP server + CLI.
- `npm run typecheck` runs TypeScript type checks across the workspace.

## Adding a New Package
1. Create `packages/<name>/package.json` and `packages/<name>/src`.
2. Add path aliases in `tsconfig.base.json`.
3. Add to `apps/*/package.json` dependencies if used.
