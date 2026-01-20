## Executive summary

This repository is a TypeScript/Node project built around LangChain/LangGraph agents and a bundled MCP server (github-mcp). The audit found several security and robustness concerns, the highest-risk being that child processes are spawned with the full parent environment (high severity). Other notable findings include un-sanitized error messages sent to remote callers, domain allowlist handling in fetchUrl that could be misconfigured, symlink-based path escapes, and several places where external commands (git, remote APIs) can leak sensitive details. The recommended remediation plan prioritizes: (1) stop passing full process.env to children, (2) sanitize tool error responses and centralize logging, and (3) harden allowlist/URL/path handling. A set of concrete implementation tasks with acceptance criteria is provided.

---

## Repo map

- Root: TypeScript/Node project that integrates with a local GitHub MCP server (github-mcp) and LangChain / LangGraph tooling.
- Top-level folders:
  - src/ — primary TypeScript source (agents, mcp client, config, graph entrypoints).
  - github-mcp/ — bundled MCP server and helper tools (server.js, tools for Git/GitHub, tests, README).
  - scripts/ — developer scripts to start/dev/launch services and helper library code.
  - graph/ — project graphs and images (visualizations).
  - .git/ and node_modules/ — standard repo internals.
- Entrypoints & developer scripts:
  - scripts/start-all.ts — start services
  - scripts/dev-all.ts — developer mode
  - scripts/langsmith-agent.ts — LangSmith integration agent
  - github-mcp/server.js — MCP server transport/adapter
  - src/index.ts and src/graph.ts — TS entrypoints referenced by tests
- Config & secrets:
  - Environment-driven configuration (src/config.ts, github-mcp/config.js, many scripts). .env is referenced; README mentions env.example.
- Key integrations/dependencies:
  - LangChain / LangGraph and related SDKs (used to drive agent behavior)
  - Azure OpenAI / LangSmith tokens via env vars
  - Git/GitHub tooling inside github-mcp (github API helpers, git log/blame tooling)

Notes: There are no detected payment integrations (Stripe/PayPal) or DB migration tooling in the repo. CI/CD workflow files (.github/workflows) and infrastructure-as-code (Terraform / Dockerfile) aren't present or weren't found by searches.

- Root: TypeScript/Node agent project integrating with a local MCP server (github-mcp) and LangChain / LangGraph tooling.
- Top-level folders:
  - src/ — primary TypeScript source (agents, mcp client, config, graph entrypoints).
  - github-mcp/ — bundled MCP server with tools (server.js, tools/, tests, README).
  - scripts/ — developer and orchestration scripts (start/dev/langsmith, serviceLauncher helper).
  - graph/ — visualizations (pngs).
- Entrypoints & developer scripts:
  - scripts/start-all.ts, scripts/dev-all.ts, scripts/langsmith-agent.ts
  - github-mcp/server.js — MCP server (stdio / SSE / HTTP transports)
  - src/index.ts and src/graph.ts — agent/graph entrypoints
- Config & secrets: environment-driven (src/config.ts, github-mcp/config.js). .env referenced by README and langgraph.json.
- Key integrations: LangChain/LangGraph, Azure OpenAI (AZURE_OPENAI_*), GitHub API (GITHUB_TOKEN/GH_TOKEN), modelcontextprotocol SDK for MCP transports.

Notes: No payment providers or DB migrations were detected. No CI/CD workflow files (.github/workflows) or Docker/Terraform artefacts were found.

---

## Findings (summary)

- F001 — Environment secrets propagated wholesale to spawned child processes (Severity: HIGH)
  - Description: Several spawns/exec calls build child env via `{ ...process.env, ...overrides }`, passing all env vars (API keys, tokens) to children and increasing risk of secret leakage.
  - Evidence: scripts/lib/serviceLauncher.ts (env: { ...process.env, ...config.env }), src/mcp/client.ts (StdioClientTransport env spread).
  - Recommendation: Build and use a minimal child env helper (allowlist-based), redact env values in logs, never spread process.env into children.

- F002 — Server tool error messages may leak internal details to callers (Severity: MEDIUM)
  - Description: MCP tool call handler returns `Error: ${error.message}` to callers; raw messages can contain internal state or sensitive info.
  - Evidence: github-mcp/server.js catch handler returning error.message in tool response.
  - Recommendation: Sanitize public errors (generic messages/codes), log full details server-side.

