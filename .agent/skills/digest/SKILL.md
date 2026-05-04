---
name: Digest
version: 1.0.0
description: Build daily or weekly activity digests from email, chat, calendar, and docs using connected enterprise sources.
tags:
  - plugin-enterprise-search
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use when the user asks for a **daily digest**, **weekly catch-up**, **what I missed**, or a **rollup of activity** across company systems (Slack, Gmail, Calendar, Notion, Confluence, Asana, Guru, etc.) with connectors enabled.

## Principles

1. **Time box** — agree implicit window if not stated (e.g. “today” = since local midnight; “this week” = last 7 days or Mon–Sun per user preference).
2. **Source coverage** — list which connected tools you queried and which were skipped (no connector, no permission).
3. **Signal over noise** — group by theme (meetings, decisions, blockers, mentions) not by raw tool dump.
4. **Actionable** — end with optional “Suggested follow-ups” (untracked).

## Workflow

1. Confirm **scope**: person (me / team), **time range**, and **topics** or projects to emphasize.
2. For each available connector, run **targeted** reads or searches (channels, inbox filters, calendar events, wiki spaces, Guru collections, Jira boards) via **fetch_url** and workspace MCP tools — do not fabricate message content.
3. **Cluster** items: decisions, deadlines, questions directed at the user, incidents, doc updates.
4. **Deduplicate** the same story appearing in Slack + email.
5. Output a **compact markdown digest** with sections:

   - **Headline** — one-line summary.
   - **Calendar** — key meetings and prep items.
   - **Communication** — important threads (Slack/email) with channel/source and approximate time.
   - **Work tracking** — Asana/Jira-relevant updates if connected.
   - **Docs & knowledge** — Notion/Guru/Confluence pages that changed or were cited.
   - **Gaps** — “Could not check X (not connected)” when relevant.

## Guardrails

- Respect privacy: summarize; quote minimally unless the user asked for verbatim.
- If data is incomplete, say so and suggest **search** or **search-strategy** for a deeper pass.

## Output

A dated digest in markdown, suitable for skimming in under two minutes.
