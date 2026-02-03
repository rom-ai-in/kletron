import type { ObjectId } from "mongodb";
import type { LlmProviderType } from "../schemas/llmConfig.schema";

export type AgentGraphStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AgentGraphNodeStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AgentGraphLlmSelection = {
    provider: LlmProviderType;
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
    /** Skill IDs to inject into this node's context. */
    skillIds?: string[];
    llmSelection?: AgentGraphLlmSelection;
    /** Future: enforce hard cap on tool calls. */
    maxToolCalls?: number;
};

export type AgentGraphNodeKind = "react" | "router";

export type AgentGraphNodeOutputConfig = {
    /**
     * Output schema registry key (e.g. `generic_json`, `phase1_output`, ...).
     * Validation happens at runtime after parsing assistant JSON output.
     */
    schemaId: string;
    /**
     * Optional state path to write the validated output into.
     * Example: "plan" or "quality.gates". "state." prefix is allowed.
     */
    statePath?: string;
    /**
     * If true and both existing value and output are objects, shallow-merge.
     */
    stateMerge?: boolean;
};

export type AgentGraphNode = {
    id: string;
    label: string;
    kind?: AgentGraphNodeKind;
    react: AgentGraphNodeReactConfig;
    output: AgentGraphNodeOutputConfig;
};

export type AgentGraphEdge = {
    id: string;
    source: string;
    target: string;
    /**
     * Optional condition expression evaluated against current state.
     * Examples: "state.nextStep == \"debug\"" or "exists(state.plan)".
     */
    condition?: string;
};

export type AgentGraphExecutionMode = "dag" | "state_machine";

export type AgentGraphExecutionConfig = {
    mode?: AgentGraphExecutionMode;
    /** Optional entry node for state machine mode. */
    entryNodeId?: string;
    /** Max total node executions in a run (loop guard). */
    maxIterations?: number;
    /** Max executions per node (loop guard). */
    maxNodeRuns?: number;
};

export interface AgentGraphDefinition {
    _id?: ObjectId;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    nodes: AgentGraphNode[];
    edges: AgentGraphEdge[];
    execution?: AgentGraphExecutionConfig;
    /** Optional default state merged into initial run state. */
    stateDefaults?: Record<string, unknown>;
}

export type AgentGraphState = {
    mission?: string;
    userInput?: string;
    nodes: Record<string, unknown>;
    goal?: string;
    constraints?: string[];
    acceptanceCriteria?: string[];
    definitionOfDone?: string[];
    plan?: Record<string, unknown>;
    currentTaskId?: string;
    taskQueue?: unknown[];
    riskRegister?: unknown[];
    repoSummary?: string;
    envInfo?: Record<string, unknown>;
    buildCommands?: string[];
    constraintsDetected?: string[];
    workingNotes?: string[];
    designDecisions?: Array<Record<string, unknown>>;
    openQuestions?: string[];
    toolCalls?: Array<Record<string, unknown>>;
    terminalRuns?: Array<Record<string, unknown>>;
    fileChanges?: Array<Record<string, unknown>>;
    testResults?: Record<string, unknown>;
    qualityGates?: Record<string, unknown>;
    reviewFeedback?: Array<Record<string, unknown>>;
    suggestedTests?: string[];
    confidence?: unknown;
    finalSummary?: string;
    nextSteps?: string[];
    route?: {
        next?: string;
        reason?: string;
    };
    execution?: {
        mode?: AgentGraphExecutionMode;
        step?: number;
        runsByNode?: Record<string, number>;
        history?: string[];
        lastNodeId?: string;
    };
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