- F003 — fetchUrl domain allowlist handling and potential misconfiguration (Severity: MEDIUM)
  - Description: Effective allowlist resolution is complex and calls parseAllowlistFromEnv() twice; allowlist entries are not validated beyond strings. Misconfiguration may lead to overly permissive or confusing behavior.
  - Evidence: github-mcp/tools/fetchUrl.js effectiveAllowlist expression; HTTPS enforced but allowlist logic messy.
  - Recommendation: Normalize, validate and cache allowlist entries; warn at startup if empty; avoid permissive wildcards without explicit notice.

- F004 — Path resolution & repository boundary checks rely on string path ops (symlink bypass risk) (Severity: MEDIUM)
  - Description: resolveRepoPath/ensurePathInside use path.relative/path.resolve; symlinks can bypass these checks because real paths are not canonicalized.
  - Evidence: github-mcp/tools/pathUtils.js uses path.resolve + path.relative.
  - Recommendation: Use fs.realpath to canonicalize base and target, add tests for symlink edge cases, require explicit absolute defaultDir or refuse '.' implicitly.

- F005 — Git operations execute external git with user-controlled cwd/args (Severity: MEDIUM)
  - Description: runGit uses execFile('git', args, { cwd }), propagates stderr into thrown errors, and relies on callers for path validation. Large repos or unexpected args can cause resource issues or leak details.
  - Evidence: github-mcp/tools/gitUtils.js execFileAsync usage; gitBlame calling runGit with large maxBuffer.
  - Recommendation: Whitelist allowed git subcommands, sanitize/normalize file paths via resolveRepoPath, tighten timeouts/maxBuffer, and sanitize error output returned to callers.

- F006 — McpClient starts an in-process server with full env spread; inconsistent MCP_URL handling (Severity: MEDIUM)
  - Description: McpClient uses global EventSource assignment and creates SSE transport via new URL(mcpUrl) without validation; Stdio transport spawn spreads process.env.
  - Evidence: src/mcp/client.ts: `(globalThis as any).EventSource = EventSource` and env spread for StdioClientTransport.
  - Recommendation: Validate MCP_URL; avoid global polyfills (use scoped injection); spawn with limited env.

- F007 — GitHub API client returns raw API error details and lacks retry/backoff (Severity: LOW)
  - Description: githubFetchJson throws Error containing JSON body from GitHub, possibly leaking details. No retry/backoff on rate limits.
  - Evidence: github-mcp/tools/githubApi.js detail = JSON.stringify(json) used in Error message.
  - Recommendation: Return sanitized messages, log full API responses server-side, implement retry/backoff for 429s.

- F008 — Diagnostic mode spawns a child server and kills the process on timeout — CI risk (Severity: LOW)
  - Description: Diagnostic mode spawns serverProcess with env spread and force-kills after fixed timeout; in CI this may cause spurious failures or orphaned processes.
  - Evidence: github-mcp/server.js diagnostic spawn with ...process.env and setTimeout kill after 60s.
  - Recommendation: Make timeout configurable, use graceful shutdown sequence, provide a non-destructive dry diagnostic for CI.

- F009 — Configuration centralization: config.ts warns but continues when Azure vars missing; mutates process.env (Severity: LOW)
  - Description: src/config.ts warns when Azure vars are missing but proceeds; it also mutates process.env to set MCP_DEFAULT_DIR/GITHUB_MCP_DEFAULT_DIR which is surprising as a side-effect.
  - Evidence: src/config.ts console.warn and process.env assignments.
  - Recommendation: Provide validateConfig() (strict/non-strict modes), avoid mutating process.env in module init; let startup scripts apply env explicitly.

---

## Plan (prioritized tasks)

Top-priority (address within sprint 1):

- T001 (HIGH) — Prevent full process.env being passed to spawned child processes
  - Impact: eliminates the main secret-leak vector. Effort: medium.
  - Key steps: implement a buildChildEnv helper (allowlist-based), replace all env spreads in serviceLauncher, McpClient, server diagnostic spawns; redact env in logs; add tests.
  - Acceptance: no code spreads process.env into child env; smoke tests confirm services start with minimal env.

