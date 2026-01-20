# Numezis Coder (TypeScript LangGraph)

This repo houses a **Node/TypeScript LangGraph multi-agent pipeline** backed by the local `github-mcp` Model Context Protocol server. `npm run dev` starts both services and prints a clickable LangSmith Studio link for running the graph locally.

## Architecture

- **4-phase pipeline** (`src/graph.ts`): Map → Audit → Plan → Report.
- **Phase agents** (`src/agents/phases.ts`): Each phase is a single ReAct agent with a specific mission prompt and an explicit MCP tool list.
- **MCP Server** (`github-mcp`): The agent no longer talks directly to the filesystem. All inspection/editing actions are routed through the MCP server, so agents behave like LM Studio clients and stay contained.

### Pipeline outputs (written via MCP)

Artifacts are written into the target repo under `.numezis/`:

- `.numezis/meta.json`
- `.numezis/tasks.json`
- `.numezis/report.md`

### Next.js agent dashboard (Tailwind-powered)

- `/app/page.tsx` renders a staged chat UI that submits to `/api/chat`.
- `/api/chat` reuses the same Phase 1..4 logic and returns timeline events, meta/findings/tasks, and the final report summary.
- The sidebar exposes `/api/tools/*` metadata so you can click any MCP tool and see the raw `github-mcp/tools` implementation.
- The UI now uses Tailwind CSS (see `tailwind.config.js`, `postcss.config.js`, `app/globals.css`) for the Cursor-style layout.

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
   This reclaims ports `9000` (MCP) and `8080` (LangGraph dev), launches both services, waits for readiness, and prints a LangSmith Studio link:
   `https://smith.langchain.com/studio?baseUrl=http://localhost:8080`
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

`npm start` frees ports `9000` / `8080`, launches `github-mcp` (MCP tooling) on port `9000`, and then runs the interactive CLI (`src/index.ts`). Type `exit` to quit.


For iterative development, use `npm run dev`. It reclaims ports 9000/8080, launches `github-mcp`, and starts `@langchain/langgraph-cli dev` on port 8080. The command prints a clickable LangSmith Studio link for your local server: `https://smith.langchain.com/studio?baseUrl=http://localhost:8080`.

## LangSmith Workflow

```bash
npm run langsmith
```

Use `npm run langsmith` when deploying under LangSmith Agent. It reclaims ports 9000/8080, launches `github-mcp`, and restarts the LangGraph CLI with `LANGSMITH_AGENT=1` so the LangSmith platform can track the run. You can also call the LangSmith CLI directly:

```bash
langsmith agent run --name numezis --command "npm run langsmith"
```

Ensure `LANGSMITH_API_KEY` and related telemetry variables are set so LangSmith can ingest the traces.

## Environment Variables

- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_MODEL`, `AZURE_OPENAI_MAX_TOKENS`: Provide your Azure credentials.
- `GITHUB_MCP_DEFAULT_DIR` (preferred) / `MCP_DEFAULT_DIR`: Root path the MCP server should service. This repo’s scripts resolve the target root from these vars and pass it to both `github-mcp` and the agent so all tool calls stay focused on that repository.
- `LANGSMITH_API_KEY` / `LANGGRAPH_API_KEY`: Optional tracing keys. `npm run langsmith` honors `LANGSMITH_API_KEY` so the platform can publish run telemetry.

## MCP Tooling

The TypeScript agent uses the MCP `tools/call` interface through `src/tools/mcpTools.ts`. Tools are exposed to the React agent as LangChain tools with `zod` schemas, ensuring all repository interactions are captive to `github-mcp`.

## Notes

- `github-mcp` is now the **only** tool provider—no more local filesystem helpers.
- Old Python scripts, marketing assets, and branding logic were removed in favor of this focused TS stack.

## Troubleshooting

- If the ReAct agent fails to reach MCP, restart via `npm start` so `scripts/start-all.ts` can re-launch `github-mcp` on port `9000` (it also checks for stuck processes using `lsof`).
- When updating dependencies or LangGraph versions, re-run `npm install` and restart both the MCP server and `npm start`.
