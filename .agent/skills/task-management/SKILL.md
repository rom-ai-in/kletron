---
name: Task Management
version: 2.0.0
description: Shared TASKS.md task list in the working directory — read, add, complete, and summarize with a simple sectioned format.
tags:
  - plugin-productivity
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use when the user asks about tasks, wants to add or complete items, track commitments, or keep a lightweight task board aligned with the productivity bundle.

## File location

Always use **TASKS.md** in the **current working directory**.

- If it exists: read and write it.
- If it does not exist: create it using the template below.

## Dashboard (optional)

If your environment provides a **dashboard.html** for this productivity bundle, ensure it lives in the working directory so it can read/write the same **TASKS.md**. If no HTML dashboard is bundled, **TASKS.md** remains the source of truth; suggest the **start** skill when the user wants the full productivity setup.

## Template (new TASKS.md)

Use this structure (no example tasks):

```markdown
# Tasks

## Active

## Waiting On

## Someday

## Done
```

## Task line format

- Checkbox: `- [ ]` or `- [x]` for done.
- **Bold** the task title for scanability.
- Sub-bullets for detail.
- Completed: `- [x] ~~Task title~~ (YYYY-MM-DD)` and move to **Done**.

Example active line:

```markdown
- [ ] **Send PSR to Todd** - Phoenix blockers, due Friday
  - Include link to latest sheet
```

## How to interact

| User intent | Action |
|-------------|--------|
| “What’s on my plate?” / “my tasks” | Read TASKS.md; summarize **Active** and **Waiting On**; flag overdue or urgent. |
| “Add a task” / “remind me to…” | Append to **Active** with context (for whom, due date). |
| “Done with X” / “finished X” | Find the task, mark `[x]`, strikethrough title, date, move to **Done**. |
| “What am I waiting on?” | Read **Waiting On**; note age if useful. |

## Conventions

- Include **for [person]** when it’s a commitment to someone.
- Include **due [date]** for deadlines; **since [date]** for waiting items.
- Trim **Done** to about the last week of completions when it gets long.

## Extracting tasks from meetings or chat

When summarizing conversations, offer to add extracted tasks (commitments, action items, follow-ups) **after user confirmation** — do not silently add.

## Tools

Use **fetch_url** when tasks reference URLs or internal docs that need to be opened with user-authorized access.

## Output

Clear markdown summary of tasks, or confirmation of edits made to TASKS.md.
