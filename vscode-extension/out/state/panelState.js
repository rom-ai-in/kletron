"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelState = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Centralized state management for the ChatPanel
 */
class PanelState {
    constructor(storage) {
        this.storage = storage;
        this.runs = [];
        this.graphs = [];
        this.llmSelection = {};
        this.isAuthenticated = false;
        this.listeners = new Set();
        this.pollCancellers = new Map();
        this.diffCache = new Map();
        this.runs = storage.getRuns();
    }
    // ============================================================================
    // Event System
    // ============================================================================
    onChange(listener) {
        this.listeners.add(listener);
        return new vscode.Disposable(() => this.listeners.delete(listener));
    }
    notifyListeners() {
        const state = this.getUiState();
        this.listeners.forEach((listener) => listener(state));
        this.storage.setRuns(this.runs);
    }
    // ============================================================================
    // Getters
    // ============================================================================
    getRuns() {
        return this.runs;
    }
    getSelectedRunId() {
        return this.selectedRunId;
    }
    getLastRunId() {
        return this.lastRunId;
    }
    getSelectedRun() {
        return this.runs.find((run) => run.runId === this.selectedRunId);
    }
    getGraphs() {
        return this.graphs;
    }
    getSelectedGraphId() {
        return this.selectedGraphId;
    }
    getLlmSelection() {
        return this.llmSelection;
    }
    getGraphDetail() {
        return this.graphDetail;
    }
    getDiff(runId) {
        return this.diffCache.get(runId);
    }
    getPollCanceller(runId) {
        return this.pollCancellers.get(runId);
    }
    // ============================================================================
    // Setters / Mutators
    // ============================================================================
    setSelectedRunId(runId) {
        this.selectedRunId = runId;
        this.notifyListeners();
    }
    setSelectedGraphId(graphId) {
        this.selectedGraphId = graphId;
        this.notifyListeners();
    }
    setLlmSelection(provider, model) {
        this.llmSelection = { provider, model };
        this.notifyListeners();
    }
    setLlmConfig(config) {
        this.llmConfig = config;
        this.notifyListeners();
    }
    setEmbeddingConfig(config) {
        this.embeddingConfig = config;
        this.notifyListeners();
    }
    setWorkspaceConfig(config) {
        this.workspaceConfig = config;
        this.notifyListeners();
    }
    setContextConfig(config) {
        this.contextConfig = config;
        this.notifyListeners();
    }
    setGraphs(graphs) {
        this.graphs = graphs;
        this.notifyListeners();
    }
    setToolsList(tools) {
        this.toolsList = tools;
        this.notifyListeners();
    }
    setGraphDetail(graph) {
        this.graphDetail = graph;
        this.notifyListeners();
    }
    setAuthState(isAuthenticated, email) {
        this.isAuthenticated = isAuthenticated;
        this.userEmail = email;
        this.notifyListeners();
    }
    getIsAuthenticated() {
        return this.isAuthenticated;
    }
    // ============================================================================
    // Run Management
    // ============================================================================
    addRun(run) {
        this.runs = [run, ...this.runs.filter((existing) => existing.runId !== run.runId)];
        this.selectedRunId = run.runId;
        this.lastRunId = run.runId;
        this.notifyListeners();
    }
    updateRunStatus(runId, status) {
        this.runs = this.runs.map((run) => run.runId === runId ? { ...run, status } : run);
        this.notifyListeners();
    }
    updateRunOutput(runId, output) {
        this.runs = this.runs.map((run) => {
            var _a;
            if (run.runId !== runId)
                return run;
            const mergedOutput = this.mergeOutput((_a = run.output) !== null && _a !== void 0 ? _a : [], output);
            return { ...run, output: mergedOutput };
        });
        this.notifyListeners();
    }
    appendRunOutput(runId, message) {
        this.runs = this.runs.map((run) => {
            var _a;
            if (run.runId !== runId)
                return run;
            const output = [...((_a = run.output) !== null && _a !== void 0 ? _a : []), message];
            return { ...run, output };
        });
        this.notifyListeners();
    }
    mergeOutput(existing, incoming) {
        if (!incoming.length)
            return existing;
        if (!existing.length)
            return incoming;
        if (incoming.length <= existing.length)
            return existing;
        return existing.concat(incoming.slice(existing.length));
    }
    // ============================================================================
    // Diff Management
    // ============================================================================
    setDiff(runId, diffHunk) {
        this.diffCache.set(runId, diffHunk);
        this.runs = this.runs.map((run) => run.runId === runId ? { ...run, diffHunk } : run);
        this.lastRunId = runId;
        this.notifyListeners();
    }
    clearDiff(runId) {
        this.diffCache.delete(runId);
        this.runs = this.runs.map((run) => run.runId === runId ? { ...run, diffHunk: undefined } : run);
        this.notifyListeners();
    }
    // ============================================================================
    // Poll Management
    // ============================================================================
    setPollCanceller(runId, cancel) {
        this.pollCancellers.set(runId, cancel);
    }
    removePollCanceller(runId) {
        this.pollCancellers.delete(runId);
    }
    cancelAllPolls() {
        this.pollCancellers.forEach((cancel) => cancel());
        this.pollCancellers.clear();
    }
    // ============================================================================
    // State Export
    // ============================================================================
    getUiState() {
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
    getSettings() {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            backendUrl: config.get('backendUrl', ''),
            apiToken: config.get('apiToken', ''),
            llm: {
                provider: config.get('llm.provider', 'openai'),
                baseUrl: config.get('llm.baseUrl', ''),
                model: config.get('llm.model', 'gpt-4o-mini'),
                apiKey: config.get('llm.apiKey', ''),
                temperature: config.get('llm.temperature', 0.2),
                maxTokens: config.get('llm.maxTokens', 0),
            },
            defaultGraphId: config.get('defaultGraphId', ''),
            inlineEnabled: config.get('inline.enabled', false),
        };
    }
    // ============================================================================
    // Bulk Updates (for loading backend config)
    // ============================================================================
    bulkUpdate(updates) {
        if (updates.llmConfig)
            this.llmConfig = updates.llmConfig;
        if (updates.graphs)
            this.graphs = updates.graphs;
        if (updates.workspaceConfig)
            this.workspaceConfig = updates.workspaceConfig;
        if (updates.contextConfig)
            this.contextConfig = updates.contextConfig;
        if (updates.embeddingConfig)
            this.embeddingConfig = updates.embeddingConfig;
        if (updates.toolsList)
            this.toolsList = updates.toolsList;
        this.notifyListeners();
    }
}
exports.PanelState = PanelState;
