import * as vscode from 'vscode';
import type {
    AgentGraph,
    AgentOutputMessage,
    ContextConfig,
    EmbeddingConfig,
    LlmConfig,
    ToolDefinition,
    WorkspaceConfig,
} from '../types/api';
import type { LlmSettings } from '../utils/backendClient';

/**
 * Run view model with additional UI state
 */
export interface RunViewModel {
    runId: string;
    prompt: string;
    agentId: string;
    status: string;
    output?: AgentOutputMessage[];
    diffHunk?: string;
    createdAt?: string;
}

/**
 * Settings payload synced with VS Code configuration
 */
export interface SettingsPayload {
    backendUrl: string;
    apiToken: string;
    llm: LlmSettings;
    defaultGraphId?: string;
    inlineEnabled?: boolean;
}

/**
 * Complete UI state for the webview
 */
export interface UiState {
    runs: RunViewModel[];
    selectedRunId?: string;
    connected: boolean;
    isAuthenticated: boolean;
    userEmail?: string;
    backendUrl: string;
    apiToken: string;
    llm: LlmSettings;
    defaultGraphId?: string;
    inlineEnabled?: boolean;
    graphs: AgentGraph[];
    selectedGraphId?: string;
    llmConfig?: LlmConfig;
    embeddingConfig?: EmbeddingConfig;
    workspaceConfig?: WorkspaceConfig;
    contextConfig?: ContextConfig;
    toolsList?: ToolDefinition[];
    graphDetail?: AgentGraph;
}

/**
 * Storage interface for persisting runs
 */
export interface RunStorage {
    getRuns: () => RunViewModel[];
    setRuns: (runs: RunViewModel[]) => void;
}

/**
 * Webview message types from webview to extension
 */
export type WebviewRequest =
    | { type: 'run'; prompt: string; agentId: string }
    | { type: 'applyDiff'; runId: string }
    | { type: 'selectRun'; runId: string }
    | { type: 'updateSettings'; settings: SettingsPayload }
    | { type: 'rejectDiff'; runId: string }
    | { type: 'openConfigPage' }
    | { type: 'loadConfig' }
    | { type: 'selectGraph'; graphId: string }
    | { type: 'setLlmSelection'; provider: string; model: string }
    | { type: 'stopRun'; runId?: string }
    | { type: 'validateWorkspace'; path: string }
    | { type: 'saveWorkspace'; config: { workingFolder: string } }
    | { type: 'saveContext'; config: string }
    | { type: 'saveLlmProvider'; provider: string }
    | { type: 'saveLlmAzure'; config: string }
    | { type: 'saveLlmLmstudio'; config: string }
    | { type: 'resetLlm' }
    | { type: 'saveEmbeddingProvider'; provider: string }
    | { type: 'saveEmbeddingAzure'; config: string }
    | { type: 'saveEmbeddingLmstudio'; config: string }
    | { type: 'resetEmbedding' }
    | { type: 'loadGraph'; graphId: string }
    | { type: 'saveGraph'; graphId: string; config: string }
    | { type: 'deleteGraph'; graphId: string }
    | { type: 'login' }
    | { type: 'openAccount' };

/**
 * Panel message types from extension to webview
 */
export type PanelMessage =
    | { type: 'status'; runId: string; status: string; output?: AgentOutputMessage[] }
    | { type: 'diff'; runId: string; diffHunk: string }
    | { type: 'error'; message: string }
    | { type: 'applyResult'; runId: string; status: string }
    | { type: 'state'; state: UiState };

type StateChangeListener = (state: UiState) => void;

/**
 * Centralized state management for the ChatPanel
 */
export class PanelState {
    private runs: RunViewModel[] = [];
    private selectedRunId?: string;
    private lastRunId?: string;
    private graphs: AgentGraph[] = [];
    private selectedGraphId?: string;
    private llmConfig?: LlmConfig;
    private llmSelection: { provider?: string; model?: string } = {};
    private workspaceConfig?: WorkspaceConfig;
    private contextConfig?: ContextConfig;
    private embeddingConfig?: EmbeddingConfig;
    private toolsList?: ToolDefinition[];
    private graphDetail?: AgentGraph;
    private isAuthenticated = false;
    private userEmail?: string;

