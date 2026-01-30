# GitHub MCP

Local Model Context Protocol (MCP) server tailored to inspect a GitHub repository on your workstation. It exposes file listing, file reading, and search tools over the MCP protocol so agents (e.g., LM Studio) can browse your repo without direct filesystem access.

## Getting started

1. Install dependencies: `npm install`
2. Configure the default directory (see below) or pass repository paths explicitly to the tools.
3. Start the server with:
   - `npm start` (MCP server mode, for LM Studio)
   - `npm run diagnose` (diagnostic self-test, for humans)

Tip: environment variables are loaded from `.env` automatically (via `dotenv`) when running `server.js`.

## LM Studio setup (quick)

1. Install dependencies in this repo: `npm install`
2. In LM Studio → MCP servers, add a server using **one of these configurations**:
   - Recommended (no `npm` required): command `node`, args `["/Users/<you>/Desktop/mcp-server/server.js","--mcp"]`
   - Alternative: command `npm`, args `["run","mcp"]` (requires `npm` to be in LM Studio’s PATH and the working directory set to this repo)
3. In your agent prompt, encourage evidence-first tool usage. A common failure mode is incorrect tool arguments: always follow the `tools/list` schemas returned by MCP.

Important: LM Studio spawns a process using a command + args. If you enter `npm run dev` as a single “command”, it will try to execute a binary literally named `npm run dev` and fail with `ENOENT`.

## Scripts

- `npm start` / `npm run mcp` – launches the MCP server (`node server.js --mcp`) for LM Studio and other orchestrators.
- `npm run dev` / `npm run diagnose` – runs the diagnostic self-test (`node server.js --diagnostic`) and exits.
- `npm test` – runs a small Node test suite validating core tools on a temporary git repo.

## Configuration

The base configuration lives in `config.js`. The only required value is `defaultDir`, which tells the tools where to work when no explicit path is provided. The file defaults to a static directory, but you can override it through environment variables without editing `config.js`:

```bash
MCP_DEFAULT_DIR=/path/to/project npm run dev
```

or use the more specific `GITHUB_MCP_DEFAULT_DIR` if you prefer.

When a tool receives a relative path, it resolves it against the configured directory and refuses to access files outside that root, preventing accidental traversal to sensitive system files.

## Tools overview

- **list_files** – lists every non-directory entry under the target path while ignoring common build and dependency folders.
- **read_file** – reads a single file after ensuring the resolved path lives under the repo root.
- **read_file_range** – reads a specific line range from a file (useful for big files / targeted context).
- **search_code** – searches across typical source extensions and returns `{file,line,column,snippet}` matches. Supports `regex`, `caseSensitive`, `wholeWord`, `globs`, `maxResults`, and a small glob-cache.
- **repo_metrics** – counts files/lines and surfaces the most voluminous files, helping assess code volume per extension.
- **todo_search** – scans for TODO/FIXME/keyword markers so agents can spot unfinished work and action items.
- **dependency_info** – reads `package.json`, summarizing dependencies/devDependencies/scripts and reporting whether a lockfile exists.
- **describe_structure** – inspects the top-level layout, key configuration files, and any obvious frameworks so you can reason about architecture without manual browsing.
- **git_log** – recent commits (optionally scoped to a file).
- **git_diff** – unified diff for working tree/staged or between refs.
- **git_grep** – fast search via `git grep` returning `{file,line,column,snippet}`.
- **git_blame** – blame info for a file (porcelain parsed).
- **structural_search** – AST search via `ast-grep` (`sg`) with JSON results (pattern + language required).
- **symbols_list** – TS/JS top-level symbols (AST-based).
- **find_symbol** – alias for symbol search (delegates to `symbols_list`).
- **go_to_definition** – TS/JS go-to-definition by `{filePath,line,column}` (best-effort, ignores defs outside the configured root).
- **references** – TS/JS references by `{filePath,line,column}` (best-effort, ignores refs outside the configured root).
- **web_search** – Tavily web search (requires `TAVILY_API_KEY`).
- **fetch_url** – fetch an HTTPS URL with a strict allowlist (see below).
- **github_api** – GitHub REST API helper for `issues|pulls|releases` (uses `GITHUB_TOKEN`/`GH_TOKEN` if set).
- **bootstrap_context** – reads a small set of high-signal files (architecture/rules/config) and returns excerpts for grounding.
- **locate_ui_feature** – multi-query “feature locator” over UI code/docs (useful to avoid false “missing feature” claims).
- **str_replace_editor** – compatibility shim (read-only view/range). Avoids agent failures when they try to “open/view” files via other toolsets.
- **execute_bash** – compatibility shim (safe emulation only; no real shell). Supports a small subset like `find/grep/rg/ls/cat` via existing tools.
- **output_format** – compatibility shim to prevent failures when agents try to call a formatting tool.

Tool input schemas are described by the MCP `tools/list` response, so clients can discover and validate arguments automatically.

