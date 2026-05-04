---
name: Start
version: 2.0.0
description: Initialize the productivity system — TASKS.md, CLAUDE.md, memory/, optional dashboard — and bootstrap workplace shorthand from the user’s real task list.
tags:
  - plugin-productivity
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use for **first-time setup** of the productivity bundle, bootstrapping **CLAUDE.md** and **memory/** from existing todos, or when the user runs the productivity **start** command / asks to “set up tasks and memory.”

If connectors or placeholders are unclear, the workspace may ship a **CONNECTORS.md** — consult it when present.

## What to check

In the **current working directory**, look for:

| Path | Purpose |
|------|---------|
| **TASKS.md** | Task list (create from **task-management** template if missing). |
| **CLAUDE.md** | Working memory hot cache. |
| **memory/** | Deep memory (glossary, people, projects, context). |
| **dashboard.html** | Optional visual UI for tasks (only if provided in your bundle or template). |

## Create what’s missing

1. **TASKS.md** — If absent, create with the standard template from the **task-management** skill.
2. **dashboard.html** — If your productivity bundle includes a dashboard asset, copy it into the working directory. If the repo or bundle does **not** include one, skip this step and tell the user tasks and memory still work via **TASKS.md** and markdown files.
3. **CLAUDE.md** and **memory/** — If both are absent, treat this as a **fresh memory setup** and run the bootstrap workflow below after orienting the user.

## Open the dashboard (when it exists)

In sandboxed or headless agent environments, **do not** rely on `open` / `xdg-open` to reach the user’s browser. Tell the user explicitly: e.g. “If you added **dashboard.html**, open it from your file browser or workspace preview.”

## If already initialized

Report briefly:

- Tasks and memory are already present.
- Suggest **update** (productivity sync): default refresh, or comprehensive scan when they want a deep pass.

## Bootstrap memory (first run only)

Only when **CLAUDE.md** and **memory/** do not exist yet (or the user asks for a full re-bootstrap).

1. **Ask** where they keep todos: local file, TASKS.md, Linear, Asana, Notion, etc.
2. Use **TASKS.md** or the source they provide. For each task line, look for nicknames, acronyms, project codenames, jargon.
3. **Decode interactively** — for each unknown term, ask one clear question (PSR = ?, Todd = ?, Phoenix = ?). Skip terms already in memory.
4. Optionally offer a **comprehensive scan** (chat, email, calendar, docs via MCP when available). If they accept, gather high-signal entities; group by confidence (ready to add / needs clarification / low frequency).
5. **Write files:**
   - **CLAUDE.md** — compact tables: Me, People, Terms, Projects, Preferences (~50–80 lines).
   - **memory/glossary.md** — full decoder ring.
   - **memory/people/{slug}.md**, **memory/projects/{slug}.md**, **memory/context/company.md** as needed.
6. **Report** — counts of tasks, people, terms, projects; remind them to use **update** to stay current.

## Tools

Use **fetch_url** for user-provided links and connected integrations. Use **web_search** sparingly for public context only when it helps disambiguate a term the user confirms.

## Output

Confirmation of what was created, what was skipped (e.g. no dashboard file), and next steps (**update**, daily use of TASKS.md + memory).
