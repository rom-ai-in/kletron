"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphHandler = void 0;
/**
 * Handles agent graph operations including streaming execution
 */
class GraphHandler {
    constructor(backendClient, state, treeProvider) {
        this.backendClient = backendClient;
        this.state = state;
        this.treeProvider = treeProvider;
    }
    /**
     * Load all available graphs from backend
     */
    async loadGraphs() {
        var _a;
        const response = await this.backendClient.listAgentGraphs();
        const graphs = (_a = response.graphs) !== null && _a !== void 0 ? _a : [];
        this.state.setGraphs(graphs);
        return graphs;
    }
    /**
     * Load detailed graph configuration
     */
    async loadGraphDetail(graphId) {
        if (!graphId)
            return undefined;
        const detail = await this.backendClient.getAgentGraph(graphId);
        this.state.setGraphDetail(detail);
        return detail;
    }
    /**
     * Save graph configuration
     */
    async saveGraph(graphId, configJson) {
        if (!graphId)
            return undefined;
        const payload = configJson ? JSON.parse(configJson) : {};
        const graph = await this.backendClient.updateAgentGraph(graphId, payload);
        await this.loadGraphs();
        await this.loadGraphDetail(graphId);
        return graph;
    }
    /**
     * Delete a graph
     */
    async deleteGraph(graphId) {
        if (!graphId)
            return;
        await this.backendClient.deleteAgentGraph(graphId);
        this.state.setGraphDetail(undefined);
        await this.loadGraphs();
    }
    /**
     * Execute a graph with streaming updates
     */
    async runGraph(graphId, message) {
        if (!graphId)
            return;
        const runId = `graph-${graphId}-${Date.now()}`;
        const run = {
            runId,
            prompt: message,
            agentId: graphId,
            status: 'running',
            createdAt: new Date().toISOString(),
        };
        const treeRun = { runId, prompt: message, agentId: graphId, status: 'running' };
        this.treeProvider.addRun(treeRun);
        this.state.addRun(run);
        const selection = this.state.getLlmSelection();
        await this.backendClient.runAgentGraphStream(graphId, message, selection, (chunk) => {
            this.handleStreamChunk(runId, chunk);
        });
    }
    handleStreamChunk(runId, chunk) {
        var _a;
        switch (chunk.type) {
            case 'init':
                // Session initialized, runId already set
                break;
            case 'update':
                this.state.appendRunOutput(runId, {
                    role: 'assistant',
                    content: JSON.stringify(chunk.payload),
                });
                break;
            case 'final':
                this.state.appendRunOutput(runId, {
                    role: 'assistant',
                    content: JSON.stringify(chunk.payload),
                });
                this.state.updateRunStatus(runId, 'completed');
                this.treeProvider.updateRunStatus(runId, 'completed');
                break;
            case 'error':
                this.state.appendRunOutput(runId, {
                    role: 'system',
                    content: ((_a = chunk.payload) === null || _a === void 0 ? void 0 : _a.message) || 'Graph error',
                });
                this.state.updateRunStatus(runId, 'failed');
                this.treeProvider.updateRunStatus(runId, 'failed');
                break;
        }
    }
}
exports.GraphHandler = GraphHandler;
