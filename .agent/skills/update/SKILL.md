---
name: Update
version: 2.0.0
description: Sync TASKS.md with external tools, triage stale work, fill memory gaps from task text, and optionally run a comprehensive activity scan.
tags:
  - plugin-productivity
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use when the user wants to **refresh** the productivity system: pull tasks from trackers, triage overdue items, decode unknown shorthand in tasks into **memory/**, or run **`--comprehensive`** to scan chat, email, calendar, and docs for missed todos and new entities.

If connectors are unclear, check **CONNECTORS.md** in the workspace when present.

## Modes

| Mode | Command pattern | Behavior |
|------|-----------------|----------|
| Default | productivity **update** | Sync, triage, memory gap fill from tasks. |
| Deep | productivity **update** with comprehensive flag | Everything in default, plus activity scan and suggestions. |

(Exact slash-command names depend on the host app; the intent is “update” vs “update + comprehensive”.)

## Default mode — steps

### 1. Load state

Read **TASKS.md** and the **memory/** tree (and **CLAUDE.md**). If missing, suggest running **start** first.

### 2. Sync from external sources (when available)

If MCP or CLI access exists, examples include:

- Issue trackers: GitHub `gh issue list --assignee=@me`, Linear, Jira, Asana, etc.
- Compare external open items to **TASKS.md** by fuzzy title match.

| Situation | Action |
|-----------|--------|
| External task not in TASKS.md | Offer to add. |
| Already in TASKS.md | Skip duplicate. |
| In TASKS.md but not externally | Flag possibly stale. |
| Done externally but still Active | Offer to mark done. |

Present a short diff; **never auto-add or auto-complete without user confirmation** unless the user explicitly asked for automatic sync.

### 3. Triage stale items

Flag:

- Due dates in the past.
- **Active** items older than ~30 days without progress context.
- Tasks with no owner/project context when that matters.

Offer: mark done, reschedule, or move to **Someday**.

### 4. Decode tasks for memory gaps

For each task line, resolve people, projects, acronyms, tools. Track ✓ vs missing. Use **memory-management** rules for where to store new entries.

### 5. Fill gaps

List unknown terms with the task quote:

```text
1. "Phoenix" — from: "…"
2. "Maya" — from: "…"
```

After the user answers, update **memory/glossary.md**, **people/**, **projects/**, and **CLAUDE.md** as appropriate.

### 6. Enrichment

From tasks, capture links, deadlines, status phrases, and relationships between people/projects; update the relevant markdown files.

### 7. Report

Summarize: tasks added/completed/triaged, memory gaps filled, whether everything decoded.

## Comprehensive mode — extra steps

After completing default mode:

### Activity scan

From available MCP sources (chat, email, documents, calendar):

- Build a short digest of recent people, projects, and commitment-like phrases.

### Missed todos

Compare activity to **TASKS.md**. List candidate follow-ups (“I’ll send X by Friday”) and ask which to add.

### New memory suggestions

Surface entities not in memory (new people, codenames). Group by confidence; offer to add high-confidence items after confirmation.

### Cleanup suggestions

Note stale projects (no mentions in 30 days) and ask if they should be demoted or marked complete per **memory-management**.

## Guardrails

- Do **not** auto-add tasks or memories without user confirmation (unless they explicitly requested bulk import with defaults).
- Preserve external links and IDs when syncing.
- **Comprehensive** mode should stay interactive when presenting many candidates.

## Tools

Use **fetch_url** and connector-backed tools for trackers and docs. **web_search** only when the user needs public verification of a term.

## Output

Markdown report: sync results, triage list, memory updates, and optional comprehensive findings.
