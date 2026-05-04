# Echo MCP (community example)

**Concept:** a trivial MCP server exposing `echo.message` that returns the input string. Use it to verify workspace MCP registration end-to-end.

## Implement in 10 minutes

1. Create `src/server.ts` using `@modelcontextprotocol/sdk` server APIs (see upstream examples).
2. Register one tool:

```json
{
  "name": "echo_message",
  "description": "Returns the input text unchanged",
  "inputSchema": {
    "type": "object",
    "properties": { "text": { "type": "string" } },
    "required": ["text"]
  }
}
```

3. Run with stdio or SSE as supported by your workspace connector.

## Why no code in this folder?

MCP SDK versions move quickly; we keep this folder as a **spec + README** so contributors paste the official boilerplate and iterate. If you ship a pinned minimal server in a PR, we can merge it behind `community/mcp-servers/echo/src/`.

## Kletron wiring

After the server runs locally, add it under **Workspace → MCP servers** (or the equivalent API) with a unique slug, e.g. `echo`, so tools appear as `echo__echo_message`.
