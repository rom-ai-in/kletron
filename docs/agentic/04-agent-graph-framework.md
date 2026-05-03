# Agent Graph Framework

> Source: `packages/server/src/services/agentGraphTypes.ts` (216 lines)  
> Source: `packages/server/src/services/agentGraphService.ts` (195 lines)  
> Source: `packages/server/src/services/agentGraphRuntime.ts` (45 lines)  
> Source: `packages/server/src/services/agentGraphTopo.ts` (62 lines)  
> Source: `packages/shared/src/graphCatalog.ts` (159 lines)

## Overview

The Agent Graph Framework is a custom orchestration engine for defining and executing multi-node agentic workflows. Graphs are stored in MongoDB as `AgentGraphDefinition` documents and executed by the `AgentGraphExecutor`.

## Core Types

### AgentGraphDefinition

The top-level graph structure stored in the `agent_graphs` MongoDB collection:

```typescript
interface AgentGraphDefinition {
  _id?: ObjectId;
  name: string;
  description?: string;
  category?: "deep_agent" | "graph" | "automation" | "drift" 
           | "continuous_improvement" | "business_analysis";
  createdAt: Date;
  updatedAt: Date;
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  execution?: AgentGraphExecutionConfig;
  stateDefaults?: Record<string, unknown>;  // Merged into initial run state
}
```

### AgentGraphNode

Each node represents a single agentic execution step:

```typescript
type AgentGraphNode = {
  id: string;                          // Unique identifier (e.g. "drift_scan")
  label: string;                       // Display name
  kind?: "react" | "router" | "delegate";  // Node behavior type
  react: AgentGraphNodeReactConfig;    // LLM execution config
  delegate?: AgentGraphNodeDelegateConfig;  // Sub-graph delegation
  output: AgentGraphNodeOutputConfig;  // Output schema & state path
};
```

### AgentGraphNodeReactConfig

Controls how the LLM executes within a node (provider/model come from the Agent composer, automation stage, or Configuration → LLM — not from the node):

```typescript
type AgentGraphNodeReactConfig = {
  systemPrompt: string;                // Full system prompt for the LLM
  userPromptTemplate: string;          // Template with {{state}} placeholders
  toolNames: string[];                 // Allowlisted tool names
  skillIds?: string[];                 // Agent skills to inject
  maxToolCalls?: number;               // Hard cap on tool calls
  interruptBeforeTools?: boolean;      // Human-in-the-loop flag
};
```

### AgentGraphEdge

Directed edges connecting nodes, with optional conditions:

```typescript
type AgentGraphEdge = {
  id: string;
  source: string;        // Source node ID
  target: string;        // Target node ID
  condition?: string;    // Expression evaluated against state
  // Examples: 'state.nextStep == "debug"', 'exists(state.plan)'
};
```

### AgentGraphExecutionConfig

Controls how the graph is traversed:

```typescript
type AgentGraphExecutionConfig = {
  mode?: "dag" | "state_machine";
  entryNodeId?: string;         // For state_machine mode
  maxIterations?: number;       // Loop guard (default: 200)
  maxNodeRuns?: number;         // Per-node loop guard (default: 20)
};
```

### AgentGraphNodeOutputConfig

Defines how node output is parsed and stored:

```typescript
type AgentGraphNodeOutputConfig = {
  schemaId: string;        // Output schema key (e.g. "generic_json", "conversational")
  statePath?: string;      // Path to write output in state (e.g. "state.drift")
  stateMerge?: boolean;    // Shallow-merge with existing value
};
```

### AgentGraphNodeDelegateConfig

For `kind: "delegate"` nodes:

```typescript
type AgentGraphNodeDelegateConfig = {
  mode: "react" | "graph";        // Execute as ReAct or sub-graph
  graphId?: string;                // Sub-graph ID (when mode="graph")
  summaryPrompt?: string;          // Summarization prompt for delegate result
};
```

## Execution Modes

### DAG Mode (default)

Nodes are executed in **topological order** determined by Kahn's algorithm:

```typescript
function topoSortAgentGraph(nodes, edges): string[] {
  // 1. Validate edge references (all source/target must exist)
  // 2. Build in-degree map and outgoing adjacency
  // 3. Initialize queue with nodes having in-degree 0
  // 4. BFS: process queue, decrement in-degrees
  // 5. Throw if result.length !== nodes.length (cycle detected)
  return result;
}
```

**Validation errors**:
- Unknown source/target references → `AgentGraphValidationError`
- Cycle detection → `"Graph contains a cycle (not a DAG)"`

### State Machine Mode

