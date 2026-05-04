---
name: Federated search
version: 1.0.0
description: Execute cross-tool enterprise search — normalize results, rank by relevance and recency, and surface citations for each hit.
tags:
  - plugin-enterprise-search
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use for **“find everything about X”** across connected company tools, or when the user points you at a **search-strategy** plan to execute. This skill is about **retrieval and ranking**, not long-form synthesis (use **knowledge-synthesis** after).

## Principles

1. **Parallelize safely** — query independent sources in parallel when the runtime allows; respect rate limits and scope.
2. **Normalize** — common columns: **Title**, **Source** (tool), **Snippet**, **Author** if known, **Date**, **Link or id**.
3. **Rank** — blend recency and keyword match; boost authoritative doc types when the query is definitional.
4. **Deduplicate** — same URL or same thread id appears once; note cross-posts.
5. **Honest gaps** — “No results in Guru for ‘PSR’; try Confluence space Finance.”

## Per-source hints

- **Slack** — prefer search APIs or scoped channel reads; capture channel name.
- **Gmail / Microsoft 365** — thread subject + date; avoid full mailbox scans without narrow filters.
- **Notion / Guru / Atlassian (Confluence)** — page title, space/collection, last edited.
- **Asana / Jira** — task title, state, assignee.
- **Google Calendar** — event title, time, attendees for “meeting context” queries.

## Tools

Use **fetch_url** (and MCP tools exposed for each integration). **web_search** only for **public** context the user explicitly wants alongside internal results — label **External** clearly.

## Output

Markdown **result set**: grouped by source or by relevance block, each hit with a one-line why-it-matched. End with **Next steps** (narrow query, run **knowledge-synthesis**, or ask user for access).
