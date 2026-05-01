---
name: code-comparator
description: >-
  Kletron workflow for comparing repository history and diffs via Git MCP tools,
  anchored to the Changes page at http://localhost:3000/app/changes. Use when
  the user asks about code evolution, commit timelines, patch review, or the
  Code Comparator agent graph.
disable-model-invocation: true
---

# Code Comparator (Kletron)

## When this applies

Use when the user wants diff timelines, historical comparison, or “what changed” analysis tied to the Kletron web app.

## Canonical instructions

Read and follow the repository builtin skill body (same slug):

`.agent/skills/code-comparator/SKILL.md`

## Human-facing URL

**http://localhost:3000/app/changes**

## Agent graph

In Kletron, use preset graph **Code Comparator (agent graph)** so node `skillIds` loads builtin skill **`code-comparator`**.
