# Kletron

**A TypeScript LangGraph multi-agent pipeline for AI-powered code analysis and generation, backed by a local MCP (Model Context Protocol) server.**

Kletron provides multiple interfaces — a Next.js web dashboard, an Electron desktop app, and an interactive CLI — to orchestrate AI agents that can inspect, analyze, and modify codebases through a rich set of developer tools.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
  - [Applications](#applications)
  - [Shared Packages](#shared-packages)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Project](#running-the-project)
- [Applications](#applications-in-depth)
  - [Web App (apps/web)](#web-app-appsweb)
  - [Desktop App (apps/desktop)](#desktop-app-appsdesktop)
  - [MCP Server (apps/mcp-server)](#mcp-server-appsmcp-server)
  - [CLI (apps/cli)](#cli-appscli)
- [Packages](#packages-in-depth)
  - [agent-core](#agent-core)
  - [server](#server)
  - [shared](#shared)
  - [ui](#ui)
  - [mcp-client](#mcp-client)
  - [bridge](#bridge)
- [MCP Tools Reference](#mcp-tools-reference)
- [Agent Workflows](#agent-workflows)
- [API Routes Reference](#api-routes-reference)
- [Environment Variables](#environment-variables)
- [Scripts Reference](#scripts-reference)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐  │
│  │   CLI    │    │  Web (Next.js)│    │ Desktop (Electron)   │  │
│  └────┬─────┘    └───────┬───────┘    └──────────┬───────────┘  │
│       │                  │                       │              │
├───────┴──────────────────┴───────────────────────┴──────────────┤
│                     Shared Packages                             │
│  ┌────────────┐  ┌────────┐  ┌────────┐  ┌────┐  ┌──────────┐  │
│  │ agent-core │  │ server │  │ shared │  │ ui │  │mcp-client│  │
│  └─────┬──────┘  └───┬────┘  └────────┘  └────┘  └────┬─────┘  │
│        │             │                                 │        │
├────────┴─────────────┴─────────────────────────────────┴────────┤
│                      MCP Server (port 9000)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │File Tools│  │Git Tools │  │Code Tools│  │Web/GitHub Tools│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    External Services                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Supabase │  │  Stripe  │  │ LLM APIs │  │ GitHub API    │   │
│  │ (DB/Auth)│  │(Billing) │  │(AI/Embed)│  │               │   │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

The system follows a layered architecture:

1. **User Interfaces** — Three ways to interact: web dashboard, desktop app, or CLI.
2. **Shared Packages** — Common logic for agent execution, backend services, types, and UI components.
3. **MCP Server** — The single tool provider. All file, git, and code operations go through MCP.
4. **External Services** — Supabase (database/auth), Stripe (billing), LLM providers, and GitHub.

---

## Monorepo Structure

This project uses **npm workspaces** to manage a TypeScript monorepo.

```
kletron-coder-mcp/
├── apps/
│   ├── web/              # Next.js 14 web dashboard
│   ├── desktop/          # Electron macOS desktop app
│   ├── mcp-server/       # MCP tool server
│   └── cli/              # Interactive CLI
├── packages/
│   ├── agent-core/       # LangGraph agent execution engine
│   ├── server/           # Backend services (DB, auth, LLM, billing)
│   ├── shared/           # Shared types and Zod schemas
│   ├── ui/               # React component library
│   ├── mcp-client/       # MCP protocol client
│   └── bridge/           # Workspace file/git utilities
├── docs/                 # Additional documentation
├── scripts/              # Dev/build orchestration scripts
├── langgraph.json        # LangGraph configuration
├── tsconfig.base.json    # Shared TypeScript config
└── package.json          # Root workspace config
```

### Applications

| App | Description | Tech Stack | Port |
|-----|-------------|------------|------|
| **`apps/web`** | Next.js web dashboard with chat UI, agent graphs, config management | Next.js 14, React 18, Tailwind CSS | 3000 |
| **`apps/desktop`** | Electron desktop app for macOS with auto-updates | Electron 31, React 18, Vite, Tailwind CSS | — |
| **`apps/mcp-server`** | Local MCP server providing 28 developer tools | Node.js, MCP SDK, ast-grep, TypeScript API | 9000 |
| **`apps/cli`** | Interactive command-line REPL for agent workflows | Node.js, TypeScript | — |

### Shared Packages

| Package | Description |
|---------|-------------|
| **`packages/agent-core`** | LangGraph ReAct agent runner, deep research workflow, repo scanner agent, MCP tool wrappers, skills system |
| **`packages/server`** | Backend services: Supabase DB, auth, LLM config, vector/embedding, token usage, Stripe billing |
| **`packages/shared`** | Shared TypeScript types, Zod schemas, graph catalog, chain config builders |
| **`packages/ui`** | 50+ React components: agent panels, graph editor, config views, design system |
| **`packages/mcp-client`** | MCP client singleton supporting SSE and stdio transports |
| **`packages/bridge`** | Workspace utilities: file I/O, git operations, path resolution |

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** >= 9 (for workspace support)
- **Git**
- **macOS** (for the desktop app; web/CLI work on any platform)

### Installation

```bash
git clone <repo-url> kletron-coder-mcp
cd kletron-coder-mcp
npm install
```

### Configuration

1. **Environment variables** — Copy `env.example` to `.env` and fill in your credentials (see [Environment Variables](#environment-variables)).

2. **Repository settings** — Set the target repository path in **Configuration > Repository Settings** within the web UI. This writes to `config/config.json` (root) and `apps/web/config/config.json`.

3. **LLM provider** — Configure your preferred LLM provider (Azure OpenAI, OpenAI, Anthropic, Google Gemini, Ollama, or LM Studio) through the web UI at `/app/config/llm`.

4. **Embeddings** — Configure embeddings for vector search at `/app/config/embeddings`.

### Running the Project

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts MCP server (9000), LangGraph dev server (8080), and Next.js UI (3000) |
| `npm run dev:web` | Starts only the Next.js web app on port 3000 |
| `npm run dev:desktop` | Starts the Electron desktop app in dev mode |
| `npm start` | Starts the MCP server and interactive CLI |

The default development workflow:

```bash
npm run dev
# Open http://localhost:3000 in your browser
```

---

## Applications In-Depth

### Web App (`apps/web`)

The web app is a **Next.js 14 App Router** application serving as the primary dashboard for interacting with the AI agent pipeline.

#### Key Features

- **Chat interface** — Conversational UI for interacting with AI agents
- **Agent graphs** — Visual editor for creating and managing multi-step agent workflows
- **Deep agent** — Advanced multi-phase research workflows
- **Automations** — Batch execution of agent workflows across targets
- **Vector search** — Semantic code search powered by embeddings
- **Context management** — Configure what context the agents receive
- **Drift detection** — Detect code drift and changes
- **Configuration hub** — Manage LLM providers, embeddings, tools, and workspaces
- **Design system** — Built-in component documentation

#### Page Routes

| Route | Description |
|-------|-------------|
| `/` | Landing/marketing page |
| `/auth/*` | Authentication (login, register, reset password, IDE auth) |
| `/app/` | Main dashboard |
| `/app/explore` | Explore view |
| `/app/workbench` | Interactive workbench |
| `/app/deep-agent` | Deep research agent interface |
| `/app/context` | Context management |
| `/app/llm-config` | LLM configuration (alternate route) |
| `/app/history` | Execution history |
| `/app/runs/[id]` | Run details |
| `/app/changes` | Code changes view |
| `/app/vectors` | Vector search interface |
| `/app/automations` | Automation management |
| `/app/agent-graphs` | Agent graph editor |
| `/app/config/*` | Configuration (AI, LLM, embeddings, context, tools, graphs, workspace) |
| `/app/account/*` | Account management (billing, notifications, privacy, security) |
| `/design-system` | Design system documentation (with sub-tabs: components, patterns, foundation, agent, portal, mac-app) |
| `/design-system/ide` | IDE-specific design system |
| `/pricing` | Pricing page |
| `/legal/*` | Legal pages (terms, privacy, GDPR, cookies) |

#### Authentication

- **Provider**: Supabase Auth (server-side)
- **Middleware**: Protects `/app/*` routes, redirects unauthenticated users to `/auth/login` with a `redirect` query param
- **CORS**: Configurable allowlist for `/api/*` routes via `KLETRON_CORS_ALLOWLIST` (defaults to localhost origins in dev)
- **IDE auth**: Supports device-based auth flow for IDE extensions via `/auth/ide-*` routes
- **Dev bypass**: Auth is bypassed in non-production by default. Set `KLETRON_AUTH_BYPASS=false` to enforce auth in dev, or `=true` to explicitly bypass. API routes handle their own auth internally.

#### Styling

- **Tailwind CSS** with a custom design token system
- **CSS variables** for theming: `--bg-app`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--border-subtle`, etc.
- **Dark mode** optimized (Cursor/VS Code-inspired aesthetic)

---

### Desktop App (`apps/desktop`)

A **macOS Electron desktop application** providing a native-like experience for interacting with Kletron.

#### Key Features

- **Chat interface** — Agent conversation UI (mirrors web app)
- **Workspace management** — Native folder picker for selecting workspaces
- **File system access** — Direct read/write to workspace files
- **Git integration** — Status, commit, branch, and clone operations
- **Auto-updates** — Automatic update checking and installation from `updates.kletron.com`
- **Deep linking** — `kletron://` protocol handler for auth callbacks and navigation
- **VS Code integration** — Open files/folders directly in VS Code

#### Build Configuration

| Property | Value |
|----------|-------|
| App ID | `com.kletron.desktop` |
| Product Name | Kletron |
| Category | Developer Tools |
| Targets | DMG, ZIP |
| Hardened Runtime | Enabled |
| Notarization | Post-sign via `scripts/notarize.cjs` |
| Auto-update URL | `https://updates.kletron.com/desktop` |

#### IPC API

The desktop app exposes a `kletron` API to the renderer process via Electron's `contextBridge`:

- **Workspace**: `selectWorkspace`, `setWorkspace`, `getWorkspace`
- **App**: `openExternal`, `openInVSCode`, `getVersion`
- **Updates**: `getUpdateStatus`, `checkForUpdates`, `restartToUpdate`
- **File System**: `listFiles`, `readFile`, `writeFile`, `applyFileChange`
- **Git**: `status`, `commit`, `createBranch`, `checkout`, `clone`

#### Building for Distribution

```bash
npm run build:desktop    # Build the app
cd apps/desktop
npm run dist:mac         # Create DMG for macOS
npm run publish:mac      # Build and publish update
```

---

### MCP Server (`apps/mcp-server`)

The MCP server is the **single tool provider** for all repository operations. It exposes 28 tools via the Model Context Protocol, accessible over SSE (HTTP) or stdio.

#### Transport Modes

| Mode | Endpoint | Use Case |
|------|----------|----------|
| **SSE** | `http://localhost:9000/sse` | Web app, agents |
| **Stdio** | Standard input/output | LM Studio, external tools |

#### Security Features

- Path validation — all operations are confined to the configured workspace root
- Dotfile protection — writes to dotfiles are blocked (except `.gitignore`, `.npmignore`)
- File size limits — 256KB max for write operations
- URL allowlist — `fetch_url` only accesses domains in `fetchAllowlist`

#### Configuration

The server reads the root-level `config/config.json` (via `apps/mcp-server/config.js`) for:
- `workingFolder` — default repository root
- `workspaceRoots` — array of allowed workspace directories
- `fetchAllowlist` — allowed domains for URL fetching

---

### CLI (`apps/cli`)

An interactive command-line REPL for running agent workflows directly from the terminal.

```bash
npm start
# Starts MCP server + interactive CLI
# Type your prompt, press Enter to execute
# Type "exit" to quit
```

The CLI uses `@kletron/agent-core` for workflow execution and `@kletron/server` for backend services.

---

## Packages In-Depth

### agent-core

The agent execution engine built on **LangChain** and **LangGraph**.

#### Components

| Module | Purpose |
|--------|---------|
| `reactAgentRunner.ts` | Core streaming ReAct agent executor with token tracking |
| `simpleReactGraph.ts` | Simple single-phase LangGraph workflow |
| `workflows.ts` | Workflow orchestration using agent graph services |
| `tools/mcpTools.ts` | LangChain tool wrappers for all MCP server tools |
| `agents/repoScannerAgent.ts` | Repository analysis agent (structure, tech stack, "project soul") |
| `skills/` | Skills system — loader, registry, types |
| `deepResearch/` | Multi-phase deep research workflow |

#### Key Exports

- `streamReactAgentMessages()` — Streams ReAct agent execution with abort support and token usage tracking
- `runWorkflow()` — Executes agent graphs loaded from database
- `allMcpTools` — Array of LangChain-compatible tools wrapping all MCP server tools

---

### server

Backend services providing database access, authentication, LLM configuration, and business logic.

#### Services (30+ modules)

| Category | Services |
|----------|----------|
| **Agent** | ReActEngine, ConversationService, SafeEditGate |
| **Agent Graphs** | Execution, runtime, state management |
| **Audit** | Chain executor, context, drift analysis |
| **Infrastructure** | Vector, embedding, indexing, token usage tracking |
| **Business** | Subscription, Stripe, workspace, user management |
| **Config** | LLM provider abstraction, MongoDB persistence |

#### LLM Providers Supported

Valid providers (defined in `packages/server/src/llm.ts`):

| Provider ID | Implementation | Description |
|-------------|---------------|-------------|
| `azure` | `AzureChatOpenAI` | Azure OpenAI Service |
| `openai` | `ChatOpenAI` | OpenAI API |
| `claude` | `ChatAnthropic` | Anthropic Claude |
| `gemini` | `ChatGoogleGenerativeAI` | Google Gemini |
| `lmstudio` | `ChatOpenAI` (custom baseURL) | LM Studio local server |
| `ollama` | `ChatOllama` | Ollama local models |

---

### shared

Shared TypeScript types and Zod schemas used across all packages.

- `AgentWorkflowResult`, `AgentWorkflowUpdate` — workflow execution types
- `TimelineEvent`, `AgentEvent` — event streaming types
- `AutomationDefinition`, `AutomationStageConfig` — multi-stage automation types
- `Finding`, `Claim`, `Task` — audit domain types
- `graphCatalog` — predefined graph configurations
- LLM and embedding configuration schemas

---

### ui

A React component library with 50+ components organized into:

| Category | Components |
|----------|------------|
| **Agent** | Agent panel, conversation, tool logs, metrics display |
| **Agent Graphs** | Graph editor, visualization, node configuration |
| **Config** | AI settings, LLM config, embedding config views |
| **Context** | Context visualization, tracing |
| **Drift** | Drift analysis UI |
| **Design System** | Buttons, modals, tabs, inputs, cards, badges, etc. |
| **Hooks** | Ghost text, LLM health, subscription status |
| **Tokens** | Design tokens for colors, typography, spacing |

---

### mcp-client

A singleton MCP client supporting both SSE and stdio transports.

- `McpClient.getInstance()` — gets or creates the client instance
- `callTool(name, args)` — calls an MCP tool by name
- `listTools()` — lists all available MCP tools
- Auto-initializes vector indexing services on connection
- `semantic_code_search` is intercepted at the client level and routed to the vector service directly (bypasses MCP)

**Transport selection:**
- If `MCP_URL` is set → uses SSE transport (connects to the URL)
- Otherwise → uses stdio transport (spawns `apps/mcp-server/server.js --mcp` as a child process)

---

### bridge

Workspace utilities for file system and Git operations.

**Workspace:**
- `getWorkspaceName(path)` — extract workspace name
- `resolveWorkspacePath(workspace, target)` — resolve a path within a workspace
- `getWorkspaceInfo(path)` — workspace metadata

**File System:**
- `listFiles(workspace, relativePath, depth, limit)` — list files (default depth: 2, limit: 500)
- `readFile(workspace, relativePath)` — read file contents
- `writeFile(workspace, relativePath, content)` — write file
- `applyFileChange(workspace, relativePath, newContent)` — apply file change

**Git:**
- `getGitStatus(workspace)` — git status information
- `gitCommitAll(workspace, message)` — commit all changes
- `gitCreateBranch(workspace, branchName)` — create a branch
- `gitCheckout(workspace, branchName)` — checkout a branch
- `gitCloneRepo(repoUrl, targetRoot?, branch?)` — clone a repository

---

## MCP Tools Reference

The MCP server exposes **28 tools** organized by category. All tools are registered in `buildAllTools()` in `apps/mcp-server/server.js`.

### File Operations (4 tools)

| Tool | Description |
|------|-------------|
| `list_files` | List repository files with configurable depth |
| `read_file` | Read entire file contents |
| `read_file_range` | Read specific line range from a file |
| `write_file` | Write file with security checks (blocks dotfiles, 256KB limit) |

### Code Search & Navigation (8 tools)

| Tool | Description |
|------|-------------|
| `search_code` | Text/regex search across the repository |
| `structural_search` | AST pattern matching via ast-grep (TS/JS/Python) |
| `symbols_list` | List top-level symbols from TS/JS files (AST-based) |
| `find_symbol` | Find symbols by name substring |
| `go_to_definition` | TypeScript/JavaScript definition lookup |
| `references` | Find all references to a symbol |
| `locate_ui_feature` | Multi-query search for UI/UX features |
| `bootstrap_context` | Load high-signal project context files (README, package.json, architecture docs) |

### Git Operations (4 tools)

| Tool | Description |
|------|-------------|
| `git_log` | List recent commits (optionally filtered by file) |
| `git_diff` | Show diff between refs or staged changes |
| `git_grep` | Search tracked files using git grep |
| `git_blame` | Show blame for file/line range |

### Repository Analysis (3 tools)

| Tool | Description |
|------|-------------|
| `repo_metrics` | Compute language/file counts and sizes |
| `describe_structure` | Summarize repository structure (packages, folders, entrypoints) |
| `dependency_info` | Summarize npm/yarn dependencies and scripts |

### Web & External APIs (3 tools)

| Tool | Description |
|------|-------------|
| `web_search` | Web search via Tavily API (requires `TAVILY_API_KEY`) |
| `fetch_url` | Fetch URL content (HTTPS only, allowlisted domains) |
| `github_api` | Query GitHub REST API (issues, PRs, releases) |

### Utility (1 tool)

| Tool | Description |
|------|-------------|
| `todo_search` | Find TODO/FIXME/HACK markers in code |

### Skills System (2 tools)

| Tool | Description |
|------|-------------|
| `load_skill` | Load a skill from `.agent/skills/` directory |
| `list_skills` | List available agent skills |

### Compatibility Shims (3 tools)

| Tool | Description |
|------|-------------|
| `str_replace_editor` | Read-only compatibility shim for editor operations |
| `execute_bash` | Safe emulation of minimal shell subset (find/grep/rg/ls/cat) |
| `output_format` | Compatibility shim for output formatting |

> **Note:** `semantic_code_search` is not an MCP server tool — it is handled at the `@kletron/mcp-client` level, which uses the vector service directly to bypass MCP for semantic search operations.

---

## Agent Workflows

### Simple ReAct Agent

A single-phase ReAct (Reasoning + Acting) agent with access to all MCP tools. Best for straightforward tasks like code inspection, search, and simple edits.

- **System prompt:** `"You are a helpful AI assistant."`
- **Tools:** All MCP tools (`allMcpTools`)
- **State:** `messages`, `userRequest`, `finalAnswer`

```
START → simple_react → END
```

### Deep Research Workflow

A multi-phase research workflow using a supervisor-researcher pattern for complex analysis tasks.

```
START → clarify_with_user → write_research_brief → plan_research → research_supervisor → summarize_findings → final_action_report → END
```

| Node | Function | Description |
|------|----------|-------------|
| `clarify_with_user` | `clarifyWithUser` | Optional clarification with the user |
| `write_research_brief` | `writeResearchBrief` | Generate research brief from user request |
| `plan_research` | `planResearch` | Create a structured research plan |
| `research_supervisor` | Supervisor subgraph | Coordinates multiple researcher sub-agents using `conductResearchTool` |
| `summarize_findings` | `summarizeFindings` | Aggregate and summarize all findings |
| `final_action_report` | `generateActionReport` | Generate final actionable report |

**Default configuration** (from `defaultDeepResearchConfig`):

| Setting | Default | Description |
|---------|---------|-------------|
| `allowClarification` | `true` | Whether the clarify phase is enabled |
| `maxStructuredOutputRetries` | `3` | Max retries for structured LLM output |
| `maxResearcherIterations` | `4` | Max supervisor iterations |
| `maxReactToolCalls` | `6` | Max tool calls per researcher sub-agent |
| `maxConcurrentResearchUnits` | `3` | Max parallel researcher sub-agents |

### Audit Chains

Multi-stage audit workflows that can be configured with:
- Presets: `FULL_AUDIT`, `SECURITY_DEEP_DIVE`, `I18N_QUALITY_CHAIN`
- Custom chains with conditional stage skipping
- Retry logic with fallback LLM providers
- Cron-based scheduled execution

### Pipeline Outputs

Agent artifacts are written into the target repo under `.kletron/`:
- `.kletron/meta.json` — metadata and findings
- `.kletron/tasks.json` — generated tasks
- `.kletron/report.md` — analysis report

---

## API Routes Reference

The web app exposes **128 API routes**. Here are the key categories:

| Category | Base Path | Key Endpoints |
|----------|-----------|---------------|
| **Auth** | `/api/auth/` | `signin`, `signout`, `register`, `me`, `profile`, `api-tokens`, `api-tokens/[id]`, `ide-auth`, `ide-session`, `ide-refresh`, `ide-device/*`, `validate-token`, `reset-password`, `update-password` |
| **Agent** | `/api/agent/` | `run`, `[id]`, `[id]/chat`, `edits`, `approve`, `reject`, `apply/[runId]`, `diff/[runId]`, `status/[runId]`, `generate-title`, `update-title`, `update-message` |
| **Agent Graphs** | `/api/agent-graphs/` | CRUD, `[id]/runs`, `[id]/stream` |
| **Agent Graph Runs** | `/api/agent-graph-runs/` | `[runId]`, `[runId]/nodes`, `[runId]/approvals` |
| **Chat** | `/api/chat/` | `route`, `stream` |
| **Automations** | `/api/automations/` | CRUD, `[id]/execute`, `[id]/pause`, `[id]/resume`, `[id]/cancel`, `[id]/stream`, `[id]/report`, `[id]/runs` |
| **LLM Config** | `/api/llm-config/` | `provider`, `enable`, `test`, `azure`, `openai`, `claude`, `gemini`, `ollama`, `ollama/test`, `lmstudio`, `lmstudio/models`, `lmstudio/load`, `lmstudio/unload` |
| **Embeddings** | `/api/embedding-config/` | Config + `test` + per-provider: `azure`, `openai`, `gemini`, `ollama`, `lmstudio`, `voyage` |
| **Vectors** | `/api/vectors/` | `index`, `search`, `history`, `reindex`, `clear` |
| **Workspaces** | `/api/workspaces/` | CRUD, `active`, `[id]`, `[id]/select` |
| **File System** | `/api/fs/` | `read`, `write`, `delete`, `rename`, `mkdir`, `tree`, `search`, `document` |
| **Editor** | `/api/editor/` | `file/read`, `file/write`, `file/tree`, `state/subscribe` |
| **Git** | `/api/git/` | `commit-message`, `pr-description` |
| **Git Diffs** | `/api/git-diffs` | Git diff viewer |
| **GitHub** | `/api/github/` | `repos`, `clone` |
| **Tools** | `/api/tools/` | `list`, `[name]`, `execute` |
| **Runs** | `/api/runs/` | List, `[id]`, `[id]/cancel` |
| **Run History** | `/api/history/runs` | Run history |
| **Drift** | `/api/drift/` | `start`, `status`, `results`, `cancel` |
| **Token Usage** | `/api/token-usage/` | `summary`, `run/[id]`, `automation/[id]` |
| **Billing** | `/api/stripe/` | `checkout`, `portal`, `subscription`, `webhook` |
| **Skills** | `/api/skills/` | List, `[skillId]` |
| **Audits** | `/api/audits/` | List, `[id]` |
| **Config** | `/api/config`, `/api/context-config` | App + context configuration |
| **Repo** | `/api/repo-scan`, `/api/repo/tree` | Repository scanning and tree |
| **Completions** | `/api/completions` | Code completions |
| **Validation** | `/api/validation/` | `folder`, `git` |
| **Preferences** | `/api/user-preferences` | User preferences |
| **Health** | `/api/health` | Health check |

---

## Environment Variables

Copy `env.example` to `.env` and fill in your values. See below for all supported variables.

### Azure OpenAI (default LLM provider)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | Azure OpenAI deployment name |
| `AZURE_OPENAI_API_VERSION` | Yes | Azure OpenAI API version |
| `AZURE_OPENAI_MODEL` | Yes | Azure OpenAI model name |
| `AZURE_OPENAI_MAX_TOKENS` | No | Max tokens per request |

### LM Studio (local models)

| Variable | Required | Description |
|----------|----------|-------------|
| `LMSTUDIO_BASE_URL` | No | LM Studio server URL (default: `http://127.0.0.1:1234/v1`) |
| `LMSTUDIO_MODEL` | No | Local model name |
| `LMSTUDIO_API_KEY` | No | API key (default: `lm-studio`) |

### Other LLM Providers

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_DEFAULT_PROVIDER` | No | Default provider: `azure`, `openai`, `claude`, `gemini`, `lmstudio`, `ollama` |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (for Claude models) |
| `GOOGLE_API_KEY` | No | Google GenAI API key (for Gemini models) |
| `OPENAI_API_KEY` | No | OpenAI API key |

### Supabase (Auth & Database)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side, keep secret) |

### MCP & Agent

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_URL` | No | MCP server URL (default: `http://localhost:9000/sse`) |
| `MCP_PORT` | No | MCP server port (default: `9000`) |
| `LANGGRAPH_API_KEY` | No | LangGraph API key |
| `GRAPH_RECURSION_LIMIT` | No | Override LangGraph recursion limit (default: `50`) |
| `TOOL_RESULT_EVICT_CHARS` | No | Evict large tool outputs to `.kletron/agent-cache` (chars threshold) |
| `TOOL_RESULT_PREVIEW_CHARS` | No | Preview chars to keep inline when evicted |

### LangSmith (Tracing)

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGSMITH_TRACING` | No | Enable LangSmith tracing (`true`/`false`) |
| `LANGSMITH_ENDPOINT` | No | LangSmith API endpoint |
| `LANGSMITH_API_KEY` | No | LangSmith API key |
| `LANGSMITH_PROJECT` | No | LangSmith project name |

### MongoDB (Config Persistence)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | No | MongoDB connection URI |
| `MONGODB_USER` | No | MongoDB username |
| `MONGODB_PASS` | No | MongoDB password |

### GitHub

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub token for repo listing and cloning private repos |
| `KLETRON_REPOS_DIR` | No | Directory where GitHub repos are cloned |

### Stripe (Billing)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret |
| `STRIPE_PRICE_PRO_MONTHLY` | No | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_PRO_YEARLY` | No | Stripe Price ID for Pro yearly |
| `STRIPE_PRICE_TEAM_MONTHLY` | No | Stripe Price ID for Team monthly |
| `STRIPE_PRICE_TEAM_YEARLY` | No | Stripe Price ID for Team yearly |

### Web Search

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEY` | No | Tavily API key (enables `web_search` MCP tool) |

### Development & Misc

| Variable | Required | Description |
|----------|----------|-------------|
| `KLETRON_AUTH_BYPASS` | No | `true` to bypass auth, `false` to enforce (defaults to bypass in non-production) |
| `KLETRON_CORS_ALLOWLIST` | No | Comma-separated allowed origins for `/api/*` CORS (defaults to localhost in dev) |
| `NEXT_PUBLIC_SKIP_AUTH` | No | Skip auth on the client side |
| `DESIGN_SYSTEM_CODE` | No | Password for design system access |
| `NEXT_PUBLIC_DESIGN_SYSTEM_PROTECT` | No | `false` to disable design system password protection |

---

## Scripts Reference

### Root Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services (MCP + LangGraph + Web UI) |
| `npm run dev:web` | Start only the Next.js web app |
| `npm run dev:desktop` | Start the Electron desktop app |
| `npm start` | Start MCP server + interactive CLI |
| `npm run build` | Build the web app (with context check) |
| `npm run build:web` | Build the web app (with context check) |
| `npm run build:desktop` | Build the Electron desktop app |
| `npm run start:web` | Start the web app in production mode |
| `npm run start:desktop` | Start the desktop app |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test:unit` | Run unit tests (Vitest) |
| `npm run test` | Run typecheck + unit tests |

### Port Allocation

| Port | Service |
|------|---------|
| 3000 | Next.js web app |
| 8080 | LangGraph dev server |
| 9000 | MCP server (SSE) |

---

## Contributing

See `CONTRIBUTING.md` for full guidelines. Quick summary:

| Area | Location |
|------|----------|
| UI components / hooks | `packages/ui` |
| Shared types & schemas | `packages/shared` |
| Server logic (DB, auth, vector, LLM) | `packages/server` |
| Agent graphs / tools / workflows | `packages/agent-core` |
| MCP client wrapper | `packages/mcp-client` |
| Next.js routes & pages | `apps/web` |
| CLI | `apps/cli` |
| MCP server tools | `apps/mcp-server` |

**Key rules:**
- UI code must not import runtime server modules (types-only imports are fine).
- The `shared` package stays pure — no filesystem, network, or DB code.
- Prefer importing from `@kletron/*` aliases instead of deep relative paths.

---

## Troubleshooting

### MCP Server Connection Issues

If the ReAct agent fails to reach the MCP server:

```bash
npm start
# scripts/start-all.ts will re-launch mcp-server on port 9000
# It also checks for stuck processes using lsof
```

### Port Conflicts

The dev script automatically attempts to reclaim ports 9000 and 8080. If you still have conflicts:

```bash
lsof -ti:9000 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

### Dependency Updates

After updating dependencies or LangGraph versions:

```bash
npm install
# Restart both MCP server and dev
npm run dev
```

### Desktop App Build Issues

For macOS notarization issues, ensure you have:
- A valid Apple Developer certificate
- `APPLE_ID` and `APPLE_ID_PASSWORD` environment variables set
- Xcode Command Line Tools installed

---

## Additional Documentation

| Document | Path | Description |
|----------|------|-------------|
| Architecture | `docs/architecture.md` | Detailed architecture overview |
| Context Configuration | `docs/context-configuration.md` | Context graph configuration |
| Design System | `docs/DESIGN_SYSTEM.md` | UI design system guidelines |
| VS Code Protocol | `docs/vscode-protocol.md` | VS Code extension backend protocol |
| VS Code UI | `docs/vscode-ui.md` | VS Code extension UI design |
| Audit Chains | `.agent/workflows/create-audit-chain.md` | How to create audit chains |

---

## License

Private — All rights reserved.
