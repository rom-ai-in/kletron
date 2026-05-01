# Context Graph

> Source: `packages/server/src/context/graph/ContextGraphStore.ts` (156 lines)  
> Source: `packages/server/src/context/graph/ContextRanker.ts` (123 lines)  
> Source: `packages/server/src/context/graph/ContextScanner.ts` (95 lines)  
> Source: `packages/shared/src/context/graph/ContextGraphTypes.ts` (72 lines)

## Overview

The Context Graph is an in-memory graph database that models the structural relationships within a workspace (files, imports, symbols). It enables the agent to intelligently select which files and code fragments are most relevant to the current task by scoring them based on recency, proximity, and user prompt mentions.

## Data Model

### ContextNode

Represents a file, symbol, agent, diff, or conversation entity:

```typescript
interface ContextNode {
  id: string;              // Absolute path (files) or unique ID
  type: ContextNodeType;   // 'file' | 'symbol' | 'agent' | 'diff' | 'conversation'
  label: string;           // Display name (e.g. basename)
  
  metadata: {
    language?: string;      // File extension
    size?: number;          // File size in bytes
    lastModified?: number;  // mtime (ms)
    createdAt?: number;     // birthtime (ms)
    phaseId?: string;       // For agent nodes
    agentId?: string;       // For agent nodes
    kind?: string;          // For symbols: 'function', 'class', 'interface'
    embedding?: number[];   // For future semantic search
  };
  
  stats: {
    viewCount: number;
    editCount: number;
    lastViewed?: number;    // Timestamp (ms)
    lastEdited?: number;    // Timestamp (ms)
  };
}
```

### ContextEdge

Directed edge between two nodes:

```typescript
interface ContextEdge {
  id: string;                // Unique edge identifier
  source: string;            // Source node ID
  target: string;            // Target node ID
  type: ContextEdgeType;     // Relationship type
  weight?: number;           // 0-1, semantic similarity or strength
}
```

**Edge types**: `imports`, `extends`, `implements`, `contains`, `calls`, `edited_by`, `created_diff`, `referenced_in`, `similar_to`

### EditorState

Current state of the user's editor:

```typescript
interface EditorState {
  openFiles: string[];      // Absolute paths of open tabs
  activeFile: string | null; // Currently focused file
  cursorPosition: { line: number; column: number } | null;
  recentEdits: { file: string; timestamp: number; linesChanged: number }[];
  visibleRanges: { file: string; startLine: number; endLine: number }[];
}
```

## Components

### ContextGraphStore

In-memory graph with adjacency lists and JSON persistence:

```typescript
class ContextGraphStore {
  private nodes: Map<string, ContextNode>;
  private edges: Map<string, ContextEdge>;
  private adjacency: Map<string, Set<string>>;  // nodeID → Set<edgeID>
  private persistencePath: string;               // .kletron/context_graph.json
}
```

**Key operations**:

| Method | Purpose |
|---|---|
| `addNode(node)` | Insert or merge node (stats + metadata) |
| `addEdge(edge)` | Insert edge and update adjacency lists |
| `getNode(id)` | Lookup by ID |
| `getEdges(nodeId)` | All edges touching a node |
| `getIncomingEdges(nodeId, type?)` | Edges where `target === nodeId` |
| `getOutgoingEdges(nodeId, type?)` | Edges where `source === nodeId` |
| `getAllNodes()` | All nodes in the graph |
| `getNeighborhood(startNodeId, maxDepth)` | BFS traversal up to N hops |
| `load()` | Load from `.kletron/context_graph.json` |
| `save()` | Persist to disk (creates `.kletron/` dir if needed) |

**Per-workspace stores**:
```typescript
function getContextGraphStore(workspaceId: string, rootPath: string): ContextGraphStore {
  // One store per workspace, cached in storeMap
  // Persistence at: rootPath/.kletron/context_graph.json
}
```

### ContextScanner

Builds the graph by scanning workspace files and analyzing imports:

```typescript
class ContextScanner {
  async scanWorkspace(rootDir: string, store: ContextGraphStore) {
    // 1. Find files via fast-glob: **/*.{ts,tsx,js,jsx,md,json}
    //    Ignores: node_modules, .git, .next
    //
    // 2. Create ContextNode for each file:
    //    - id = absolute path
    //    - type = 'file'
    //    - metadata = { language, size, lastModified, createdAt }
    //
    // 3. Analyze imports (regex-based):
    //    - Match: import ... from '...'
    //    - Resolve relative paths with extension candidates:
    //      [.ts, .tsx, .js, /index.ts]
    //    - Create ContextEdge with type = 'imports'
    //
    // 4. Persist: store.save()
  }
}
```

### ContextRanker

Scores and ranks nodes based on relevance:

```typescript
class ContextRanker {
  async rank(query: GraphQuery): Promise<RankedContextItem[]> {
    // 1. Score all nodes
    // 2. Sort by score descending
    // 3. Filter score > 0.1
    // 4. Limit to query.limit (default: 20)
  }
}
```

**Scoring weights**:

| Factor | Weight | Signal |
|---|---|---|
| Recency | 0.30 | Time decay: `1 / (1 + hoursAgo/24)` — full score at 0h, half at 24h |
| Proximity | 0.25 | Graph distance from open/active files |
| Mention | 0.15 | If user prompt mentions the filename or label |
| Semantic | 0.20 | *TODO: Embeddings (not yet implemented)* |

**Proximity scoring**:
- **Direct match** (file is open): `1.0 × 0.25`
- **1-hop neighbor** (imported by open file): `0.5 × 0.25`
- **No connection**: `0`

**Token budget pruning**:
```typescript
pruneToBudget(items: RankedContextItem[], budget: number): RankedContextItem[] {
  // Estimated tokens per file: metadata.size / 4
  // Greedily add files until budget exhausted
}
```

### GraphQuery

Query input for ranking:

```typescript
interface GraphQuery {
  userPrompt: string;
  editorState: EditorState;
  limit?: number;           // Max items (default: 20)
  tokenBudget?: number;
  includeTypes?: ContextNodeType[];
}
```

### RankedContextItem

Ranking output:

```typescript
interface RankedContextItem {
  node: ContextNode;
  score: number;
  reasons: string[];         // e.g. ["Recently active", "Related to open file"]
  contentPreview?: string;
}
```

## Integration with Executor

In `agentGraphExecutor.ts`:

1. **Initialization**: `ensureContextGraphReady(workspaceId, rootPath)` — loads existing graph or triggers scan
2. **Per-node enrichment**: Ranked context items are injected into the system prompt
3. **Editor state**: Sourced from the `EditorStateManager` which tracks open files and cursor position
