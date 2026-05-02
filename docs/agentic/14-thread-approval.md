# Thread approval modes (per session)

Agent chat runs are stored as `agent_graph_runs`. Each run can carry a **thread approval mode** that adjusts tool execution on top of the workspace **tool approval** configuration.

## Modes

| Mode | Behavior |
|------|----------|
| `inherit` | Use workspace policy only (`getToolApprovalPolicy`). |
| `confirm_everything` | Every tool call requires human approval (auto-approved reads/bash are downgraded). |
| `full_auto_thread` | Relax policy so tools that would normally queue for approval run immediately, except guardrails below. |

## Guardrails (always)

- **Kletron admin tools** always stay on the approval path.
- Tools listed in workspace **never auto-approve** still require approval.
- Workspace per-tool **always_require** overrides are not relaxed.
- **Automation** runs ignore thread modes; they follow workspace policy only (and non-auto tools fail fast as today).

## Bulk “Approve all” on the queue

Approving all **pending** edits in the UI only clears the current batch. It does not change the thread mode for future tool calls.

## API

- `GET /api/sessions/[id]` includes `threadApprovalMode` (defaults to `inherit` in JSON if unset).
- `PATCH /api/sessions/[id]` with `{ "threadApprovalMode": "inherit" | "confirm_everything" | "full_auto_thread" }`.
- `POST /api/sessions` accepts optional `threadApprovalMode`; if omitted, the server uses `defaultThreadApprovalMode` from workspace config (`GET /api/config/tool-approval`).

## Configuration UI

**Configuration → Workspace** includes tool approval defaults, including **default mode for new threads**.
