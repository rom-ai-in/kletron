# Launch issues (copy-paste)

Create these on GitHub when you open the repo. Replace `AREA` labels with `area:*` from [labels.md](./labels.md).

---

## 1. `[area:mcp] [good first issue]` Ship runnable `community/mcp-servers/echo` (stdio)

**Title:** Add minimal stdio Echo MCP server under `community/mcp-servers/echo`

**Body:**

```markdown
## Goal
Add a tiny MCP server (stdio) exposing one tool `echo` that returns the input string, with `package.json` scripts and a README that explains how to register it in Kletron.

## Acceptance
- [ ] `cd community/mcp-servers/echo && npm install && npm start` runs without Kletron monorepo deps
- [ ] README documents workspace registration + expected tool name `echo__echo` (slug may vary)
- [ ] No secrets in repo

## Notes
Pin `@modelcontextprotocol/sdk` to a version you tested. Link to upstream MCP TS examples.
```

---

## 2. `[area:mcp] [help wanted]` Slack MCP connector template

**Title:** Document + template for Slack workspace MCP (incoming webhooks or bot token)

**Body:**

```markdown
## Goal
Add `community/mcp-servers/slack-template/` with README covering token storage, least privilege, and a suggested tool surface (post message, list channels read-only).

## Acceptance
- [ ] README only is OK for v1 (no code) **or** minimal code if you can test it
- [ ] Security section: never commit tokens; reference Kletron connector patterns

## Labels
area:mcp, help wanted, design discussion
```

---

## 3. `[area:mcp] [help wanted]` GitLab MCP connector template

**Title:** GitLab MCP — template README + example tool list

**Body:**

```markdown
## Goal
Help self-hosters wire GitLab (issues, MRs, CI status read-only) via MCP.

## Acceptance
- [ ] `community/mcp-servers/gitlab-template/README.md` with API scopes + example `mcp.json` / env vars
- [ ] Explicitly mark which operations are read-only vs write-capable

## Labels
area:mcp, help wanted
```

---

## 4. `[area:mcp] [good first issue]` CLI: print bundled MCP tool names

**Title:** Add `npm run mcp:list-tools` script that prints tool catalog

**Body:**

```markdown
## Goal
Developer ergonomics: a root script that connects to local MCP (or reads static manifest) and prints tool names sorted — helps contributors avoid typos in graph JSON.

## Acceptance
- [ ] Documented in README / CONTRIBUTING
- [ ] Fails gracefully when MCP_URL unreachable

## Labels
area:mcp, good first issue
```

---

## 5. `[area:graphs] [good first issue]` Preset: changelog summarizer (single-node)

**Title:** Add `community/graph-presets/changelog-summarizer.json`

**Body:**

```markdown
## Goal
One-node graph tuned to read `CHANGELOG*` / `docs/` and produce a release summary. Short system prompt + conservative tool allowlist.

## Acceptance
- [ ] JSON validates against our graph shape (`nodes[].react`, `edges[].id|source|target`)
- [ ] README section in `community/graph-presets/README.md`

## Labels
area:graphs, good first issue
```

---

## 6. `[area:graphs] [design discussion]` Preset JSON schema doc

**Title:** Document AgentGraphDefinition JSON schema for contributors

**Body:**

```markdown
## Goal
Add `docs/agent-graph-schema.md` summarizing required fields, node kinds, edge conditions, and common pitfalls.

## Acceptance
- [ ] Links from `community/graph-presets/README.md` and root `ARCHITECTURE.md`
- [ ] One example graph annotated line-by-line

## Labels
area:graphs, design discussion, area:docs
```

---

## 7. `[area:graphs] [good first issue]` Improve validation error messages for invalid graphs

**Title:** Friendlier API errors when graph JSON is invalid

**Body:**

```markdown
## Goal
When graph create/update fails validation, return which node id / field failed (within reason — no huge stack traces to clients).

## Acceptance
- [ ] Unit test covering a bad `toolNames` entry
- [ ] Docs mention error shape if API contract changes

## Labels
area:graphs, good first issue
```

---

## 8. `[area:docs] [good first issue]` Alt text for diagrams

**Title:** Add alt text / captions to ASCII/mermaid diagrams in docs

**Body:**

```markdown
## Goal
Accessibility pass on `ARCHITECTURE.md`, `docs/architecture.md`, and `docs/README-archive.md` figures.

## Acceptance
- [ ] Each diagram has a short textual description nearby

## Labels
area:docs, good first issue
```

---

## 9. `[area:docs] [help wanted]` Quickstart: Linux notes (ports, Docker, permissions)

**Title:** Linux quickstart addendum (non-mac devs)

**Body:**

```markdown
## Goal
Expand README or `CONTRIBUTING.md` with Linux-specific notes: port collisions, `xdg-open`, Docker socket permissions, common `node-pty` build deps.

## Acceptance
- [ ] Tested on at least one mainstream distro (say which in PR)

## Labels
area:docs, help wanted
```

---

## 10. `[area:community] [good first issue]` Second example skill under `community/skills/`

**Title:** Add `community/skills/your-skill-name/SKILL.md` (read-only repo audit)

**Body:**

```markdown
## Goal
Add a small skill with front matter matching `.agent/skills/*/SKILL.md` conventions, focused on read-only repo audit steps.

## Acceptance
- [ ] Uses only read/list/search tools in `requiredTools`
- [ ] README link from `community/README.md`

## Labels
area:community, good first issue
```
