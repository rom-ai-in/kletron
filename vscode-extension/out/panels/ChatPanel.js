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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
class ChatPanel {
    constructor(host, extensionUri, backendClient, treeProvider, onSettingsUpdated, storage) {
        this.extensionUri = extensionUri;
        this.backendClient = backendClient;
        this.treeProvider = treeProvider;
        this.onSettingsUpdated = onSettingsUpdated;
        this.storage = storage;
        this.disposables = [];
        this.pollCanceller = new Map();
        this.diffCache = new Map();
        this.runs = [];
        this.memory = { notes: '', rules: '', preferences: '' };
        this.graphs = [];
        this.llmSelection = {};
        this.webview = host.webview;
        this.onDidDispose = host.onDidDispose;
        this.webview.html = this.getHtmlForWebview(this.webview);
        this.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        this.onDidDispose(() => this.dispose(), null, this.disposables);
        this.restoreState();
    }
    static createOrShow(extensionUri, backendClient, treeProvider, onSettingsUpdated, storage) {
        var _a, _b;
        const column = (_b = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.viewColumn) !== null && _b !== void 0 ? _b : vscode.ViewColumn.One;
        if (ChatPanel.currentPanel) {
            return ChatPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('numezisChat', 'Numezis Studio Chat', column, {
            enableScripts: true,
        });
        ChatPanel.currentPanel = new ChatPanel({ webview: panel.webview, onDidDispose: panel.onDidDispose }, extensionUri, backendClient, treeProvider, onSettingsUpdated, storage);
        return ChatPanel.currentPanel;
    }
    static createForView(view, extensionUri, backendClient, treeProvider, onSettingsUpdated, storage) {
        view.webview.options = {
            enableScripts: true,
        };
        return new ChatPanel({ webview: view.webview, onDidDispose: view.onDidDispose }, extensionUri, backendClient, treeProvider, onSettingsUpdated, storage);
    }
    dispose() {
        ChatPanel.currentPanel = undefined;
        this.pollCanceller.forEach((cancel) => cancel());
        this.disposables.forEach((disposable) => disposable.dispose());
    }
    handleWebviewMessage(message) {
        switch (message.type) {
            case 'run':
                void this.startRun(message.prompt, message.agentId);
                return;
            case 'applyDiff':
                void this.applyDiff(message.runId);
                return;
            case 'selectRun':
                this.selectedRunId = message.runId;
                this.pushState();
                return;
            case 'updateSettings':
                void this.updateSettings(message.settings);
                return;
            case 'checkHealth':
                void this.checkHealth();
                return;
            case 'openDiff':
                void this.openDiffForRun(message.runId);
                return;
            case 'rejectDiff':
                this.rejectDiff(message.runId);
                return;
            case 'openFile':
                void this.openFile(message.path);
                return;
            case 'updateTags':
                this.updateTags(message.runId, message.tags);
                return;
            case 'updateMemory':
                this.updateMemory(message.memory);
                return;
            case 'openConfigPage':
                void this.openConfigPage();
                return;
            case 'loadConfig':
                void this.loadBackendConfig();
                return;
            case 'selectGraph':
                this.selectedGraphId = message.graphId || undefined;
                this.pushState();
                return;
            case 'setLlmSelection':
                this.llmSelection = { provider: message.provider, model: message.model };
                this.pushState();
                return;
        }
    }
    async startRun(prompt, agentId) {
        if (!this.backendClient.hasBaseUrl()) {
            this.postToWebview({ type: 'error', message: 'Backend is not configured. Add it in Settings first.' });
            return;
        }
        try {
            if (this.selectedGraphId) {
                await this.runGraph(prompt);
                return;
            }
            const llm = this.getLlmSettings();
            if (this.llmSelection.provider) {
                llm.provider = this.llmSelection.provider;
            }
            if (this.llmSelection.model) {
                llm.model = this.llmSelection.model;
            }
            const { runId, status } = await this.backendClient.runAgent(prompt, agentId, llm);
            const run = { runId, prompt, agentId, status };
            this.treeProvider.addRun(run);
            this.runs = [
                { ...run, createdAt: new Date().toISOString(), tags: [], artifacts: { plans: [], patches: [], logs: [] } },
                ...this.runs.filter((existing) => existing.runId !== runId),
            ];
            this.selectedRunId = runId;
            this.postToWebview({ type: 'status', runId, status });
            this.pushState();
            this.lastRunId = runId;
            const cancel = this.backendClient.subscribeToRun(runId, (runStatus) => {
                this.treeProvider.updateRunStatus(runId, runStatus.status);
                this.runs = this.runs.map((item) => {
                    var _a, _b;
                    if (item.runId !== runId) {
                        return item;
                    }
                    const output = this.mergeOutput((_a = item.output) !== null && _a !== void 0 ? _a : [], (_b = runStatus.output) !== null && _b !== void 0 ? _b : []);
                    const artifacts = this.extractArtifacts(output);
                    return { ...item, status: runStatus.status, output, artifacts };
                });
                this.postToWebview({
                    type: 'status',
                    runId,
                    status: runStatus.status,
                    output: runStatus.output,
                });
                this.pushState();
                if (['completed', 'failed', 'errored'].includes(runStatus.status)) {
                    cancel();
                    this.pollCanceller.delete(runId);
                    if (runStatus.status === 'completed') {
                        void this.publishDiff(runId);
                    }
                }
            });
            this.pollCanceller.set(runId, cancel);
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message });
            vscode.window.showErrorMessage(`Agent run failed: ${message}`);
        }
    }
    async publishDiff(runId) {
        try {
            const { diffHunk } = await this.backendClient.getDiff(runId);
            this.diffCache.set(runId, diffHunk);
            this.runs = this.runs.map((item) => item.runId === runId ? { ...item, diffHunk } : item);
            this.postToWebview({ type: 'diff', runId, diffHunk });
            this.lastRunId = runId;
            this.pushState();
            await this.openDiffView(runId, diffHunk);
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message: `Unable to load diff: ${message}` });
        }
    }
    async openDiffForRun(runId) {
        const cached = this.diffCache.get(runId);
        if (cached) {
            await this.openDiffView(runId, cached);
            return;
        }
        try {
            const { diffHunk } = await this.backendClient.getDiff(runId);
            this.diffCache.set(runId, diffHunk);
            await this.openDiffView(runId, diffHunk);
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message: `Unable to open diff: ${message}` });
        }
    }
    async applyDiff(runId) {
        const cachedDiff = this.diffCache.get(runId);
        if (!cachedDiff) {
            this.postToWebview({ type: 'error', message: 'No diff available for this run yet.' });
            return;
        }
        try {
            const result = await this.backendClient.applyDiff(runId, cachedDiff);
            this.postToWebview({ type: 'applyResult', runId, status: result.status });
            vscode.window.showInformationMessage(`Diff ${result.status} for run ${runId}.`);
            this.pushState();
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message: `Apply diff failed: ${message}` });
        }
    }
    async requestApplyDiff(runId) {
        const targetId = runId !== null && runId !== void 0 ? runId : this.lastRunId;
        if (!targetId) {
            vscode.window.showWarningMessage('No run selected to apply.');
            return;
        }
        await this.applyDiff(targetId);
    }
    async runPrompt(prompt, agentId) {
        await this.startRun(prompt, agentId);
    }
    async openDiffView(runId, diffHunk) {
        const before = await vscode.workspace.openTextDocument({
            content: '',
            language: 'diff',
        });
        const after = await vscode.workspace.openTextDocument({
            content: diffHunk,
            language: 'diff',
        });
        await vscode.commands.executeCommand('vscode.diff', before.uri, after.uri, `Numezis diff • ${runId}`);
    }
    postToWebview(message) {
        this.webview.postMessage(message);
    }
    restoreState() {
        this.runs = this.storage.getRuns();
        this.memory = this.storage.getMemory();
        this.pushState();
        void this.loadBackendConfig();
    }
    persistRuns() {
        this.storage.setRuns(this.runs);
    }
    mergeOutput(existing, incoming) {
        if (!incoming.length) {
            return existing;
        }
        if (!existing.length) {
            return incoming;
        }
        if (incoming.length <= existing.length) {
            return existing;
        }
        return existing.concat(incoming.slice(existing.length));
    }
    extractArtifacts(output) {
        const plans = [];
        const patches = [];
        const logs = [];
        output.forEach((message) => {
            const content = message.content || '';
            if (/^plan:/i.test(content)) {
                plans.push(content);
            }
            if (content.includes('```diff') || content.includes('@@')) {
                patches.push(content);
            }
            if (/^log:/i.test(content) || /trace:/i.test(content)) {
                logs.push(content);
            }
        });
        return { plans, patches, logs };
    }
    rejectDiff(runId) {
        this.diffCache.delete(runId);
        this.runs = this.runs.map((item) => item.runId === runId ? { ...item, diffHunk: undefined } : item);
        this.pushState();
    }
    async openFile(filePath) {
        var _a;
        if (!filePath) {
            return;
        }
        const folder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
        if (!folder) {
            vscode.window.showWarningMessage('Open a workspace folder first.');
            return;
        }
        const uri = vscode.Uri.joinPath(folder.uri, filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
    }
    updateTags(runId, tags) {
        this.runs = this.runs.map((item) => item.runId === runId ? { ...item, tags } : item);
        this.pushState();
    }
    updateMemory(memory) {
        this.memory = memory;
        this.storage.setMemory(memory);
        this.pushState();
    }
    pushState() {
        const settings = this.getSettings();
        this.postToWebview({
            type: 'state',
            state: {
                runs: this.runs,
                selectedRunId: this.selectedRunId,
                connected: this.backendClient.hasBaseUrl(),
                backendUrl: settings.backendUrl,
                apiToken: settings.apiToken,
                llm: settings.llm,
                memory: this.memory,
                graphs: this.graphs,
                selectedGraphId: this.selectedGraphId,
                llmConfig: this.llmConfig,
                embeddingConfig: this.embeddingConfig,
                workspaceConfig: this.workspaceConfig,
            },
        });
        this.persistRuns();
    }
    getSettings() {
        const config = vscode.workspace.getConfiguration('numezis');
        const llm = this.getLlmSettings();
        return {
            backendUrl: config.get('backendUrl', ''),
            apiToken: config.get('apiToken', ''),
            llm,
        };
    }
    getLlmSettings() {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            provider: config.get('llm.provider', 'openai'),
            baseUrl: config.get('llm.baseUrl', ''),
            model: config.get('llm.model', 'gpt-4o-mini'),
            apiKey: config.get('llm.apiKey', ''),
            temperature: config.get('llm.temperature', 0.2),
            maxTokens: config.get('llm.maxTokens', 0),
        };
    }
    async updateSettings(settings) {
        var _a, _b, _c, _d, _e, _f;
        const config = vscode.workspace.getConfiguration('numezis');
        await config.update('backendUrl', settings.backendUrl, vscode.ConfigurationTarget.Global);
        await config.update('apiToken', settings.apiToken, vscode.ConfigurationTarget.Global);
        await config.update('llm.provider', (_a = settings.llm.provider) !== null && _a !== void 0 ? _a : '', vscode.ConfigurationTarget.Global);
        await config.update('llm.baseUrl', (_b = settings.llm.baseUrl) !== null && _b !== void 0 ? _b : '', vscode.ConfigurationTarget.Global);
        await config.update('llm.model', (_c = settings.llm.model) !== null && _c !== void 0 ? _c : '', vscode.ConfigurationTarget.Global);
        await config.update('llm.apiKey', (_d = settings.llm.apiKey) !== null && _d !== void 0 ? _d : '', vscode.ConfigurationTarget.Global);
        await config.update('llm.temperature', (_e = settings.llm.temperature) !== null && _e !== void 0 ? _e : 0, vscode.ConfigurationTarget.Global);
        await config.update('llm.maxTokens', (_f = settings.llm.maxTokens) !== null && _f !== void 0 ? _f : 0, vscode.ConfigurationTarget.Global);
        if (settings.backendUrl) {
            this.backendClient.setBaseUrl(settings.backendUrl);
        }
        if (settings.apiToken) {
            this.backendClient.setToken(settings.apiToken);
        }
        this.onSettingsUpdated();
        this.pushState();
        void this.loadBackendConfig();
    }
    async checkHealth() {
        try {
            const health = await this.backendClient.getHealth();
            if (!health.ok) {
                this.postToWebview({ type: 'error', message: 'Backend health check failed.' });
            }
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message: `Backend unavailable: ${message}` });
        }
    }
    async loadBackendConfig() {
        var _a;
        if (!this.backendClient.hasBaseUrl()) {
            return;
        }
        try {
            const [llmConfig, embeddingConfig, graphs, workspaceConfig] = await Promise.all([
                this.backendClient.getLlmConfig(),
                this.backendClient.getEmbeddingConfig(),
                this.backendClient.listAgentGraphs(),
                this.backendClient.getWorkspaceConfig(),
            ]);
            this.llmConfig = llmConfig;
            this.embeddingConfig = embeddingConfig;
            this.graphs = (_a = graphs.graphs) !== null && _a !== void 0 ? _a : graphs;
            this.workspaceConfig = workspaceConfig;
            this.pushState();
        }
        catch (error) {
            const message = typeof error === 'string' ? error : error.message;
            this.postToWebview({ type: 'error', message: `Config load failed: ${message}` });
        }
    }
    async runGraph(message) {
        const graphId = this.selectedGraphId;
        if (!graphId) {
            return;
        }
        const runId = `graph-${graphId}-${Date.now()}`;
        const run = { runId, prompt: message, agentId: graphId, status: 'running' };
        this.treeProvider.addRun(run);
        this.runs = [
            { ...run, createdAt: new Date().toISOString(), tags: [], artifacts: { plans: [], patches: [], logs: [] } },
            ...this.runs.filter((existing) => existing.runId !== runId),
        ];
        this.selectedRunId = runId;
        this.pushState();
        await this.backendClient.runAgentGraphStream(graphId, message, this.llmSelection, (chunk) => {
            var _a;
            if (chunk.type === 'update') {
                const content = JSON.stringify(chunk.payload);
                this.appendRunOutput(runId, { role: 'assistant', content });
            }
            if (chunk.type === 'final') {
                const content = JSON.stringify(chunk.payload);
                this.appendRunOutput(runId, { role: 'assistant', content });
                this.updateRunStatus(runId, 'completed');
            }
            if (chunk.type === 'error') {
                const content = ((_a = chunk.payload) === null || _a === void 0 ? void 0 : _a.message) || 'Graph error';
                this.appendRunOutput(runId, { role: 'system', content });
                this.updateRunStatus(runId, 'failed');
            }
        });
    }
    appendRunOutput(runId, message) {
        this.runs = this.runs.map((item) => {
            var _a;
            if (item.runId !== runId)
                return item;
            const output = [...((_a = item.output) !== null && _a !== void 0 ? _a : []), message];
            const artifacts = this.extractArtifacts(output);
            return { ...item, output, artifacts };
        });
        this.pushState();
    }
    updateRunStatus(runId, status) {
        this.runs = this.runs.map((item) => item.runId === runId ? { ...item, status } : item);
        this.pushState();
    }
    async openConfigPage() {
        const settings = this.getSettings();
        if (!settings.backendUrl) {
            this.postToWebview({ type: 'error', message: 'Backend URL is not configured.' });
            return;
        }
        const url = `${settings.backendUrl.replace(/\/$/, '')}/config`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }
    getHtmlForWebview(webview) {
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Numezis Chat</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 0;
            height: 100vh;
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
          }
          .root {
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            padding: 0.6rem 0.75rem;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            background: var(--vscode-sideBar-background);
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
          }
          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.2rem 0.5rem;
            border-radius: 999px;
            font-size: 0.75rem;
            border: 1px solid var(--vscode-editorWidget-border);
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22c55e;
          }
          .status-dot.offline {
            background: #f97316;
          }
          .settings-bar {
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }
          .search-input {
            width: 100%;
            margin-bottom: 0.5rem;
          }
          .drawer {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
            background: var(--vscode-sideBar-background);
          }
          .drawer-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 0.75rem;
          }
          .runs-header {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 0.75rem;
          }
          .run-item {
            padding: 0.6rem 0.75rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border: 1px solid transparent;
            cursor: pointer;
            background: var(--vscode-editor-background);
          }
          .run-item.active {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-editorWidget-background);
          }
          .run-title {
            font-weight: 600;
            font-size: 0.85rem;
          }
          .run-meta {
            font-size: 0.75rem;
            opacity: 0.7;
          }
          .main {
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .actions-bar {
            display: flex;
            gap: 0.35rem;
            flex-wrap: wrap;
          }
          .messages {
            flex: 1;
            overflow-y: auto;
            padding: 0.6rem;
            background: var(--vscode-editor-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-editorWidget-border);
            min-height: 160px;
            max-height: 280px;
          }
          .message {
            margin-bottom: 0.9rem;
            padding: 0.75rem;
            border-radius: 10px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
          }
          .message .meta {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 0.25rem;
          }
          .input-row {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.6rem;
          }
          .input-row input, .input-row textarea, .input-row select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 0.4rem 0.6rem;
            font-size: 0.85rem;
          }
          .input-row textarea {
            flex: 1;
            min-height: 44px;
            max-height: 96px;
            resize: vertical;
          }
          .btn {
            padding: 0.5rem 0.9rem;
            border: none;
            border-radius: 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-weight: 600;
            font-size: 0.8rem;
          }
          .btn.secondary {
            background: transparent;
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border, var(--vscode-editorWidget-border));
          }
          .section {
            margin-bottom: 0.9rem;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 10px;
            background: var(--vscode-editor-background);
          }
          .section summary {
            list-style: none;
            cursor: pointer;
            padding: 0.6rem 0.75rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .section summary::after {
            content: "▾";
            font-size: 0.75rem;
            opacity: 0.7;
          }
          .section[open] summary::after {
            content: "▴";
          }
          .section summary::-webkit-details-marker {
            display: none;
          }
          .section-body {
            padding: 0.6rem 0.75rem 0.75rem;
            border-top: 1px solid var(--vscode-editorWidget-border);
          }
          .tag-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-bottom: 0.5rem;
          }
          .tag {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.2rem 0.5rem;
            border-radius: 999px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-size: 0.7rem;
          }
          .tag.small {
            font-size: 0.6rem;
            padding: 0.1rem 0.4rem;
          }
          .run-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin-top: 0.25rem;
          }
          .tag-remove {
            background: transparent;
            border: none;
            color: inherit;
            cursor: pointer;
          }
          .tag-input-row {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          .files-panel {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
          }
          .file-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            padding: 0.4rem 0.5rem;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
          }
          .diff-line {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.75rem;
            padding: 0.1rem 0.2rem;
            white-space: pre-wrap;
          }
          .diff-line.add {
            background: rgba(34, 197, 94, 0.12);
          }
          .diff-line.remove {
            background: rgba(248, 113, 113, 0.12);
          }
          .diff-line.meta {
            color: var(--vscode-descriptionForeground);
          }
          .diff-empty {
            font-size: 0.8rem;
            color: var(--vscode-descriptionForeground);
          }
          .artifact-section {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .artifact-body {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
          }
          .artifact-item {
            padding: 0.4rem 0.5rem;
            border-radius: 6px;
            border: 1px solid var(--vscode-editorWidget-border);
            background: var(--vscode-editor-background);
            font-size: 0.75rem;
          }
          .prompt-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.4rem;
          }
          .prompt-header .run-meta {
            margin: 0;
          }
          .chat-wrapper {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
          }
          .section-title {
            font-weight: 600;
            margin-bottom: 0.5rem;
          }
          .diff {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            padding: 0.75rem;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.8rem;
            white-space: pre-wrap;
            max-height: 320px;
            overflow: auto;
          }
          .settings-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          .settings-grid label {
            font-size: 0.75rem;
            color: var(--vscode-descriptionForeground);
          }
          .settings-grid input {
            width: 100%;
          }
          .settings-grid textarea {
            width: 100%;
            min-height: 60px;
            resize: vertical;
          }
          .inline-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem;
          }
        </style>
      </head>
      <body>
        <div id="reactRoot"></div>
        <script>
          const vscode = acquireVsCodeApi()
          const state = {
            runs: [],
            selectedRunId: null,
            connected: false,
            backendUrl: '',
            apiToken: '',
            llm: {
              provider: '',
              baseUrl: '',
              model: '',
              apiKey: '',
              temperature: 0.2,
              maxTokens: 0,
            },
            memory: {
              notes: '',
              rules: '',
              preferences: '',
            },
            search: '',
            tagFilter: '',
            graphs: [],
            selectedGraphId: '',
            llmConfig: null,
            embeddingConfig: null,
            workspaceConfig: null,
            llmSelection: {
              provider: '',
              model: '',
            },
          }

          const updateState = (partial) => {
            Object.assign(state, partial)
            if (!state.llmSelection.provider && state.llm?.provider) {
              state.llmSelection.provider = state.llm.provider
            }
            if (!state.llmSelection.model && state.llm?.model) {
              state.llmSelection.model = state.llm.model
            }
            render()
          }

          const escapeHtml = (value) => {
            return String(value || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
          }

          const setSelectedRun = (runId) => {
            state.selectedRunId = runId
            vscode.postMessage({ type: 'selectRun', runId })
            render()
          }

          const setGraph = (graphId) => {
            state.selectedGraphId = graphId
            vscode.postMessage({ type: 'selectGraph', graphId })
            render()
          }

          const setLlmSelection = (provider, model) => {
            state.llmSelection = { provider, model }
            vscode.postMessage({ type: 'setLlmSelection', provider, model })
          }

          const handleSend = () => {
            const promptEl = document.getElementById('promptInput')
            const agentEl = document.getElementById('agentInput')
            const prompt = promptEl.value.trim()
            const agentId = agentEl.value.trim() || 'agent-001'
            if (!prompt) {
              return
            }
            vscode.postMessage({ type: 'run', prompt, agentId })
            promptEl.value = ''
          }

          const handleApply = () => {
            if (!state.selectedRunId) return
            vscode.postMessage({ type: 'applyDiff', runId: state.selectedRunId })
          }

          const handleReject = () => {
            if (!state.selectedRunId) return
            vscode.postMessage({ type: 'rejectDiff', runId: state.selectedRunId })
          }

          const saveSettings = () => {
            const settings = {
              backendUrl: document.getElementById('backendUrl').value.trim(),
              apiToken: document.getElementById('apiToken').value.trim(),
              llm: {
                provider: document.getElementById('llmProvider').value.trim(),
                baseUrl: document.getElementById('llmBaseUrl').value.trim(),
                model: document.getElementById('llmModel').value.trim(),
                apiKey: document.getElementById('llmApiKey').value.trim(),
                temperature: Number(document.getElementById('llmTemperature').value || 0.2),
                maxTokens: Number(document.getElementById('llmMaxTokens').value || 0),
              },
            }
            vscode.postMessage({ type: 'updateSettings', settings })
          }

          const saveMemory = () => {
            const memory = {
              notes: document.getElementById('memoryNotes').value,
              rules: document.getElementById('memoryRules').value,
              preferences: document.getElementById('memoryPrefs').value,
            }
            vscode.postMessage({ type: 'updateMemory', memory })
          }

          const handleQuickAction = (action) => {
            const promptEl = document.getElementById('promptInput')
            const templates = {
              fix: 'Fix the issue in: ',
              explain: 'Explain the following code: ',
              refactor: 'Refactor the following code: ',
              test: 'Add tests for: ',
            }
            promptEl.value = templates[action] || ''
            promptEl.focus()
          }

          const parseDiffFiles = (diff) => {
            if (!diff) return []
            const lines = diff.split('\\n')
            const files = []
            lines.forEach((line) => {
              if (line.startsWith('diff --git')) {
                const parts = line.split(' ')
                const candidate = parts[3] || ''
                if (candidate.startsWith('b/')) {
                  files.push(candidate.slice(2))
                }
              }
              if (line.startsWith('+++ ')) {
                const path = line.replace('+++ ', '')
                if (path.startsWith('b/')) {
                  files.push(path.slice(2))
                }
              }
            })
            return Array.from(new Set(files.filter(Boolean)))
          }

          const renderDiff = (diff) => {
            if (!diff) {
              return '<div class="diff-empty">No diff yet.</div>'
            }
            return diff
              .split('\\n')
              .map((line) => {
                let cls = 'diff-line'
                if (line.startsWith('+') && !line.startsWith('+++')) cls += ' add'
                if (line.startsWith('-') && !line.startsWith('---')) cls += ' remove'
                if (line.startsWith('@@') || line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---')) cls += ' meta'
                return '<div class="' + cls + '">' + escapeHtml(line) + '</div>'
              })
              .join('')
          }

          const getProviders = () => {
            if (!state.llmConfig) {
              return []
            }
            if (Array.isArray(state.llmConfig.providers)) {
              return state.llmConfig.providers
            }
            const providers = []
            if (state.llmConfig.azure) providers.push('azure')
            if (state.llmConfig.lmstudio) providers.push('lmstudio')
            if (state.llmConfig.openai) providers.push('openai')
            return providers
          }

          const getSelectedProvider = () => {
            return state.llmSelection.provider || state.llm.provider || ''
          }

          const getSelectedModel = () => {
            return state.llmSelection.model || state.llm.model || ''
          }

          const updateTags = () => {
            const tagInput = document.getElementById('tagInput')
            const value = tagInput.value.trim()
            if (!value || !state.selectedRunId) return
            const current = (state.runs.find((run) => run.runId === state.selectedRunId)?.tags || [])
            const newTags = value.split(',').map((tag) => tag.trim()).filter(Boolean)
            const merged = Array.from(new Set(current.concat(newTags)))
            vscode.postMessage({ type: 'updateTags', runId: state.selectedRunId, tags: merged })
            tagInput.value = ''
          }

          const removeTag = (tag) => {
            if (!state.selectedRunId) return
            const current = (state.runs.find((run) => run.runId === state.selectedRunId)?.tags || [])
            const filtered = current.filter((item) => item !== tag)
            vscode.postMessage({ type: 'updateTags', runId: state.selectedRunId, tags: filtered })
          }

          const handleKeyboard = (event) => {
            if (event.metaKey && event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
            if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'a') {
              event.preventDefault()
              handleApply()
            }
            if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'r') {
              event.preventDefault()
              handleReject()
            }
            if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'o') {
              event.preventDefault()
              if (state.selectedRunId) {
                vscode.postMessage({ type: 'openDiff', runId: state.selectedRunId })
              }
            }
            if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'f') {
              event.preventDefault()
              const search = document.getElementById('runSearch')
              if (search) search.focus()
            }
          }

          document.addEventListener('keydown', handleKeyboard)

          const render = () => {
            const root = document.getElementById('reactRoot')
            const selected = state.runs.find((run) => run.runId === state.selectedRunId) || null
            const messages = selected?.output || []
            const diff = selected?.diffHunk || ''
            const artifacts = selected?.artifacts || { plans: [], patches: [], logs: [] }
            const tags = selected?.tags || []

            const filteredRuns = state.runs.filter((run) => {
              const prompt = run.prompt || ''
              const tagHit = state.tagFilter
                ? (run.tags || []).includes(state.tagFilter)
                : true
              const searchHit = state.search
                ? (
                    prompt.toLowerCase().includes(state.search.toLowerCase()) ||
                    run.agentId.toLowerCase().includes(state.search.toLowerCase()) ||
                    run.runId.toLowerCase().includes(state.search.toLowerCase()) ||
                    (run.tags || []).some((tag) => tag.toLowerCase().includes(state.search.toLowerCase()))
                  )
                : true
              return tagHit && searchHit
            })

            const runItemsHtml = filteredRuns
              .map((run) => {
                const activeClass = run.runId === state.selectedRunId ? 'active' : ''
                const runTags = (run.tags || [])
                  .map((tag) => '<span class="tag small">' + escapeHtml(tag) + '</span>')
                  .join('')
                return (
                  '<div class="run-item ' +
                  activeClass +
                  '" data-run="' +
                  run.runId +
                  '">' +
                  '<div class="run-title">' +
                  escapeHtml(run.prompt) +
                  '</div>' +
                  '<div class="run-meta">' +
                  escapeHtml(run.agentId) +
                  ' • ' +
                  escapeHtml(run.status) +
                  '</div>' +
                  (runTags ? '<div class="run-tags">' + runTags + '</div>' : '') +
                  '</div>'
                )
              })
              .join('')

            const messageHtml = messages.length
              ? messages
                  .map(
                    (message) =>
                      '<div class="message">' +
                      '<div class="meta">' +
                      escapeHtml(message.role) +
                      '</div>' +
                      '<div>' +
                      escapeHtml(message.content) +
                      '</div>' +
                      '</div>'
                  )
                  .join('')
              : '<div class="run-meta">Select a run or send a new prompt.</div>'

            const statusClass = state.connected ? '' : 'offline'
            const statusText = state.connected ? 'Connected' : 'Disconnected'
            const emptyRunsHtml = filteredRuns.length ? '' : '<div class="run-meta">No runs yet.</div>'
            const agentValue = selected && selected.agentId ? selected.agentId : 'agent-001'
            const diffDisabled = diff ? '' : 'disabled'
            const diffHtml = renderDiff(diff)
            const files = parseDiffFiles(diff)
            const filesHtml = files.length
              ? files
                  .map(
                    (file) =>
                      '<div class="file-item" data-file="' +
                      file +
                      '">' +
                      '<span>' +
                      escapeHtml(file) +
                      '</span>' +
                      '<button class="btn secondary file-open" data-file="' +
                      file +
                      '">Open</button>' +
                      '</div>'
                  )
                  .join('')
              : '<div class="run-meta">No files detected.</div>'

            const tagHtml = tags.length
              ? tags
                  .map(
                    (tag) =>
                      '<span class="tag">' +
                      escapeHtml(tag) +
                      '<button class="tag-remove" data-tag="' +
                      escapeHtml(tag) +
                      '">x</button>' +
                      '</span>'
                  )
                  .join('')
              : '<span class="run-meta">No tags</span>'

            const providers = getProviders()
            const providerOptions = providers.length
              ? providers
                  .map((provider) => {
                    const selectedAttr = provider === getSelectedProvider() ? 'selected' : ''
                    return '<option value="' + provider + '" ' + selectedAttr + '>' + escapeHtml(provider) + '</option>'
                  })
                  .join('')
              : '<option value="">default</option>'

            const graphOptions = state.graphs.length
              ? state.graphs
                  .map((graph) => {
                    const id = graph._id || graph.id || ''
                    const name = graph.name || id
                    const selectedAttr = id === state.selectedGraphId ? 'selected' : ''
                    return '<option value="' + id + '" ' + selectedAttr + '>' + escapeHtml(name) + '</option>'
                  })
                  .join('')
              : '<option value="">No graphs</option>'

            const workspaceInfo = state.workspaceConfig?.workingFolder
              ? 'Workspace: ' + escapeHtml(state.workspaceConfig.workingFolder)
              : 'Workspace not configured'

            const embeddingInfo = state.embeddingConfig?.provider
              ? 'Embeddings: ' + escapeHtml(state.embeddingConfig.provider)
              : 'Embeddings not configured'

            const html =
              '<div class="root">' +
                '<div class="topbar">' +
                  '<div class="brand">' +
                    '<span>Numezis Studio</span>' +
                    '<span class="status-pill">' +
                      '<span class="status-dot ' + statusClass + '"></span>' +
                      statusText +
                    '</span>' +
                  '</div>' +
                  '<div class="settings-bar">' +
                    '<button class="btn secondary" id="reloadConfig">Reload</button>' +
                    '<button class="btn secondary" id="openConfig">Config</button>' +
                    '<button class="btn" id="saveSettings">Save</button>' +
                  '</div>' +
                '</div>' +
                '<div class="drawer">' +
                  '<div class="drawer-scroll">' +
                    '<details class="section" open>' +
                      '<summary>Chat</summary>' +
                      '<div class="section-body">' +
                        '<div class="prompt-header">' +
                          '<span class="run-meta">Active run</span>' +
                          '<div class="actions-bar">' +
                            '<button class="btn secondary" data-action="fix">Fix</button>' +
                            '<button class="btn secondary" data-action="explain">Explain</button>' +
                            '<button class="btn secondary" data-action="refactor">Refactor</button>' +
                            '<button class="btn secondary" data-action="test">Test</button>' +
                          '</div>' +
                        '</div>' +
                        '<div class="chat-wrapper">' +
                          '<div class="messages">' +
                            messageHtml +
                          '</div>' +
                          '<div class="input-row">' +
                            '<input id="agentInput" class="agent-input" placeholder="Agent ID" value="' + agentValue + '" />' +
                            '<textarea id="promptInput" placeholder="Type a prompt..."></textarea>' +
                            '<button class="btn" id="sendBtn">Send</button>' +
                          '</div>' +
                          '<div class="input-row">' +
                            '<label class="run-meta" style="min-width:60px;">Graph</label>' +
                            '<select id="graphSelect">' +
                              graphOptions +
                            '</select>' +
                          '</div>' +
                          '<div class="input-row">' +
                            '<label class="run-meta" style="min-width:60px;">LLM</label>' +
                            '<select id="llmProviderSelect">' +
                              providerOptions +
                            '</select>' +
                            '<input id="llmModelInput" placeholder="Model" value="' + escapeHtml(getSelectedModel()) + '" />' +
                          '</div>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section" open>' +
                      '<summary>Runs</summary>' +
                      '<div class="section-body">' +
                        '<input id="runSearch" class="search-input" placeholder="Search runs..." value="' + escapeHtml(state.search) + '" />' +
                        '<div class="run-meta">Filter tag</div>' +
                        '<input id="tagFilter" class="search-input" placeholder="Tag name" value="' + escapeHtml(state.tagFilter) + '" />' +
                        emptyRunsHtml +
                        runItemsHtml +
                      '</div>' +
                    '</details>' +

                    '<details class="section">' +
                      '<summary>Settings</summary>' +
                      '<div class="section-body">' +
                        '<div class="run-meta" style="margin-bottom:0.4rem;">' + workspaceInfo + '</div>' +
                        '<div class="run-meta" style="margin-bottom:0.6rem;">' + embeddingInfo + '</div>' +
                        '<div class="settings-grid">' +
                          '<label>Backend URL</label>' +
                          '<input id="backendUrl" value="' + (state.backendUrl || '') + '" placeholder="http://localhost:3000" />' +
                          '<label>API Token</label>' +
                          '<input id="apiToken" type="password" value="' + (state.apiToken || '') + '" placeholder="optional" />' +
                          '<label>LLM Provider</label>' +
                          '<input id="llmProvider" value="' + (state.llm.provider || '') + '" placeholder="openai / ollama / anthropic" />' +
                          '<label>LLM Base URL</label>' +
                          '<input id="llmBaseUrl" value="' + (state.llm.baseUrl || '') + '" placeholder="optional" />' +
                          '<label>LLM Model</label>' +
                          '<input id="llmModel" value="' + (state.llm.model || '') + '" placeholder="model name" />' +
                          '<label>LLM API Key</label>' +
                          '<input id="llmApiKey" type="password" value="' + (state.llm.apiKey || '') + '" placeholder="optional" />' +
                          '<div class="inline-fields">' +
                            '<div>' +
                              '<label>Temperature</label>' +
                              '<input id="llmTemperature" type="number" step="0.1" value="' + (state.llm.temperature ?? 0.2) + '" />' +
                            '</div>' +
                            '<div>' +
                              '<label>Max Tokens</label>' +
                              '<input id="llmMaxTokens" type="number" step="1" value="' + (state.llm.maxTokens ?? 0) + '" />' +
                            '</div>' +
                          '</div>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section">' +
                      '<summary>Memory</summary>' +
                      '<div class="section-body">' +
                        '<div class="settings-grid">' +
                          '<label>Notes</label>' +
                          '<textarea id="memoryNotes" rows="3" placeholder="Project notes">' + escapeHtml(state.memory.notes) + '</textarea>' +
                          '<label>Rules</label>' +
                          '<textarea id="memoryRules" rows="3" placeholder="Coding rules">' + escapeHtml(state.memory.rules) + '</textarea>' +
                          '<label>Preferences</label>' +
                          '<textarea id="memoryPrefs" rows="3" placeholder="Preferences">' + escapeHtml(state.memory.preferences) + '</textarea>' +
                          '<button class="btn secondary" id="saveMemory">Save memory</button>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section">' +
                      '<summary>Tags</summary>' +
                      '<div class="section-body">' +
                        '<div class="tag-row">' +
                          tagHtml +
                        '</div>' +
                        '<div class="tag-input-row">' +
                          '<input id="tagInput" placeholder="Add tags, comma separated" />' +
                          '<button class="btn secondary" id="addTag">Add</button>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section">' +
                      '<summary>Files / Edits</summary>' +
                      '<div class="section-body">' +
                        '<div class="files-panel">' +
                          filesHtml +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section" open>' +
                      '<summary>Diff</summary>' +
                      '<div class="section-body">' +
                        '<div class="diff">' + diffHtml + '</div>' +
                        '<div style="margin-top:0.75rem; display:flex; gap:0.5rem;">' +
                          '<button class="btn" id="applyDiff" ' + diffDisabled + '>Apply</button>' +
                          '<button class="btn secondary" id="rejectDiff" ' + diffDisabled + '>Reject</button>' +
                          '<button class="btn secondary" id="openDiff" ' + diffDisabled + '>Open diff</button>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +

                    '<details class="section">' +
                      '<summary>Artifacts</summary>' +
                      '<div class="section-body">' +
                        '<div class="artifact-section">' +
                          '<div class="run-meta">Plans (' + artifacts.plans.length + ')</div>' +
                          '<div class="artifact-body">' + artifacts.plans.map((item) => '<div class="artifact-item">' + escapeHtml(item) + '</div>').join('') + '</div>' +
                          '<div class="run-meta">Patches (' + artifacts.patches.length + ')</div>' +
                          '<div class="artifact-body">' + artifacts.patches.map((item) => '<div class="artifact-item">' + escapeHtml(item) + '</div>').join('') + '</div>' +
                          '<div class="run-meta">Logs (' + artifacts.logs.length + ')</div>' +
                          '<div class="artifact-body">' + artifacts.logs.map((item) => '<div class="artifact-item">' + escapeHtml(item) + '</div>').join('') + '</div>' +
                        '</div>' +
                      '</div>' +
                    '</details>' +
                  '</div>' +
                '</div>' +
              '</div>'

            root.innerHTML = html

            root.querySelectorAll('.run-item').forEach((item) => {
              item.addEventListener('click', () => setSelectedRun(item.dataset.run))
            })
            root.querySelectorAll('[data-action]').forEach((item) => {
              item.addEventListener('click', () => handleQuickAction(item.dataset.action))
            })
            root.querySelectorAll('.tag-remove').forEach((item) => {
              item.addEventListener('click', () => removeTag(item.dataset.tag))
            })
            root.querySelectorAll('.file-open').forEach((item) => {
              item.addEventListener('click', () => vscode.postMessage({ type: 'openFile', path: item.dataset.file }))
            })
            const sendBtn = document.getElementById('sendBtn')
            if (sendBtn) sendBtn.addEventListener('click', handleSend)
            const applyBtn = document.getElementById('applyDiff')
            if (applyBtn) applyBtn.addEventListener('click', handleApply)
            const rejectBtn = document.getElementById('rejectDiff')
            if (rejectBtn) rejectBtn.addEventListener('click', handleReject)
            const saveBtn = document.getElementById('saveSettings')
            if (saveBtn) saveBtn.addEventListener('click', saveSettings)
            const reloadBtn = document.getElementById('reloadConfig')
            if (reloadBtn) reloadBtn.addEventListener('click', () => vscode.postMessage({ type: 'loadConfig' }))
            const openConfigBtn = document.getElementById('openConfig')
            if (openConfigBtn) openConfigBtn.addEventListener('click', () => vscode.postMessage({ type: 'openConfigPage' }))
            const memoryBtn = document.getElementById('saveMemory')
            if (memoryBtn) memoryBtn.addEventListener('click', saveMemory)
            const addTagBtn = document.getElementById('addTag')
            if (addTagBtn) addTagBtn.addEventListener('click', updateTags)
            const runSearch = document.getElementById('runSearch')
            if (runSearch) runSearch.addEventListener('input', (event) => {
              state.search = event.target.value
              render()
            })
            const tagFilter = document.getElementById('tagFilter')
            if (tagFilter) tagFilter.addEventListener('input', (event) => {
              state.tagFilter = event.target.value
              render()
            })
            const graphSelect = document.getElementById('graphSelect')
            if (graphSelect) graphSelect.addEventListener('change', (event) => {
              setGraph(event.target.value)
            })
            const providerSelect = document.getElementById('llmProviderSelect')
            if (providerSelect) providerSelect.addEventListener('change', (event) => {
              setLlmSelection(event.target.value, getSelectedModel())
            })
            const modelInput = document.getElementById('llmModelInput')
            if (modelInput) modelInput.addEventListener('input', (event) => {
              setLlmSelection(getSelectedProvider(), event.target.value)
            })
            const healthBtn = document.getElementById('healthCheck')
            if (healthBtn) healthBtn.addEventListener('click', () => vscode.postMessage({ type: 'checkHealth' }))
            const openDiffBtn = document.getElementById('openDiff')
            if (openDiffBtn && diff) {
              openDiffBtn.addEventListener('click', () => vscode.postMessage({ type: 'openDiff', runId: state.selectedRunId }))
            }
            const messagesEl = root.querySelector('.messages')
            if (messagesEl) {
              messagesEl.scrollTop = messagesEl.scrollHeight
            }
          }

          window.addEventListener('message', (event) => {
            const message = event.data
            if (message.type === 'state') {
              updateState({
                runs: message.state.runs || [],
                selectedRunId: message.state.selectedRunId || null,
                connected: message.state.connected,
                backendUrl: message.state.backendUrl || '',
                llm: message.state.llm || state.llm,
                apiToken: message.state.apiToken || '',
                memory: message.state.memory || state.memory,
                graphs: message.state.graphs || [],
                selectedGraphId: message.state.selectedGraphId || '',
                llmConfig: message.state.llmConfig || null,
                embeddingConfig: message.state.embeddingConfig || null,
                workspaceConfig: message.state.workspaceConfig || null,
              })
              return
            }
            if (message.type === 'error') {
              alert(message.message)
            }
          })

          render()
        </script>
      </body>
      </html>
    `;
    }
}
exports.ChatPanel = ChatPanel;
