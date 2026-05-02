---
name: Source management
version: 1.0.0
description: Track provenance for enterprise search — stable citations, deduplication IDs, and notes for reproducible re-runs.
tags:
  - plugin-enterprise-search
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use alongside **search** and **knowledge-synthesis** when answers must be **traceable**: audits, exec summaries, legal/compliance-adjacent questions, or any “where did this claim come from?”

## Principles

1. **Cite every non-obvious claim** — tool name + stable identifier (message ts + channel, message id, page id, issue key, event id).
2. **Prefer links** when the integration returns canonical URLs; otherwise structured ids.
3. **Dedupe key** — same resource in two tools (Slack link vs mirrored Notion) → one primary citation + “also referenced in …”.
4. **Snapshot note** — “Retrieved at [ISO time]; content may have changed.”
5. **Sensitivity** — flag if a source is DMs or restricted spaces; avoid echoing secrets in summaries.

## Citation format (recommended)

```text
[Slack #eng] 2026-05-01 — user@… — "quote or paraphrase…" (permalink if available)
[Confluence] Space KEY — Page title — version or last-modified
[Guru] Card title — collection — card id
```

## Reproducibility

For repeated questions, store **query parameters** (keywords, date range, spaces) so **update**-style reruns or the user can duplicate the search later.

## Output

A **reference list** section appended to the main deliverable, or inline footnotes — pick one style and stay consistent within the document.
