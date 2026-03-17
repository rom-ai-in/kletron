# Architecture Overview

## Layout
- `apps/web`: Next.js UI + App Router API routes.
- `apps/cli`: CLI entrypoint for running agent workflows.
- `apps/mcp-server`: MCP tool server (filesystem + repo tooling).
- `apps/desktop`: macOS desktop app (agent UI + diff review).
- `packages/agent-core`: Agent graphs, tools, and workflow orchestration.
- `packages/server`: Server-only services (DB, auth, LLM config, vector search, graph execution).
- `packages/shared`: Cross-cutting types, schemas, and pure utilities.
- `packages/ui`: Reusable UI components, hooks, tokens, and UI-only context.
- `packages/mcp-client`: MCP client wrapper used by server/agent layers.

## Dependency Rules
- `packages/ui` must not import runtime server code (types-only imports are allowed).
- `packages/shared` is pure and has no server/IO dependencies.
- `packages/agent-core` may depend on `packages/shared` and `packages/server` (LLM + graph execution).
- `packages/server` may depend on `packages/shared`, `packages/agent-core`, and `packages/mcp-client`.
- `apps/web` may depend on all `packages/*` (via App Router + server components).

## Data Flow (High Level)
1. UI (`apps/web`) invokes App Router APIs.
2. APIs call `packages/server` services.
3. Server services orchestrate `packages/agent-core` workflows.
4. Agent tooling uses `packages/mcp-client` to call `apps/mcp-server` tools.
5. Outputs are written under `.kletron/` in the target repo.

## Ownership
- Agent logic: `packages/agent-core`
- Data + persistence + external APIs: `packages/server`
- Shared contracts (types/schemas): `packages/shared`
- UI/UX: `packages/ui`