    private readonly listeners = new Set<StateChangeListener>();
    private readonly pollCancellers = new Map<string, () => void>();
    private readonly diffCache = new Map<string, string>();

    constructor(private readonly storage: RunStorage) {
        this.runs = storage.getRuns();
    }

    // ============================================================================
    // Event System
    // ============================================================================

    onChange(listener: StateChangeListener): vscode.Disposable {
        this.listeners.add(listener);
        return new vscode.Disposable(() => this.listeners.delete(listener));
    }

    private notifyListeners() {
        const state = this.getUiState();
        this.listeners.forEach((listener) => listener(state));
        this.storage.setRuns(this.runs);
    }

    // ============================================================================
    // Getters
    // ============================================================================

    getRuns(): RunViewModel[] {
        return this.runs;
    }

    getSelectedRunId(): string | undefined {
        return this.selectedRunId;
    }

    getLastRunId(): string | undefined {
        return this.lastRunId;
    }

    getSelectedRun(): RunViewModel | undefined {
        return this.runs.find((run) => run.runId === this.selectedRunId);
    }

    getGraphs(): AgentGraph[] {
        return this.graphs;
    }

    getSelectedGraphId(): string | undefined {
        return this.selectedGraphId;
    }

    getLlmSelection(): { provider?: string; model?: string } {
        return this.llmSelection;
    }

    getGraphDetail(): AgentGraph | undefined {
        return this.graphDetail;
    }

    getDiff(runId: string): string | undefined {
        return this.diffCache.get(runId);
    }

    getPollCanceller(runId: string): (() => void) | undefined {
        return this.pollCancellers.get(runId);
    }

    // ============================================================================
    // Setters / Mutators
    // ============================================================================

    setSelectedRunId(runId: string | undefined) {
        this.selectedRunId = runId;
        this.notifyListeners();
    }

    setSelectedGraphId(graphId: string | undefined) {
        this.selectedGraphId = graphId;
        this.notifyListeners();
    }

    setLlmSelection(provider?: string, model?: string) {
        this.llmSelection = { provider, model };
        this.notifyListeners();
    }

    setLlmConfig(config: LlmConfig) {
        this.llmConfig = config;
        this.notifyListeners();
    }

    setEmbeddingConfig(config: EmbeddingConfig) {
        this.embeddingConfig = config;
        this.notifyListeners();
    }

    setWorkspaceConfig(config: WorkspaceConfig) {
        this.workspaceConfig = config;
        this.notifyListeners();
    }

    setContextConfig(config: ContextConfig) {
        this.contextConfig = config;
        this.notifyListeners();
    }

    setGraphs(graphs: AgentGraph[]) {
        this.graphs = graphs;
        this.notifyListeners();
    }

    setToolsList(tools: ToolDefinition[]) {
        this.toolsList = tools;
        this.notifyListeners();
    }

    setGraphDetail(graph: AgentGraph | undefined) {
        this.graphDetail = graph;
        this.notifyListeners();
    }

    setAuthState(isAuthenticated: boolean, email?: string) {
        this.isAuthenticated = isAuthenticated;
        this.userEmail = email;
        this.notifyListeners();
    }

    getIsAuthenticated(): boolean {
        return this.isAuthenticated;
    }

    // ============================================================================
    // Run Management
    // ============================================================================

    addRun(run: RunViewModel) {
        this.runs = [run, ...this.runs.filter((existing) => existing.runId !== run.runId)];
        this.selectedRunId = run.runId;
        this.lastRunId = run.runId;
        this.notifyListeners();
    }

    updateRunStatus(runId: string, status: string) {
        this.runs = this.runs.map((run) =>
            run.runId === runId ? { ...run, status } : run
        );
        this.notifyListeners();
    }

    updateRunOutput(runId: string, output: AgentOutputMessage[]) {
        this.runs = this.runs.map((run) => {
            if (run.runId !== runId) return run;
            const mergedOutput = this.mergeOutput(run.output ?? [], output);
            return { ...run, output: mergedOutput };
        });
        this.notifyListeners();
    }

