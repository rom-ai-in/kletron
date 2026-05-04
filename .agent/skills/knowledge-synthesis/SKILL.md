---
name: Knowledge synthesis
version: 1.0.0
description: Merge findings from multiple enterprise sources into one coherent answer with aligned terminology and explicit uncertainty.
tags:
  - plugin-enterprise-search
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
outputFormat: markdown
---

## When to use this skill

Use after raw hits exist (from **search** or ad hoc pulls) and the user wants a **single narrative**: “what do we know about X?”, “synthesize the Phoenix decision”, “reconcile what Slack vs Confluence says.”

## Principles

1. **One thesis** — state the clearest conclusion first, then support.
2. **Triangulate** — prefer claims backed by two independent sources when possible; label single-source claims.
3. **Conflict handling** — if sources disagree, present both and note dates (newer doc often wins; not always).
4. **Terminology** — normalize names (project codenames, acronyms) using **source-management** citations.

## Workflow

1. Collect **bullet facts** with provenance (tool + title + link or id).
2. **Group** into themes (timeline, owners, risks, open questions).
3. **Synthesize** into short sections; avoid bullet dumps unless the user asked for an index.
4. Add **Confidence** footnotes: High / Medium / Low per major claim.
5. List **Open gaps** — what still needs a human or another search.

## Relationship to other skills

- **search-strategy** — plans what to fetch; **knowledge-synthesis** — combines what was fetched.
- **digest** — time-oriented rollup; **knowledge-synthesis** — topic-oriented merge.

## Output

Structured markdown: executive answer, supporting detail, conflicts, citations (see **source-management**), and follow-up questions.
