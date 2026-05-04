# Agent Memory

> Source: `packages/server/src/services/agentMemoryService.ts` (143 lines)

## Overview

The Agent Memory system provides persistent, file-path-based key-value storage scoped to each workspace. Agents can read, write, list, and edit memory entries using familiar filesystem-style paths under `/memories/`.

## Data Model

```typescript
type MemoryEntry = {
  _id?: ObjectId;
  workspaceId: ObjectId;    // Scoped to workspace
  path: string;             // Normalized path (e.g. "/memories/project-plan.md")
  content: string;          // Arbitrary text content
  createdAt: Date;
  updatedAt: Date;
};
```

**Storage**: MongoDB collection `agent_memories` with automatic in-memory fallback when DB is unavailable.

## Path Normalization

All paths are validated and normalized by `normalizeMemoryPath(rawPath)`:

1. Trim whitespace
2. Ensure leading `/`
3. **Must start with `/memories/`** — throws if not
4. **Cannot contain `..`** — prevents directory traversal
5. Special case: `/memories` → `/memories/`

## Operations

### List
```typescript
async list(prefix: string, workspaceId: ObjectId): Promise<MemoryListItem[]>
```
Lists all entries matching a prefix pattern. Returns path, size (content length), and last updated date.

### Read
```typescript
async read(path: string, workspaceId: ObjectId): Promise<string>
```
Returns the content of a specific memory entry. Throws if not found.

### Write
```typescript
async write(path: string, content: string, workspaceId: ObjectId): Promise<void>
```
Creates or updates a memory entry. Uses MongoDB `upsert: true` for atomic create-or-update.

### Edit (Find and Replace)
```typescript
async edit(
  path: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  workspaceId: ObjectId
): Promise<{ occurrences: number; content: string }>
```
Performs in-place find-and-replace on memory content. Throws if `oldString` is not found.

## Integration with Executor

In `agentGraphExecutor.ts`, filesystem tool calls targeting `/memories/` paths are **intercepted** and routed to the memory service:

```
Agent calls: read_file("/memories/project-plan.md")
    ↓
Executor detects /memories/ prefix
    ↓
Routes to: agentMemoryService.read("/memories/project-plan.md", workspaceId)
    ↓
Returns content to agent (instead of filesystem read)
```

**Affected tools**: `list_files`, `read_file`, `write_file`

This allows agents to use familiar file operations while the data is actually stored in MongoDB — persistent across sessions and workspaces.

## Fallback Mode

When MongoDB is unavailable, a `fallbackMemory` `Map<string, MemoryEntry>` provides in-memory storage with the same API. Data is lost on server restart.
