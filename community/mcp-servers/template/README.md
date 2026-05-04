# MCP server template (community)

Fork this folder when adding a **workspace MCP** example. Production Kletron loads external MCP servers per workspace (stdio, SSE, or streamable HTTP).

## What you ship

1. A small process that speaks **MCP** (see [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)).
2. Tools namespaced logically — Kletron surfaces them as `yourSlug__toolName` when registered.
3. A README with transport, env vars, and a one-line test (`curl` or `npx`).

## Reference implementation in-repo

Study the bundled server: [`apps/mcp-server`](../../apps/mcp-server) (especially `tools/` and transport wiring).

## Minimal layout

```
template/
  README.md          ← you are here
  package.json       ← optional: "type": "module", deps on @modelcontextprotocol/sdk
  src/server.ts      ← your MCP entry (create yourself from SDK docs)
```

This template intentionally does **not** ship runnable TypeScript so we don’t fight SDK version drift in CI. Copy the layout, add `src/server.ts` from the official SDK “server” example, then open a PR.

## Checklist before PR

- [ ] Documented how to register the server in Kletron (workspace connectors UI path or API shape — link to main docs / `docs/README-archive.md`).
- [ ] No hard-coded API keys.
- [ ] States whether tools are read-only or can write to disk.
