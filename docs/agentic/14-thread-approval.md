# Thread approval modes (per session)

Agent chat runs are stored as `agent_graph_runs`. Each run can carry a **thread approval mode** that adjusts tool execution on top of the workspace **tool approval** configuration.

## Modes

| Mode | Behavior |
|------|----------|
| `inherit` | Use workspace policy only (`getToolApprovalPolicy`). |
| `confirm_everything` | Every tool call requires human approval (auto-approved reads/bash are downgraded). |
| `full_auto_thread` | Relax policy so tools that would normally queue for approval run immediately, except guardrails below. |

## Guardrails (always)

- Tools listed in workspace **never auto-approve** still require approval (including any Kletron tool names you add there).
- Workspace per-tool **always_require** overrides are not relaxed by `full_auto_thread`.
- **Automation** runs ignore thread modes; they follow workspace policy only (and non-auto tools fail fast as today).

Read-only Kletron admin tools (`kletron_list_*`, `kletron_get_*`) follow the same readonly auto-approve rules as repo/API reads. Other Kletron tools follow normal workspace policy; `full_auto_thread` promotes pending approvals like other tools unless blocked by the **blocklist** (`neverAutoApproveTools`) or per-tool **`always_require`**.

## Bulk “Approve all” on the queue

Approving all **pending** edits in the UI only clears the current batch. It does not change the thread mode for future tool calls.

## API

- `GET /api/sessions/[id]` includes `threadApprovalMode` (defaults to `inherit` in JSON if unset).
- `PATCH /api/sessions/[id]` with `{ "threadApprovalMode": "inherit" | "confirm_everything" | "full_auto_thread" }`.
- `POST /api/sessions` accepts optional `threadApprovalMode`; if omitted, the server uses `defaultThreadApprovalMode` from workspace config (`GET /api/config/tool-approval`).

## Configuration UI

**Configuration → Workspace** includes tool approval defaults, including **default mode for new threads**.
