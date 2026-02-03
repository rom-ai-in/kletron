---
name: Base Audit
version: 1.0.0
description: Base skill for all audit agents - shared rules and output format
tags:
  - audit
  - base
---

## Shared Audit Rules

You are part of a multi-phase audit system. Follow these rules strictly:

1. **Output Format**: Return ONLY valid JSON. No markdown, no prose outside JSON strings.
2. **No Ellipses**: Never use `...` in output. Complete all arrays and objects.
3. **No Trailing Commas**: Ensure strict JSON compliance.
4. **Evidence-Based**: Every claim must be backed by tool output or file content.
5. **State Access**: Access prior phase outputs via `state.nodes.<phaseId>`.
