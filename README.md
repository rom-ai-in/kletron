# Numezis Code (TypeScript LangGraph)

This repo houses a **Node/TypeScript LangGraph multi-agent pipeline** backed by a local MCP server. `npm run dev` starts the MCP server, LangGraph dev server, and the Next.js UI.

## Architecture

- **Agent core** (`packages/agent-core`): Workflow orchestration + agent tooling.
- **Server services** (`packages/server`): DB/auth/LLM config, vector search, agent graph execution.
- **Shared contracts** (`packages/shared`): Types + schemas used across UI and server.
- **UI** (`packages/ui`) + **Web app** (`apps/web`): Next.js UI + App Router APIs.
- **MCP Server** (`apps/mcp-server`): All inspection/editing actions are routed through the MCP server.

### Pipeline outputs (written via MCP)

Artifacts are written into the target repo under `.numezis/`:

- `.numezis/meta.json`
- `.numezis/tasks.json`
- `.numezis/report.md`

### Next.js agent dashboard (Tailwind-powered)

- `apps/web/app/page.tsx` renders a staged chat UI that submits to `/api/chat`.
- `/api/chat` reuses the same Phase 1..4 logic and returns timeline events, meta/findings/tasks, and the final report summary.
- The graph dropdown now exposes "Simple ReAct agent" as a quick alternative; the same graph is registered in `langgraph.json` so LangGraph can run it locally.
- The sidebar exposes `/api/tools/*` metadata so you can click any MCP tool and see the raw `apps/mcp-server/tools` implementation.
- The UI now uses Tailwind CSS (see `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`, `apps/web/app/globals.css`) for the Cursor-style layout.

## Setup

1. Install Node dependencies:
   ```bash
   npm install
   ```
2. Configure `.env` (copy from `env.example`) with your Azure OpenAI credentials and set the target repo root via `GITHUB_MCP_DEFAULT_DIR`.
3. Start MCP + LangGraph dev server (which now also launches the Next.js UI):
   ```bash
   npm run dev
   ```
   This reclaims ports `9000` (MCP) and `8080` (LangGraph dev), launches both services, and waits for readiness.
   MCP runs over SSE at `http://localhost:9000/sse` (the LangGraph graph connects via `MCP_URL`).
   The command also spins up `npm run dev:web` automatically and waits for `http://localhost:3000` to respond before reporting success.

4. (Optional) Start the Next.js UI separately if you need to keep it running alone:
   ```bash
   npm run dev:web
   ```
   When you already run `npm run dev`, the UI is started for you so you can just visit http://localhost:3000 to chat with the LangGraph pipeline. This command is only needed if you want the UI without the backend services.

If `GITHUB_MCP_DEFAULT_DIR` is missing, `npm run dev`/`npm run dev:web` will stop with an error instead of silently using the current directory.

## Running the Agent

```bash
npm start
```

`npm start` frees ports `9000` / `8080`, launches the MCP server (MCP tooling) on port `9000`, and then runs the interactive CLI (`apps/cli/src/index.ts`). Type `exit` to quit.


For iterative development, use `npm run dev`. It reclaims ports 9000/8080, launches `mcp-server`, and starts `@langchain/langgraph-cli dev` on port 8080.

## Environment Variables

- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_MODEL`, `AZURE_OPENAI_MAX_TOKENS`: Provide your Azure credentials.
- `GITHUB_MCP_DEFAULT_DIR` (preferred) / `MCP_DEFAULT_DIR`: Root path the MCP server should service. This repo’s scripts resolve the target root from these vars and pass it to both `mcp-server` and the agent so all tool calls stay focused on that repository.

## MCP Tooling

The TypeScript agent uses the MCP `tools/call` interface through `packages/agent-core/src/tools/mcpTools.ts`. Tools are exposed to the React agent as LangChain tools with `zod` schemas, ensuring all repository interactions are captive to the MCP server.

## Notes

- `apps/mcp-server` is the **only** tool provider—no more local filesystem helpers.
- Old Python scripts, marketing assets, and branding logic were removed in favor of this focused TS stack.

## Troubleshooting

- If the ReAct agent fails to reach MCP, restart via `npm start` so `scripts/start-all.ts` can re-launch `mcp-server` on port `9000` (it also checks for stuck processes using `lsof`).
- When updating dependencies or LangGraph versions, re-run `npm install` and restart both the MCP server and `npm start`.