## Tool cheat sheet (common arguments)

These examples assume you set `GITHUB_MCP_DEFAULT_DIR`/`MCP_DEFAULT_DIR`. If not, pass an absolute repo root in `path`/`repoPath`.

- `read_file`: `{ "repoPath": "/abs/repo/root", "filePath": "apps/api/src/index.ts" }`
- `read_file_range`: `{ "repoPath": "/abs/repo/root", "filePath": "apps/api/src/index.ts", "startLine": 1, "endLine": 120 }`
- `search_code`: `{ "path": "/abs/repo/root", "query": "openapi", "regex": false, "maxResults": 50 }`
- `git_grep`: `{ "path": "/abs/repo/root", "query": "openapi", "regex": false, "maxResults": 50 }`
- `structural_search`: `{ "path": "/abs/repo/root", "lang": "ts", "pattern": "router.get($A, $B)", "maxResults": 50 }`
- `go_to_definition`: `{ "path": "/abs/repo/root", "filePath": "apps/web/app/page.tsx", "line": 10, "column": 15 }`

## Compatibility shims (LM Studio / toolset mismatch)

Some local models try to call tools that exist in other agent environments. To reduce “tool not found” failures, this MCP server exposes a few *read-only / safe* shims:

- `str_replace_editor`: supports viewing files only (no edits). If the agent tries to edit, it returns an error message telling it to use the read/search tools.
- `execute_bash`: does **not** execute arbitrary shell. It emulates a small subset (`find`, `grep -r`, `rg`, `ls`, `cat`) via the safe MCP tools.
  - Supports absolute paths *inside* the configured root.
  - Supports simple pipes like `| head -N` to cap results.
  - `ls` returns names only (no permissions/owners like real `ls -la`).
  - Prefer using `list_files`, `search_code`, or `git_grep` directly for reliability.
- `output_format`: a no-op formatter shim; returns the payload as-is.

## Diagnostics

Run `npm run diagnose` (or `npm run dev`) to exercise diagnostic mode. It spawns a child MCP server, calls `initialize`, lists the tools, and reports success or a timeout.

If LM Studio shows intermittent `WebSocket closed by the client` errors, it usually means the server accidentally started in diagnostic mode (some launchers attach a pseudo‑TTY). Always use `npm start` (or `node server.js --mcp`) in LM Studio so the process stays alive.

If you see errors like `Could not read package.json: .../.lmstudio/extensions/plugins/mcp/mcp-server/package.json`, you likely installed this as an LM Studio *plugin* instead of configuring it as an external MCP server. This repo is meant to be run from its own folder (with `node_modules` present).

## Troubleshooting (LM Studio)

Common failure modes are almost always **LM Studio launch config** issues (command/args/cwd), not MCP protocol issues.

- **`spawn npm run dev ENOENT` / `spawn npm start ENOENT`**
  - LM Studio is treating `npm run dev` as a single executable name.
  - Fix: set **Command = `npm`** and **Args = `run`, `mcp`** (or use the node method below).

- **LM Studio *mcpBridge plugin* closes immediately / “Connection closed”**
  - Your plugin `mcp-bridge-config.json` is launching the diagnostic mode (`npm run dev` / `--diagnostic`), which exits on success.
  - Fix: set it to run **MCP mode** (non-exiting): command `node`, args `["/path/to/mcp-server/server.js","--mcp"]` (or `npm run mcp`).

- **`Could not read package.json .../.lmstudio/extensions/plugins/mcp/mcp-server/package.json`**
  - You installed this as an LM Studio plugin. Remove that plugin and add it as an external MCP server instead.

- **“Working Directory: No directory yet” (or missing cwd)**
  - Use the **node** launch method so no cwd is required:
    - Command: `node`
    - Args: `/Users/<you>/Desktop/mcp-server/server.js`, `--mcp`

- **It works in terminal (`npm run diagnose`) but not in LM Studio**
  - You are launching diagnostic mode in LM Studio (which exits). Ensure LM Studio uses `--mcp`.

If you ever need to target a different repository for a one-off invocation, pass the `path` / `repoPath` arguments from the client request. Defaults only apply when those arguments are absent.

## Web tools configuration (optional)

- **Tavily**: set `TAVILY_API_KEY` for `web_search`.
- **fetch_url allowlist**: set `MCP_FETCH_ALLOWLIST` (or `GITHUB_MCP_FETCH_ALLOWLIST`) to a comma-separated list of domains:
  - Example: `MCP_FETCH_ALLOWLIST=docs.github.com,raw.githubusercontent.com,*.npmjs.com`
  - HTTPS only; anything outside the allowlist is rejected.
- **GitHub API**: set `GITHUB_TOKEN` or `GH_TOKEN` to increase rate limits for `github_api`.

## Security notes

- `.env` is ignored by git (see `.gitignore`). Don’t paste API keys into chats/logs; rotate keys if accidentally exposed.