- T002 (MEDIUM) — Sanitize server tool error responses and centralize server-side logging
  - Impact: prevents remote callers from seeing internal state or secret-bearing messages.
  - Key steps: implement sanitizeToolError(), change MCP handler to return generic messages and log full details locally, add tests and documentation.

- T003 (MEDIUM) — Refine fetchUrl allowlist resolution and validation
  - Impact: improves SSRF defense and makes operator expectations explicit.
  - Key steps: normalize/validate allowlist, cache parsed list, startup warnings if empty, add unit tests.

Secondary tasks (sprint 2):

- T004 (MEDIUM) — Harden path resolution using fs.realpath to prevent symlink escapes.
- T005 (MEDIUM) — Sanitize git inputs/outputs, whitelist subcommands, cap resources.
- T006 (MEDIUM) — Harden McpClient transport creation (validate MCP_URL, avoid global EventSource polyfill).

Lower priority / housekeeping (sprint 3):

- T007 (LOW) — Sanitize GitHub API errors and add retry/backoff.
- T008 (LOW) — Make diagnostic mode safe & configurable for CI.
- T009 (LOW) — Centralize config validation and stop mutating process.env at import time.

Each task listing above has concrete steps and acceptance criteria (see annex for full task list).

---

## Annexes

### Meta (quick)
- Languages: TypeScript (~11 files), JavaScript (~35 files), JSON, Shell scripts.
- Frameworks: LangChain / LangGraph; no web framework detected.
- Key packages: @langchain/core, @langchain/langgraph, @modelcontextprotocol/sdk, langchain, dotenv, eventsource, zod.
- Entrypoints: scripts/start-all.ts, scripts/dev-all.ts, scripts/langsmith-agent.ts, github-mcp/server.js, src/index.ts, src/graph.ts.
- Hotspots: src/config.ts, github-mcp/server.js, scripts/lib/serviceLauncher.ts, src/mcp/client.ts, github-mcp/tools/githubApi.js, github-mcp/tools/gitLog.js/gitBlame.js.
- Recent changes: 2026-01-12 refactor and new "Deep Research" agent; prior doc/README updates.

### Suggested audit / quick-review files
- src/config.ts
- scripts/lib/serviceLauncher.ts
- github-mcp/server.js
- src/mcp/client.ts
- github-mcp/tools/fetchUrl.js
- github-mcp/config.js
- github-mcp/tools/githubApi.js
- github-mcp/tools/gitBlame.js
- github-mcp/tools/gitUtils.js
- github-mcp/tools/pathUtils.js
- github-mcp/tools/listFiles.js
- langgraph.json
- package.json
- scripts/start-all.ts
- scripts/dev-all.ts
- scripts/langsmith-agent.ts
- github-mcp/README.md
- github-mcp/tests/tools.test.js

(These match the prioritized hotspots and areas where secrets/IO/remote calls occur.)

### Evidence excerpts (representative)
- Full env spread to children: scripts/lib/serviceLauncher.ts "env: { ...process.env, ...config.env },"
- MCP tool error leak: github-mcp/server.js returning `Error: ${error.message}` in tool responses
- Allowlist resolution: github-mcp/tools/fetchUrl.js `const effectiveAllowlist = allowlist && allowlist.length ? allowlist : parseAllowlistFromEnv().length ? parseAllowlistFromEnv() : config.fetchAllowlist;`
- Path utils rely on path.relative: github-mcp/tools/pathUtils.js `const relative = path.relative(root, target); if (relative === "" || (!relative.startsWith("..") ...)) return;`

---

## Next steps & recommended immediate actions (triage)
1. Create a short-lived branch and implement T001 (buildChildEnv + replace env spreads). Run local dev and LangGraph agent flows. This mitigates the highest-severity risk quickly.
2. While T001 is in review, implement T002 (sanitize error responses) to avoid exposing secrets in tool failures.
3. Implement T003 (fetchUrl allowlist normalization) and add startup warnings for empty allowlists.
4. Schedule T004/T005 to harden path/git handling and coordinate with QA to run tests on large repo samples.

If you want, I can generate the exact code patch for T001 (helper + replacements) and create unit-test skeletons for the new helper. Specify which task to implement first and I will prepare diffs and suggested tests.