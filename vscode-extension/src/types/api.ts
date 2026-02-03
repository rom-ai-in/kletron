/**
 * Shared API types for Numezis Code VS Code extension
 * These types match the backend API responses
 */

// ============================================================================
// LLM Configuration Types
// ============================================================================

export type LlmProviderType = 'azure' | 'openai' | 'claude' | 'gemini' | 'lmstudio' | 'ollama';

export interface AzureLlmConfig {
    endpoint: string;
    deploymentName: string;
    apiKey: string;
    apiVersion?: string;
}

export interface OpenAILlmConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}

export interface ClaudeLlmConfig {
    apiKey: string;
    model?: string;
}

export interface GeminiLlmConfig {
    apiKey: string;
    model?: string;
}

export interface LmStudioLlmConfig {
    endpoint: string;
    model?: string;
    apiKey?: string;
}

export interface OllamaLlmConfig {
    endpoint: string;
    model?: string;
}

export interface LlmConfig {
    provider: LlmProviderType;
    azure?: AzureLlmConfig;
    openai?: OpenAILlmConfig;
    claude?: ClaudeLlmConfig;
    gemini?: GeminiLlmConfig;
    lmstudio?: LmStudioLlmConfig;
    ollama?: OllamaLlmConfig;
}

// ============================================================================
// Embedding Configuration Types
// ============================================================================

export type EmbeddingProviderType = 'azure' | 'lmstudio';

export interface AzureEmbeddingConfig {
    endpoint: string;
    deploymentName: string;
    apiKey: string;
    apiVersion?: string;
}

export interface LmStudioEmbeddingConfig {
    endpoint: string;
    model?: string;
}

export interface EmbeddingConfig {
    provider: EmbeddingProviderType;
    azure?: AzureEmbeddingConfig;
    lmstudio?: LmStudioEmbeddingConfig;
}

// ============================================================================
// Workspace & Context Configuration
// ============================================================================

export interface WorkspaceConfig {
    workingFolder: string;
}

export interface ContextConfig {
    [key: string]: unknown;
}

// ============================================================================
// Agent Graph Types
// ============================================================================

export interface AgentGraphNode {
    id: string;
    type: string;
    prompt?: string;
    config?: Record<string, unknown>;
}

export interface AgentGraphEdge {
    source: string;
    target: string;
    condition?: string;
}

export interface AgentGraph {
    _id?: string;
    id?: string;
    name: string;
    description?: string;
    nodes: AgentGraphNode[];
    edges: AgentGraphEdge[];
    createdAt?: string;
    updatedAt?: string;
}

export interface AgentGraphListResponse {
    graphs: AgentGraph[];
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolParameter {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
}

export interface ToolDefinition {
    name: string;
    description?: string;
    parameters?: ToolParameter[];
}

export interface ToolsListResponse {
    tools: ToolDefinition[];
}

// ============================================================================
// Agent Run Types
// ============================================================================

export interface AgentOutputMessage {
    role: 'assistant' | 'user' | 'system';
    content: string;
}

export interface RunStatusResponse {
    status: string;
    output?: AgentOutputMessage[];
}

export interface RunAgentResponse {
    runId: string;
    status: string;
}

export interface DiffResponse {
    diffHunk: string;
}

export interface ApplyDiffResponse {
    status: string;
}

// ============================================================================
// File Operations
// ============================================================================

export interface FileReadResponse {
    content: string;
    path: string;
}

export interface FileWriteResponse {
    ok: boolean;
    path: string;
}

export interface DirectoryEntry {
    name: string;
    isDirectory: boolean;
}

export interface DirectoryListResponse {
    path: string;
    entries: DirectoryEntry[];
}

// ============================================================================
// Health & Validation
// ============================================================================

export interface HealthResponse {
    ok: boolean;
}

export interface FolderValidationResponse {
    valid: boolean;
    message?: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamInitChunk {
    type: 'init';
    payload: { runId: string; graphId: string };
}

export interface StreamUpdateChunk {
    type: 'update';
    payload: {
        nodeId?: string;
        status?: string;
        output?: string;
    };
}

export interface StreamFinalChunk {
    type: 'final';
    payload: {
        success: boolean;
        output?: unknown;
    };
}

export interface StreamErrorChunk {
    type: 'error';
    payload: { message: string };
}

export type StreamChunk = StreamInitChunk | StreamUpdateChunk | StreamFinalChunk | StreamErrorChunk;
