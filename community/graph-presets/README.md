# Graph presets (community)

JSON shapes compatible with Kletron’s **agent graph** documents (see `packages/server` types / built-ins in `agentGraphPresets.ts`).

## Files

| File | Purpose |
|------|---------|
| [simple-react-minimal.json](./simple-react-minimal.json) | Single-node ReAct with a **reduced** tool list for teaching |
| [code-comparator-stub.json](./code-comparator-stub.json) | Two-node stub showing how to name phases (fill prompts locally) |

## How to use today

1. Open **Agent graphs** in the web UI.
2. Create a new graph or duplicate an existing preset.
3. Use these JSON files as **reference** for node/edge layout — paste fields carefully; invalid graphs are rejected by the API.

> **Future:** a `npm run import:preset` CLI could load these automatically — see [docs/launch-issues.md](../../docs/launch-issues.md).

## Schema reference

The canonical shape is `AgentGraphDefinition` in the server package (`name`, `description`, `category`, `nodes[]`, `edges[]`). Each `nodes[]` entry with `react` has `systemPrompt`, `userPromptTemplate`, and `toolNames`.
