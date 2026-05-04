---
name: Example contribution
version: 1.0.0
description: Demonstrates the front matter Kletron expects for workspace skills contributed via community/.
tags:
  - example
  - community
requiredTools:
  - list_files
  - read_file
suggestedTools:
  - glob_files
outputFormat: markdown
---

## When to use

Use when teaching contributors how **skills** are structured. This file is safe to duplicate under a new slug in `community/skills/`.

## Steps

1. List the workspace root with `list_files`.
2. Read `README.md` if present and summarize in ≤5 bullets.

## Output

Return markdown with sections **Summary** and **Files inspected**.
