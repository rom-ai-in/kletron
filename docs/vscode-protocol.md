# VS Code Extension – Backend Protocol

## Overview
The extension talks to the existing Next.js API, so every request is prefixed with `backendUrl` (stored in `kletron.backendUrl`). The `BackendClient` utility adds `Content-Type: application/json` to all requests and an optional `Authorization: Bearer ...` header when `kletron.apiToken` is configured.

## Endpoints Used
```
POST   /api/agent/run                     # Start a new agent run
GET    /api/agent/status/{runId}          # Poll status & output of a run
GET    /api/agent/diff/{runId}            # Fetch the latest diff hunk for a run
POST   /api/agent/apply/{runId}           # Apply a diff to the workspace
GET    /api/editor/file/tree?path=...     # Browse workspace directories
POST   /api/editor/file/read              # Fetch a file preview
POST   /api/editor/file/write             # Persist an edit
GET    /api/health                        # Readiness probe
```

## Request / Response Formats

### Agent Run (POST `/api/agent/run`)
```json
{
  "prompt": "Implement a new function",
  "agentId": "my-agent-id"
}
```
Response:
```json
{"runId":"abc123", "status":"queued"}
```

### Run Status (GET `/api/agent/status/{runId}`)
```json
{ "status": "completed", "output": [ {"role":"assistant","content":"..."} ] }
```

### Diff (GET `/api/agent/diff/{runId}`)
```json
{"diffHunk":"@@ -1,3 +1,4 @@ ..."}
```

### Apply Diff (POST `/api/agent/apply/{runId}`)
```json
{ "diff": "@@ -1,3 +1,4 @@ ..." }
```
Response:
```json
{"status":"applied", "runId":"abc123"}
```

### File Helpers
```json
POST /api/editor/file/read   { "path": "src/foo.ts" }
POST /api/editor/file/write  { "path": "src/foo.ts", "content": "// new" }
GET  /api/editor/file/tree?path=src     // returns `{ path, entries: [{ name, isDirectory }] }`
```

## Streaming / Long‑Running Operations
`BackendClient.subscribeToRun(runId, handler)` polls `GET /api/agent/status/{runId}` every ~1.5 seconds and pushes status/output updates back to the chat panel. Once the backend returns `status: completed` or `failed`, the poller stops.