Nodes are executed based on **conditional edge evaluation**:
- Starts from `execution.entryNodeId` (or first root node)
- After each node, evaluates outgoing edge conditions via `evaluateCondition(condition, state)`
- Matching edges determine the next node(s) to execute
- Allows loops and dynamic routing

## Runtime Functions

### `resolveExecutionMode(graph)`
Returns `"state_machine"` if configured, otherwise defaults to `"dag"`.

### `getGraphNodeOrder(graph)`
- DAG mode: returns `topoSortAgentGraph()` result
- State machine: returns `graph.nodes.map(n => n.id)` (declaration order)

### `getEntryNodeIds(graph)`
- State machine + `entryNodeId` configured: returns `[entryNodeId]`
- Otherwise: finds root nodes (no incoming edges)
- Fallback: first declared node

### `buildInitialState(graph, mission)`
Constructs the initial `AgentGraphState` by merging `graph.stateDefaults` with:
```typescript
{ mission, userInput: mission, nodes: {}, execution: { mode } }
```

## AgentGraphState

The mutable state object that flows through graph execution:

```typescript
type AgentGraphState = {
  // Core
  mission?: string;
  userInput?: string;
  nodes: Record<string, unknown>;
  
  // Planning
  goal?: string;
  constraints?: string[];
  nonGoals?: string[];
  acceptanceCriteria?: string[];
  definitionOfDone?: string[];
  plan?: Record<string, unknown>;
  
  // Task queue
  currentTaskId?: string;
  taskQueue?: unknown[];
  
  // Investigation
  riskRegister?: unknown[];
  repoSummary?: string;
  workingNotes?: string[];
  
  // Execution tracking
  execution?: {
    mode?: "dag" | "state_machine";
    step?: number;
    runsByNode?: Record<string, number>;
    history?: string[];
    lastNodeId?: string;
  };
  
  // Multi-turn
  conversationHistory?: AgentEvent[];
  
  // Checkpoint
  checkpoint?: {
    threadId?: string;
    nodeId?: string;
    interruptedAt?: string;
    status?: "awaiting_approval" | "approved" | "rejected";
    graphHash?: string;
  };
  
  // Results
  finalSummary?: string;
  nextSteps?: string[];
  route?: { next?: string; reason?: string };
};
```

## AgentGraphRun

Represents a single execution of a graph:

```typescript
interface AgentGraphRun {
  _id?: ObjectId;
  graphId: ObjectId;
  workspaceId?: ObjectId;
  source?: string;              // "agent" | "automation" | "api" | "cli"
  status: AgentGraphStatus;     // "PENDING" | "RUNNING" | "PAUSED" | "CANCELLED" | "COMPLETED" | "FAILED"
  startedAt: Date;
  endedAt?: Date;
  nodeOrder: string[];
  nodeSessionIds: Record<string, string>;
  nodeStatuses: Record<string, AgentGraphNodeStatus>;
  nodeTokenUsage?: Record<string, TokenUsage>;
  tokenUsage?: TokenUsageSummary;
  state: AgentGraphState;
  error?: string;
  title?: string;
  archived?: boolean;
  conversationTurns?: number;
  hasCheckpoint?: boolean;
}
```

## AgentGraphService

CRUD operations for graph definitions (`agentGraphService.ts`):

| Method | Purpose |
|---|---|
| `createGraph(input)` | Insert new graph definition |
| `getGraph(graphId)` | Get by ID |
| `listGraphs(filter?)` | List all non-hidden graphs (text search on name/description) |
| `updateGraph(graphId, updates)` | Partial update |
| `deleteGraph(graphId)` | Remove graph |
| `ensureDefaultGraphs()` | Seed default preset graphs on user registration |

**Hidden graphs**: Legacy graph names are filtered from `listGraphs()` via `HIDDEN_GRAPH_NAMES` set.

**Fallback**: When MongoDB is unavailable, graphs are stored in-memory via `fallbackGraphs` map. Preset graphs are seeded with fixed ObjectId strings.

## Graph Catalog

`packages/shared/src/graphCatalog.ts` defines **client-side fallback** graph options:

```typescript
type GraphOption = {
  id: GraphId;
  name: string;
  description: string;
  phases: PhaseDefinition[];
  nodePrompts: GraphNodePrompt[];
  toolNames: string[];
};
```

Contains:
- **Universal Agent** (`universal-v1`): General coding agent with `baseToolNames` (25 tools)
- **Deep Research phases**: `clarify` → `brief` → `plan` → `research` → `summary` → `report`

The `baseToolNames` array defines 25 core tool identifiers shared across graphs.
