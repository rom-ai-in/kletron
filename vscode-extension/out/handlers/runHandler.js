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
exports.RunHandler = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Handles agent run lifecycle operations
 */
class RunHandler {
    constructor(backendClient, state, treeProvider) {
        this.backendClient = backendClient;
        this.state = state;
        this.treeProvider = treeProvider;
    }
    /**
     * Start a new agent run with polling-based status updates
     */
    async startRun(prompt, agentId, llmOverrides) {
        if (!this.backendClient.hasBaseUrl()) {
            throw new Error('Backend is not configured. Add it in Settings first.');
        }
        const llm = this.buildLlmSettings(llmOverrides);
        const { runId, status } = await this.backendClient.runAgent(prompt, agentId, llm);
        // Create initial output with user's message
        const initialOutput = [
            { role: 'user', content: prompt }
        ];
        const run = {
            runId,
            prompt,
            agentId,
            status,
            output: initialOutput,
            createdAt: new Date().toISOString(),
        };
        const treeRun = { runId, prompt, agentId, status };
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
    stopRun(runId) {
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
    async publishDiff(runId) {
        const { diffHunk } = await this.backendClient.getDiff(runId);
        this.state.setDiff(runId, diffHunk);
    }
    /**
     * Apply the cached diff for a run
     */
    async applyDiff(runId) {
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
    rejectDiff(runId) {
        this.state.clearDiff(runId);
    }
    buildLlmSettings(overrides) {
        var _a, _b;
        const config = vscode.workspace.getConfiguration('numezis');
        const selection = this.state.getLlmSelection();
        return {
            provider: (overrides === null || overrides === void 0 ? void 0 : overrides.provider) || selection.provider || config.get('llm.provider', 'openai'),
            baseUrl: (overrides === null || overrides === void 0 ? void 0 : overrides.baseUrl) || config.get('llm.baseUrl', ''),
            model: (overrides === null || overrides === void 0 ? void 0 : overrides.model) || selection.model || config.get('llm.model', 'gpt-4o-mini'),
            apiKey: (overrides === null || overrides === void 0 ? void 0 : overrides.apiKey) || config.get('llm.apiKey', ''),
            temperature: (_a = overrides === null || overrides === void 0 ? void 0 : overrides.temperature) !== null && _a !== void 0 ? _a : config.get('llm.temperature', 0.2),
            maxTokens: (_b = overrides === null || overrides === void 0 ? void 0 : overrides.maxTokens) !== null && _b !== void 0 ? _b : config.get('llm.maxTokens', 0),
        };
    }
}
exports.RunHandler = RunHandler;
