import type { BackendClient } from '../utils/backendClient';
import type { PanelState, RunViewModel } from '../state/panelState';
import type { AgentTreeProvider, AgentRun } from '../tree/AgentTreeProvider';
import type { AgentGraph, StreamChunk } from '../types/api';

/**
 * Handles agent graph operations including streaming execution
 */
export class GraphHandler {
    constructor(
        private readonly backendClient: BackendClient,
        private readonly state: PanelState,
        private readonly treeProvider: AgentTreeProvider
    ) { }

    /**
     * Load all available graphs from backend
     */
    async loadGraphs(): Promise<AgentGraph[]> {
        const response = await this.backendClient.listAgentGraphs();
        const graphs = response.graphs ?? [];
        this.state.setGraphs(graphs);
        return graphs;
    }

    /**
     * Load detailed graph configuration
     */
    async loadGraphDetail(graphId: string): Promise<AgentGraph | undefined> {
        if (!graphId) return undefined;
        const detail = await this.backendClient.getAgentGraph(graphId);
        this.state.setGraphDetail(detail);
        return detail;
    }

    /**
     * Save graph configuration
     */
    async saveGraph(graphId: string, configJson: string): Promise<AgentGraph | undefined> {
        if (!graphId) return undefined;
        const payload = configJson ? JSON.parse(configJson) : {};
        const graph = await this.backendClient.updateAgentGraph(graphId, payload);
        await this.loadGraphs();
        await this.loadGraphDetail(graphId);
        return graph;
    }

    /**
     * Delete a graph
     */
    async deleteGraph(graphId: string): Promise<void> {
        if (!graphId) return;
        await this.backendClient.deleteAgentGraph(graphId);
        this.state.setGraphDetail(undefined);
        await this.loadGraphs();
    }

    /**
     * Execute a graph with streaming updates
     */
    async runGraph(graphId: string, message: string): Promise<void> {
        if (!graphId) return;

        const runId = `graph-${graphId}-${Date.now()}`;
        const run: RunViewModel = {
            runId,
            prompt: message,
            agentId: graphId,
            status: 'running',
            createdAt: new Date().toISOString(),
        };

        const treeRun: AgentRun = { runId, prompt: message, agentId: graphId, status: 'running' };
        this.treeProvider.addRun(treeRun);
        this.state.addRun(run);

        const selection = this.state.getLlmSelection();

        await this.backendClient.runAgentGraphStream(
            graphId,
            message,
            selection,
            (chunk: StreamChunk) => {
                this.handleStreamChunk(runId, chunk);
            }
        );
    }

    private handleStreamChunk(runId: string, chunk: StreamChunk): void {
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
                    content: chunk.payload?.message || 'Graph error',
                });
                this.state.updateRunStatus(runId, 'failed');
                this.treeProvider.updateRunStatus(runId, 'failed');
                break;
        }
    }
}
