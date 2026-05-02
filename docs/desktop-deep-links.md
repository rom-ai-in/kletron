# Desktop deep links

The Electron renderer uses the embedded page URL (`window.location`) for lightweight routing.

## Query parameters

| Parameter       | Effect |
|----------------|--------|
| `sessionId`    | Selects that agent session/thread after sign-in. Synced to the URL when the active thread changes. |
| `view`         | One of `app`, `history`, `automations`, `agent-graphs`, `settings`. Applied once per load. |
| `graphId`      | Switches to **Graphs** and opens `/app/agent-graphs/{graphId}` in the browser (same origin as the backend URL). |
| `automationId` | Switches to **Automations** and opens `/app/automations/{automationId}` in the browser. |

## Hash routes

`#automations`, `#agent-graphs`, `#settings`, `#history` update the active view (hashchange listener).

## Requirements

- The host configured as **Backend URL** must serve the Next.js app for `/app/*` paths used by **Open in browser** and automation/graph deep links.
- `kletron://` custom protocol support may be added later in the main process for OS-level links.
