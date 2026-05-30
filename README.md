# Kletron

**MCP-native agent graphs with a real UI.** Local-first / BYOK — run models on your keys or on your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Kletron is a TypeScript monorepo: **Next.js** app, **Electron** desktop, **MCP tool server**, and shared **agent/graph** packages. Compose multi-node graphs, attach workspace MCP servers, and ship with traces—not a single opaque chat thread.

| Start here | |
|------------|--|
| **Run in ~15 min** | [Quickstart](#quickstart) |
| **Where code lives** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **MCP connectors (full doc)** | [docs/mcp-connectors-integration.md](./docs/mcp-connectors-integration.md) |
| **Send a PR** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **Plugins & presets** | [community/README.md](./community/README.md) |
| **Themes / priorities** | [ROADMAP.md](./ROADMAP.md) |
| **Codex + Google connectors** | [Codex backend + Google Workspace connectors](#codex-backend--google-workspace-connectors) |

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

## LM Studio on a remote machine (GPU server + ngrok)

If LM Studio runs on another host (e.g. **ai-beast**) and you use Kletron from the web or from your Mac, see **[docs/lm-studio-ai-beast-remote.md](./docs/lm-studio-ai-beast-remote.md)** for SSH forwards (`lm_up`), ngrok, Tailscale notes, and workspace paths on hosted Kletron (`WORKSPACE_SKIP_LOCAL_FS_VALIDATION`).

For **hosted Kletron + real files on your laptop**, see **[docs/workspace-local-files-hosted-kletron.md](./docs/workspace-local-files-hosted-kletron.md)** (`WORKSPACE_SKIP_LOCAL_FS_VALIDATION` + `KLETRON_REMOTE_FILE_MCP_SLUG` and a tunneled local MCP).

---

## Codex backend + Google Workspace connectors

When **Execution backend = Codex** (web or Electron), Kletron spawns the Codex CLI with  
`CODEX_HOME=$HOME/.kletron/codex/<userHash>` — **not** `~/.codex`. If you never use the Codex CLI directly, you can ignore `~/.codex/config.toml`; Kletron maintains its own Codex state under `~/.kletron/codex/`.

**Server `.env`:** set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` (same OAuth client as **Configuration → Connectors**).

**Google Cloud Console** (project that owns that OAuth client): enable **Gmail API**, **Gmail MCP API** (`gmailmcp.googleapis.com`), **Google Calendar API**, and **Google Drive API** as needed.

**In the app:** connect **Gmail**, **Google Calendar**, and **Google Drive** under Connectors and enable them for the workspace. LangGraph runs use Kletron-stored tokens directly. Codex runs additionally wire Gmail into the Codex process (refresh token → ADC JSON + bearer for Google’s hosted Gmail MCP; curated Gmail plugin is disabled to avoid ChatGPT-only credentials).

---

## Telegram (Messenger channel)

1. **HTTPS URL** — Telegram requires a public `https://` endpoint. Local dev: use a tunnel (ngrok, Cloudflare Tunnel, etc.) toward your Next.js port (default `3000`).
2. **Secrets** — In the app: **Configuration → Messenger channels**. Save the bot token there (requires `KLETRON_CHANNEL_SECRETS_KEY` on the server) or set `CHANNEL_TELEGRAM_BOT_TOKEN` in `.env`. Optionally set `CHANNEL_TELEGRAM_WEBHOOK_SECRET` and the same value as `secret_token` when registering the webhook.
3. **GCP prod (`kletron` project)** — Put Telegram vars in repo-root `.env`, then run `gcloud config set project kletron` and `python3 infra/gcp/provision_secrets.py`. That creates Secret Manager entries (`kletron-channel-telegram-*`) and binds **Cloud Run `kletron-web`**. Cloud Build deploys attach the same secrets if they already exist. Scripts refuse GCP project IDs containing `numezis`.
4. **Register the webhook** — After Cloud Run has the token + webhook secret, run `./infra/gcp/set-telegram-webhook.sh` (reads `.env`, defaults to `https://www.kletron.com`) or call Telegram manually:

   ```bash
   curl -sS "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -d "url=https://your-host.example.com/api/webhooks/channels/telegram" \
     -d "secret_token=<same as CHANNEL_TELEGRAM_WEBHOOK_SECRET>"
   ```

5. **Link your account** — In the web app **Messenger channels**: enter your Telegram user id and link so routing can find your Kletron user (required — otherwise « not linked »).
6. **Workspace & graph** — In **Messenger channels**, pick the workspace and set **default agent graph** + **Telegram enabled**. In Telegram use `/switch`, `/graphs`, `/graph clear` for per-chat overrides.
7. **Queue** — By default, webhook updates are stored in MongoDB (`channel_inbound_jobs`) and drained FIFO so multiple server instances do not drop work. For single-process in-process handling only, set `CHANNEL_TELEGRAM_QUEUE_BACKEND=memory`.
8. **Tool approvals** — New Telegram runs default to `CHANNEL_TELEGRAM_THREAD_APPROVAL_MODE=full_auto_thread` so read-only tools run without the web UI; set `confirm_everything` if you want every tool to queue for approval (you would approve in the Kletron web app, not in Telegram).

See **`env.example`** for all related variables.

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
