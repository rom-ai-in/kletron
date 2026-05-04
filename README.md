# Kletron

**MCP-native agent graphs with a real UI.** Local-first / BYOK — run models on your keys or on your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Kletron is a TypeScript monorepo: **Next.js** app, **Electron** desktop, **MCP tool server**, and shared **agent/graph** packages. Compose multi-node graphs, attach workspace MCP servers, and ship with traces—not a single opaque chat thread.

| Start here | |
|------------|--|
| **Run in ~15 min** | [Quickstart](#quickstart) |
| **Where code lives** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Send a PR** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **Plugins & presets** | [community/README.md](./community/README.md) |
| **Themes / priorities** | [ROADMAP.md](./ROADMAP.md) |

**Community:** GitHub Discussions on your fork (enable in repo settings) · Discord _TBD_ — add your invite link here when live.

---

## Quickstart

**Prerequisites:** Node 20+, Docker (for Mongo), `git`.

```bash
git clone https://github.com/<org>/kletron.git
cd kletron
cp env.example .env
# Edit .env: set NEXTAUTH_SECRET, MCP_INTERNAL_TOKEN, and LM Studio / Azure keys (see MINIMUM section in env.example)
```

**One path (Make):**

```bash
make quickstart
```

**Same path (npm + shell):**

```bash
npm run quickstart
# or: ./bin/quickstart.sh
```

This starts **MongoDB**, installs deps, runs **`npm run seed:demo`** (demo user + [`examples/quickstart-workspace`](./examples/quickstart-workspace) + default graphs), then **`npm run dev`** (MCP + LangGraph dev + web + desktop launcher per [scripts/dev-all.ts](./scripts/dev-all.ts)).

**Log in after seed**

- URL: `http://localhost:3000/auth/login` (or your `NEXT_PUBLIC_APP_URL`)
- Email: `demo@kletron.local`
- Password: `kletron-demo`

**Demo GIF (placeholder)** — add a ~60s screen recording to `docs/assets/demo.gif`, then uncomment the image line below.

<!-- ![Kletron demo](docs/assets/demo.gif) -->

---

## Why Kletron (vs wiring LangGraph + a random UI yourself)

- **Graph editor + runtime** — presets, branching, and traces in product, not only in notebooks.
- **MCP everywhere** — bundled tools + **workspace-scoped** MCP (stdio / SSE / HTTP); tools namespaced for readable logs.
- **BYOK & local models** — LM Studio, Ollama, vLLM, plus cloud APIs; you control spend and data routing.
- **EU / self-host posture** — run the stack where your policy says; see [Enterprise](https://kletron.com/enterprise) for managed options.
- **Contributor-friendly surface** — [`community/`](./community/) for MCP templates, graph JSON presets, and skills without touching core internals.

---

## Repo layout (short)

| Path | Role |
|------|------|
| `apps/web` | Next.js UI + App Router APIs |
| `apps/mcp-server` | MCP SSE server (tools) |
| `apps/desktop` | Electron shell |
| `apps/cli` | CLI entrypoints |
| `packages/agent-core` | Graphs, agents, workflows |
| `packages/server` | DB, auth helpers, graph execution services |
| `packages/ui` | Design system & shared UI |
| `packages/shared` | Types & pure utilities |
| `packages/mcp-client` | MCP client |

Deep dive tables and API notes live in **[docs/README-archive.md](./docs/README-archive.md)** (archived long README).

---

## Docker

- **Default:** `docker compose up -d mongo` — local database only (used by `npm run dev:infra`).
- **Optional profile:** `docker compose --profile fullstack up -d --build` — builds **web** + **mcp-server** images (smoke / prod-like; set secrets via `.env` or compose defaults).

---

## Scripts (root)

| Script | Purpose |
|--------|---------|
| `npm run quickstart` | Mongo + install + `seed:demo` + `dev` |
| `npm run dev` | Full dev stack ([scripts/dev-all.ts](./scripts/dev-all.ts)) |
| `npm run seed:demo` | Demo user + workspace + graphs |
| `npm run typecheck` / `npm run lint` / `npm run test:unit` | CI checks |

---

## License

MIT — see [LICENSE](./LICENSE).
