# Desktop API parity (manual QA)

Desktop uses the same `/api/*` routes as the web app with **Bearer** `Authorization` and **`x-workspace-id`** when a workspace is active. Use this matrix when changing hooks or routes.

| Area | Method | Path | Headers |
|------|--------|------|---------|
| Auth probe | GET | `/api/auth/me` | `Authorization` optional |
| Sessions list | GET | `/api/sessions?limit=50&workspaceId=` | Bearer, `x-workspace-id` |
| Sessions archived | GET | `/api/sessions?...&includeArchived=true` | same |
| Session detail | GET | `/api/sessions/:id` | same |
| Work mode | GET | `/api/work-categories/current?workspaceId=` | same |
| Work mode | POST | `/api/work-categories/current` body `{ workMode, workspaceId? }` | same |
| Stream / chat | POST | `/api/sessions` (NDJSON) | same + body from `useSessionStream` |
| History | GET | `/api/history/runs?workspaceId=&limit=100` | same |
| Automations | GET | `/api/automations` | same (via `apiFetch` / `useAutomations`) |
| Automation run | PUT | `/api/automations/:id/execute` | same |
| Agent graphs | GET/POST | `/api/agent-graphs` | same |
| Graph runs | GET | `/api/agent-graph-runs?graphId=&limit=20` | same |
| Connectors | GET | `/api/workspaces/:id/connectors/integrations` | same |

## Smoke checklist

1. Select workspace → thread list loads (`/api/sessions`).
2. Open thread → stream or load history (`useSessionStream` / session detail).
3. Switch Code/Work mode → POST `/api/work-categories/current` and TitleBar reflects mode.
4. Automations → list → Run now → optional jump to agent thread if `threadId` returned.
5. Graphs → New graph → creates via POST `/api/agent-graphs` (shared default payload).
6. Settings → Web portal → opens expected `/app/*` path in system browser (same origin as backend).
