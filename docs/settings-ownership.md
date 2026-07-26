# Settings ownership — desktop vs web

Which surface owns which setting. The rule below is the one already encoded in
`apps/desktop/src/components/SettingsCard.tsx`; this document states it so new
sections stop having to guess.

## The principle: machine vs workspace

**The desktop app owns what belongs to the machine. The web app owns what
belongs to the workspace and the organization.**

| Tier | Owner | What it covers | How the other surface behaves |
| --- | --- | --- | --- |
| Machine | Desktop | Appearance, density, prevent-sleep, backend URL, the signed-in device session, **and the choice of the active LLM provider/model** | Web does not show it at all |
| Workspace | Web | LLM credentials and endpoints, embeddings, context/retrieval, connectors, channels, skills, agent graphs, automations, workspace defaults | Desktop shows read-only status + **Open in browser** |
| Organization | Web | Tenant, companies, members, groups, billing | Desktop does not show it at all |

Three consequences worth stating explicitly:

- **Configure in web, select on desktop.** Provider credentials, endpoints and
  connection tests live in `/app/config/llm`. The desktop `Models` section only
  picks which already-configured provider and model are active — it `POST`s
  `{ provider }` and merges `{ model }` into the existing provider config, so it
  never touches secrets.
- **No exception for local providers.** Ollama, LM Studio and vLLM run on the
  user's machine but are still configured in the web app, like every other
  provider. One rule, no special case to explain.
- **Device-only means not synced.** Anything stored in `localStorage` on the
  desktop (skills list, toggles, backend URL) is per-device and must say so.

The web menu exposes `/app/config` as a single **Settings** entry. Its
sub-pages (AI models, embeddings, context, tools, connectors, skills, plugins)
are reached from the hub, never duplicated in the menu.

## Saying which tier a section is in

Every desktop settings section must declare its tier. Two components exist for
this and both link to the matching web route:

- `DeviceOnlyPortalBanner` — the values are stored on this device and not synced.
- `PortalBrowserBanner` — the values live server-side and are edited in the web
  app; the desktop shows status, or a narrow subset such as selection.

A section with no banner is a bug: the user cannot tell whether their change
followed them to another machine.

## Current mapping

| Desktop section | Tier | Banner |
| --- | --- | --- |
| General (prevent sleep) | Machine | — (self-evidently local) |
| Personalization (appearance, density) | Machine | — (self-evidently local) |
| Account (device session) | Machine | — |
| Web portal (links out) | Bridge | — |
| Configuration → Backend URL | Machine | — |
| Configuration → Models | Workspace (selection only) | `PortalBrowserBanner` → `/app/config/llm` |
| Configuration → Embeddings & context | Workspace | read-only + *Edit in portal* |
| Connectors | Workspace | `PortalBrowserBanner` → `/app/config/connectors` |
| Channels | Workspace | `PortalBrowserBanner` |
| Skills | Machine (`localStorage`) | `DeviceOnlyPortalBanner` → `/app/skills` |
| Automations | Workspace | banner + *Open in browser* per row |
| Agent Graphs | Workspace | `PortalBrowserBanner` → `/app/agent-graphs` |
| Environments | Machine | `DeviceOnlyPortalBanner` → `/app/config/workspace` |

Web-only, with no desktop counterpart by design: organization (tenant, members,
groups, billing), workspaces, vectors, plugins, explore, deep-agent, changes,
context.

## Adding a setting

1. Decide the tier with one question: *would this value follow the user to
   another machine?* Yes → workspace, and it belongs in the web app. No →
   machine, and it belongs in the desktop app.
2. If it is a workspace setting the desktop needs to surface, show status only
   and add a `PortalBrowserBanner` pointing at the web route.
3. If it is device-only, add a `DeviceOnlyPortalBanner` pointing at the nearest
   web equivalent so the user knows where the synced version lives.
