import * as vscode from 'vscode';
import type { BackendClient, LlmSettings } from '../utils/backendClient';
import type { PanelState, RunViewModel } from '../state/panelState';
import type { AgentRun, AgentTreeProvider } from '../tree/AgentTreeProvider';
import type { AgentOutputMessage } from '../types/api';

/**
 * Handles agent run lifecycle operations
 */
export class RunHandler {
    constructor(
        private readonly backendClient: BackendClient,
        private readonly state: PanelState,
        private readonly treeProvider: AgentTreeProvider
    ) { }

    /**
     * Start a new agent run with polling-based status updates
     */
    async startRun(prompt: string, agentId: string, llmOverrides?: Partial<LlmSettings>): Promise<void> {
        if (!this.backendClient.hasBaseUrl()) {
            throw new Error('Backend is not configured. Add it in Settings first.');
        }

        const llm = this.buildLlmSettings(llmOverrides);
        const { runId, status } = await this.backendClient.runAgent(prompt, agentId, llm);

        // Create initial output with user's message
        const initialOutput: AgentOutputMessage[] = [
            { role: 'user', content: prompt }
        ];

        const run: RunViewModel = {
            runId,
            prompt,
            agentId,
            status,
            output: initialOutput,  // Include user message in output
            createdAt: new Date().toISOString(),
        };


        const treeRun: AgentRun = { runId, prompt, agentId, status };
        this.treeProvider.addRun(treeRun);
        this.state.addRun(run);

        // Start polling
        const cancel = this.backendClient.subscribeToRun(runId, (runStatus) => {
            this.treeProvider.updateRunStatus(runId, runStatus.status);
            this.state.updateRunStatus(runId, runStatus.status);

            if (runStatus.output) {
                this.state.updateRunOutput(runId, runStatus.output);
            }

            if (['completed', 'failed', 'errored'].includes(runStatus.status)) {
                cancel();
                this.state.removePollCanceller(runId);

                if (runStatus.status === 'completed') {
                    void this.publishDiff(runId);
                }
            }
        });

        this.state.setPollCanceller(runId, cancel);
    }

    /**
     * Stop an active run (cancels polling, backend may continue)
     */
    stopRun(runId?: string): void {
        const targetId = runId || this.state.getSelectedRunId() || this.state.getLastRunId();
        if (!targetId) {
            throw new Error('No active run to stop.');
        }

        const cancel = this.state.getPollCanceller(targetId);
        if (cancel) {
            cancel();
            this.state.removePollCanceller(targetId);
        }

        this.treeProvider.updateRunStatus(targetId, 'CANCELLED');
        this.state.updateRunStatus(targetId, 'CANCELLED');

        vscode.window.showWarningMessage('Run stop only cancels polling. The backend may still be running.');
    }

    /**
     * Fetch and cache diff for a completed run
     */
    async publishDiff(runId: string): Promise<void> {
        const { diffHunk } = await this.backendClient.getDiff(runId);
        this.state.setDiff(runId, diffHunk);
    }

    /**
     * Apply the cached diff for a run
     */
    async applyDiff(runId: string): Promise<{ status: string }> {
        const cachedDiff = this.state.getDiff(runId);
        if (!cachedDiff) {
            throw new Error('No diff available for this run yet.');
        }

        const result = await this.backendClient.applyDiff(runId, cachedDiff);
        vscode.window.showInformationMessage(`Diff ${result.status} for run ${runId}.`);
        return result;
    }

    /**
     * Reject (clear) the diff for a run
     */
    rejectDiff(runId: string): void {
        this.state.clearDiff(runId);
    }

    private buildLlmSettings(overrides?: Partial<LlmSettings>): LlmSettings {
        const config = vscode.workspace.getConfiguration('numezis');
        const selection = this.state.getLlmSelection();

        return {
            provider: overrides?.provider || selection.provider || config.get<string>('llm.provider', 'openai'),
            baseUrl: overrides?.baseUrl || config.get<string>('llm.baseUrl', ''),
            model: overrides?.model || selection.model || config.get<string>('llm.model', 'gpt-4o-mini'),
            apiKey: overrides?.apiKey || config.get<string>('llm.apiKey', ''),
            temperature: overrides?.temperature ?? config.get<number>('llm.temperature', 0.2),
            maxTokens: overrides?.maxTokens ?? config.get<number>('llm.maxTokens', 0),
        };
    }
}
