# Contributing to Kletron

Thanks for helping. We aim for **low friction**: runnable locally in ~15 minutes, small PRs welcome, and clear boundaries so you can contribute without learning the entire monorepo.

## Maintainer response time

We try to **acknowledge every issue and PR within 48 hours** (comment, label, or request for changes). If something stalls, ping the thread.

## Run it locally

### Path A — recommended (Docker Mongo + npm dev)

1. `cp env.example .env` and fill **MINIMUM TO START** (see comments in `env.example`).
2. `docker compose up -d mongo` (or `npm run dev:infra`).
3. `npm install`
4. `npm run seed:demo` — creates `demo@kletron.local` / `kletron-demo`, org, and [`examples/quickstart-workspace`](./examples/quickstart-workspace/).
5. `npm run dev` — MCP, LangGraph dev server, web, desktop launcher ([`scripts/dev-all.ts`](./scripts/dev-all.ts)).

### Path B — Make / script

- `make quickstart` or `./bin/quickstart.sh` — same as `npm run quickstart`.

### Path C — you already have Mongo elsewhere

Point `MONGODB_URI` in `.env` at your instance; skip Docker.

## Where new code goes

| Area | Path |
|------|------|
| UI components / hooks | `packages/ui` |
| Shared types & schemas | `packages/shared` |
| Server logic (DB, auth, vector, LLM config, graph execution) | `packages/server` |
| Agent graphs / tools / workflows | `packages/agent-core` |
| MCP client wrapper | `packages/mcp-client` |
| Next.js routes & pages | `apps/web` |
| CLI | `apps/cli` |
| MCP server tools | `apps/mcp-server` |
| Desktop (Electron) | `apps/desktop` |

## Boundaries (please keep)

- **UI** (`packages/ui`, `apps/web` client bundles) must not import **runtime server** modules (types-only imports are OK).
- **`packages/shared`** stays pure: no filesystem, network, or DB.
- Prefer **`@kletron/*`** path aliases over long relative imports.

## Labels (request when opening an issue)

| Label | Meaning |
|-------|---------|
| `good first issue` | Small, scoped, mentor-friendly |
| `help wanted` | Maintainer bandwidth low — community pick-up welcome |
| `design discussion` | Needs consensus before code (API, UX, data model) |
| `area:web` | Next.js / marketing / App Router |
| `area:graphs` | Agent graphs, presets, editor |
| `area:mcp` | MCP server, connectors, transports |
| `area:desktop` | Electron app |
| `area:docs` | README, guides, comments |
| `area:community` | `community/` templates, examples |

See [docs/labels.md](./docs/labels.md) for the full label list (apply on GitHub with `gh` or manually).

## Pull requests

1. **Small PRs** beat giant refactors.
2. Before opening: run `npm run lint` and `npm run typecheck` on files you touched when possible. CI currently runs **lint** and **typecheck** as informational (non-blocking) on the whole monorepo while legacy debt is cleared; **`npm run test:unit`** and **`npm run build:ui`** are the merge gates.
3. **Organization invariant:** every user must keep a tenant — don’t add flows that drop `tenant_members` without provisioning another org (see workspace rules / `organizationService`).
4. Describe **what / why**, link issues, add screenshots for UI.

### PR checklist

- [ ] `npm run lint` (on your changes — full-repo lint may still warn)
- [ ] `npm run typecheck` (on your changes when possible)
- [ ] `npm run test:unit` (or explain why N/A)
- [ ] No new `packages/ui` → server runtime imports
- [ ] Docs updated if behavior or env vars changed

## Build a community plugin (no core surgery)

The fastest wins are usually under **`community/`**:

- MCP server templates / examples
- Graph preset JSON
- Example skills

Read [community/README.md](./community/README.md) and open a PR that adds or improves one artifact.

## Security

Do **not** open public issues for vulnerabilities — see [SECURITY.md](./SECURITY.md).

## Code of conduct

[Contributor Covenant](./CODE_OF_CONDUCT.md) — be respectful and constructive.
