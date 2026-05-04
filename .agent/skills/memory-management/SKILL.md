---
name: Memory Management
version: 2.0.0
description: Two-tier workplace memory — hot cache in CLAUDE.md, full knowledge base in memory/. Decodes shorthand, acronyms, nicknames, and internal language.
tags:
  - plugin-productivity
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use when the user needs **workplace memory**: decoding nicknames and acronyms, maintaining a glossary, remembering people and projects, or answering “what does X mean?” / “who is Y?”. This is the **productivity** plugin’s memory system (not the same as optional workspace agent memory under `/memories/` paths, which is server-side key-value storage).

## The goal

Turn shorthand into understanding so requests read like a colleague would:

- User: “ask todd to do the PSR for oracle”
- Decoded: ask Todd Martinez (Finance lead) to prepare the Pipeline Status Report for the Oracle Systems deal.

Without memory, that request is ambiguous. With memory, people, terms, and deals are resolved.

## Architecture

| Layer | Role |
|--------|------|
| **CLAUDE.md** (working directory) | Hot cache: ~30 frequent people, ~30 common terms, active projects, preferences. Target ~50–100 lines. |
| **memory/glossary.md** | Full decoder ring: every acronym, nickname, codename. |
| **memory/people/** | Rich profiles: `{name}.md` (lowercase, hyphens). |
| **memory/projects/** | Project detail files. |
| **memory/context/** | Company, teams, tools (e.g. `company.md`). |

**Lookup flow (always decode before acting):**

1. **CLAUDE.md** — covers most daily decoding.
2. **memory/glossary.md** — if missing from hot cache.
3. **memory/people/**, **memory/projects/**, **memory/context/** — depth for execution.
4. **Ask the user** — “What does X mean? I’ll remember it.”

## Working memory format (CLAUDE.md)

Use tables for scanability. Keep under ~100 lines (“hot 30” rule).

```markdown
# Memory

## Me
[Name], [Role] on [Team]. [One sentence.]

## People
| Who | Role |
|-----|------|
| **Todd** | Todd Martinez, Finance lead |
→ Full list: memory/glossary.md; profiles: memory/people/

## Terms
| Term | Meaning |
|------|---------|
| PSR | Pipeline Status Report |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **Phoenix** | DB migration, Q2 launch |
→ Details: memory/projects/

## Preferences
- Async-first, Slack over email
```

## Deep memory formats

**memory/glossary.md** — sections for Acronyms, Internal Terms, Nicknames → Full Names, Project Codenames.

**memory/people/{slug}.md** — Also known as, Role, Team, Communication, Context, Notes.

**memory/projects/{slug}.md** — Codename, status, what it is, key people, budget/timeline, links.

**memory/context/company.md** — Tools & systems, teams, processes.

## Adding memory

When the user says “remember this” or “X means Y”:

- **Glossary items** → `memory/glossary.md`; promote frequent items to CLAUDE.md **Terms**.
- **People** → `memory/people/{slug}.md` + nickname lines in glossary; add to CLAUDE.md **People** if top contacts.
- **Projects** → `memory/projects/{slug}.md` + codenames in glossary; CLAUDE.md **Projects** if active.
- **Preferences** → CLAUDE.md **Preferences**.

## Recalling memory

For “who is X?” / “what does X mean?”: CLAUDE.md first, then `memory/`. If unknown, say so and invite the user to teach you.

## Promotion / demotion

- **Promote to CLAUDE.md** when a term or person is used often or is central to active work.
- **Demote** to `memory/` only when stale (project done, contact rare).

## Conventions

- Bold key rows in CLAUDE.md for scanability.
- Filenames: lowercase, hyphens (`todd-martinez.md`, `project-phoenix.md`).
- Always capture nicknames and alternate names in glossary and people files.

## Tools

Use **fetch_url** (and workspace integrations when connected) to pull context from linked docs or internal pages the user authorizes. Use **web_search** only for public definitions when the user asks for external meaning of a term.

## Output

Structured markdown: decoded entities, file paths touched, and what was added or updated.
