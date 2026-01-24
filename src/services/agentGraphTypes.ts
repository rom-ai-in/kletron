import type { ObjectId } from "mongodb";

export type AgentGraphStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AgentGraphNodeStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AgentGraphLlmSelection = {
    provider: "azure" | "lmstudio";
    model?: string;
};

export type AgentGraphNodeReactConfig = {
    systemPrompt: string;
    /**
     * User prompt template. In v1 we support `{{state}}` which is replaced by
     * `JSON.stringify(currentState, null, 2)`.
     */
    userPromptTemplate: string;
    /** Tool allowlist (names must exist in MCP tool catalog). */
    toolNames: string[];
    llmSelection?: AgentGraphLlmSelection;
    /** Future: enforce hard cap on tool calls. */
    maxToolCalls?: number;
};

export type AgentGraphNodeOutputConfig = {
    /**
     * Output schema registry key (e.g. `generic_json`, `phase1_output`, ...).
     * Validation happens at runtime after parsing assistant JSON output.
     */
    schemaId: string;
};

export type AgentGraphNode = {
    id: string;
    label: string;
    react: AgentGraphNodeReactConfig;
    output: AgentGraphNodeOutputConfig;
};

export type AgentGraphEdge = {
    id: string;
    source: string;
    target: string;
};

export interface AgentGraphDefinition {
    _id?: ObjectId;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    nodes: AgentGraphNode[];
    edges: AgentGraphEdge[];
}

export type AgentGraphState = {
    mission?: string;
    nodes: Record<string, unknown>;
};

export interface AgentGraphRun {
    _id?: ObjectId;
    graphId: ObjectId;
    status: AgentGraphStatus;
    startedAt: Date;
    endedAt?: Date;
    nodeOrder: string[];
    nodeSessionIds: Record<string, string>;
    nodeStatuses: Record<string, AgentGraphNodeStatus>;
    state: AgentGraphState;
    error?: string;
}