    appendRunOutput(runId: string, message: AgentOutputMessage) {
        this.runs = this.runs.map((run) => {
            if (run.runId !== runId) return run;
            const output = [...(run.output ?? []), message];
            return { ...run, output };
        });
        this.notifyListeners();
    }

    private mergeOutput(existing: AgentOutputMessage[], incoming: AgentOutputMessage[]): AgentOutputMessage[] {
        if (!incoming.length) return existing;
        if (!existing.length) return incoming;
        if (incoming.length <= existing.length) return existing;
        return existing.concat(incoming.slice(existing.length));
    }

    // ============================================================================
    // Diff Management
    // ============================================================================

    setDiff(runId: string, diffHunk: string) {
        this.diffCache.set(runId, diffHunk);
        this.runs = this.runs.map((run) =>
            run.runId === runId ? { ...run, diffHunk } : run
        );
        this.lastRunId = runId;
        this.notifyListeners();
    }

    clearDiff(runId: string) {
        this.diffCache.delete(runId);
        this.runs = this.runs.map((run) =>
            run.runId === runId ? { ...run, diffHunk: undefined } : run
        );
        this.notifyListeners();
    }

    // ============================================================================
    // Poll Management
    // ============================================================================

    setPollCanceller(runId: string, cancel: () => void) {
        this.pollCancellers.set(runId, cancel);
    }

    removePollCanceller(runId: string) {
        this.pollCancellers.delete(runId);
    }

    cancelAllPolls() {
        this.pollCancellers.forEach((cancel) => cancel());
        this.pollCancellers.clear();
    }

    // ============================================================================
    // State Export
    // ============================================================================

    getUiState(): UiState {
        const settings = this.getSettings();
        return {
            runs: this.runs,
            selectedRunId: this.selectedRunId,
            connected: Boolean(settings.backendUrl),
            isAuthenticated: this.isAuthenticated,
            userEmail: this.userEmail,
            backendUrl: settings.backendUrl,
            apiToken: settings.apiToken,
            llm: settings.llm,
            defaultGraphId: settings.defaultGraphId,
            inlineEnabled: settings.inlineEnabled,
            graphs: this.graphs,
            selectedGraphId: this.selectedGraphId,
            llmConfig: this.llmConfig,
            embeddingConfig: this.embeddingConfig,
            workspaceConfig: this.workspaceConfig,
            contextConfig: this.contextConfig,
            toolsList: this.toolsList,
            graphDetail: this.graphDetail,
        };
    }

    private getSettings(): SettingsPayload {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            backendUrl: config.get<string>('backendUrl', ''),
            apiToken: config.get<string>('apiToken', ''),
            llm: {
                provider: config.get<string>('llm.provider', 'openai'),
                baseUrl: config.get<string>('llm.baseUrl', ''),
                model: config.get<string>('llm.model', 'gpt-4o-mini'),
                apiKey: config.get<string>('llm.apiKey', ''),
                temperature: config.get<number>('llm.temperature', 0.2),
                maxTokens: config.get<number>('llm.maxTokens', 0),
            },
            defaultGraphId: config.get<string>('defaultGraphId', ''),
            inlineEnabled: config.get<boolean>('inline.enabled', false),
        };
    }

    // ============================================================================
    // Bulk Updates (for loading backend config)
    // ============================================================================

    bulkUpdate(updates: {
        llmConfig?: LlmConfig;
        graphs?: AgentGraph[];
        workspaceConfig?: WorkspaceConfig;
        contextConfig?: ContextConfig;
        embeddingConfig?: EmbeddingConfig;
        toolsList?: ToolDefinition[];
    }) {
        if (updates.llmConfig) this.llmConfig = updates.llmConfig;
        if (updates.graphs) this.graphs = updates.graphs;
        if (updates.workspaceConfig) this.workspaceConfig = updates.workspaceConfig;
        if (updates.contextConfig) this.contextConfig = updates.contextConfig;
        if (updates.embeddingConfig) this.embeddingConfig = updates.embeddingConfig;
        if (updates.toolsList) this.toolsList = updates.toolsList;
        this.notifyListeners();
    }
}
