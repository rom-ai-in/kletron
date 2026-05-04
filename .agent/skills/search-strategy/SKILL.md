---
name: Search strategy
version: 1.0.0
description: Plan federated queries across Slack, email, wikis, tickets, and calendar — synonyms, source order, and stop conditions before executing search.
tags:
  - plugin-enterprise-search
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use **before** a large cross-tool pull when the question is broad (“everything on Oracle deal”, “all Phoenix blockers”) or when the user’s first query is ambiguous. Produces a **search plan** the agent (or user) can approve.

## Principles

1. **Rephrase intent** — user goal in one sentence; list **must-have** vs **nice-to-have** facets.
2. **Entity expansion** — nicknames, ticket keys (PROJ-123), email domains, alternate project names.
3. **Source mapping** — which connector is best for which facet:

   | Need | Typical sources |
   |------|-------------------|
   | Real-time discussion | Slack |
   | Formal decisions / specs | Notion, Confluence (Atlassian), Guru |
   | Tasks / ownership | Asana, Jira (via Atlassian) |
   | Scheduling | Google Calendar, Microsoft 365 |
   | Async commitments | Gmail, Slack |

4. **Ordering** — start with highest-recall or authoritative sources for the topic (e.g. wiki for definitions, Slack for latest chatter).
5. **Stop rules** — max rounds, diminishing returns, or “enough to answer the question.”

## Deliverables

- **Query list** — per source: keywords, filters (date, channel, space), and expected result type.
- **Risks** — missing connectors, likely false positives (common words), PII boundaries.
- **Handoff** — “Run **search** with this plan” or execute stepwise with user checkpoints.

## Output

A concise markdown plan: intent, expanded terms, ordered source checklist, and stop criteria.
