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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const panelState_1 = require("../state/panelState");
const handlers_1 = require("../handlers");
/**
 * Storage adapter for persisting runs to VS Code global state
 */
function createRunStorage(context) {
    const RUNS_KEY = 'numezis.runs';
    return {
        getRuns: () => { var _a; return (_a = context.globalState.get(RUNS_KEY)) !== null && _a !== void 0 ? _a : []; },
        setRuns: (runs) => {
            void context.globalState.update(RUNS_KEY, runs);
        },
    };
}
/**
 * ChatPanel manages the webview for the Numezis Code extension.
 *
 * This class orchestrates the handlers and manages communication
 * between the webview and the extension.
 */
class ChatPanel {
    constructor(context, backendClient, treeProvider) {
        this.context = context;
        this.backendClient = backendClient;
        this.treeProvider = treeProvider;
        const storage = createRunStorage(context);
        this.state = new panelState_1.PanelState(storage);
        // Initialize handlers
        this.runHandler = new handlers_1.RunHandler(backendClient, this.state, treeProvider);
        this.settingsHandler = new handlers_1.SettingsHandler(backendClient, () => this.syncState());
        this.llmConfigHandler = new handlers_1.LlmConfigHandler(backendClient, this.state);
        this.embeddingHandler = new handlers_1.EmbeddingHandler(backendClient, this.state);
        this.graphHandler = new handlers_1.GraphHandler(backendClient, this.state, treeProvider);
        // Subscribe to state changes
        this.state.onChange((uiState) => {
            this.postMessage({ type: 'state', state: uiState });
        });
        // Populate tree provider with persisted runs
        this.state.getRuns().forEach((run) => {
            const treeRun = { runId: run.runId, prompt: run.prompt, agentId: run.agentId, status: run.status };
            treeProvider.addRun(treeRun);
        });
    }
    /**
     * Set the webview instance and initialize it
     */
    setWebview(webview) {
        this.webview = webview;
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
                vscode.Uri.file(path.join(this.context.extensionPath, 'out')),
            ],
        };
        webview.html = this.getHtmlForWebview(webview);
        webview.onDidReceiveMessage((message) => this.handleMessage(message), undefined, this.context.subscriptions);
        // Send initial state
        this.syncState();
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.state.cancelAllPolls();
    }
    // ============================================================================
    // Message Handling
    // ============================================================================
    async handleMessage(message) {
        try {
            switch (message.type) {
                // Run operations
                case 'run':
                    await this.runHandler.startRun(message.prompt, message.agentId);
                    break;
                case 'stopRun':
                    this.runHandler.stopRun(message.runId);
                    break;
                case 'applyDiff':
                    const result = await this.runHandler.applyDiff(message.runId);
                    this.postMessage({ type: 'applyResult', runId: message.runId, status: result.status });
                    break;
                case 'rejectDiff':
                    this.runHandler.rejectDiff(message.runId);
                    break;
                case 'selectRun':
                    this.state.setSelectedRunId(message.runId);
                    break;
                // Settings operations
                case 'updateSettings':
                    await this.settingsHandler.updateSettings(message.settings);
                    await this.loadAllConfigs();
                    break;
                case 'openConfigPage':
                    void vscode.env.openExternal(vscode.Uri.parse(`${this.backendClient.getBaseUrl()}/account`));
                    break;
                case 'loadConfig':
                    await this.loadAllConfigs();
                    break;
                case 'login':
                    void vscode.commands.executeCommand('numezis.login');
                    break;
                case 'openAccount':
                    void vscode.env.openExternal(vscode.Uri.parse(`${this.backendClient.getBaseUrl()}/app/account`));
                    break;
                // Graph operations
                case 'selectGraph':
                    this.state.setSelectedGraphId(message.graphId);
                    break;
                case 'loadGraph':
                    await this.graphHandler.loadGraphDetail(message.graphId);
                    break;
                case 'saveGraph':
                    await this.graphHandler.saveGraph(message.graphId, message.config);
                    break;
                case 'deleteGraph':
                    await this.graphHandler.deleteGraph(message.graphId);
                    break;
                // LLM selection
                case 'setLlmSelection':
                    this.state.setLlmSelection(message.provider, message.model);
                    break;
                // Workspace operations
                case 'validateWorkspace':
                    const validation = await this.backendClient.validateFolder(message.path);
                    if (validation.valid) {
                        vscode.window.showInformationMessage('Folder is valid!');
                    }
                    else {
                        vscode.window.showWarningMessage(validation.message || 'Invalid folder');
                    }
                    break;
                case 'saveWorkspace':
                    await this.backendClient.saveWorkspaceConfig(message.config);
                    const wsConfig = await this.backendClient.getWorkspaceConfig();
                    this.state.setWorkspaceConfig(wsConfig);
                    vscode.window.showInformationMessage('Workspace saved!');
                    break;
                // Context operations
                case 'saveContext':
                    const ctxPayload = message.config ? JSON.parse(message.config) : {};
                    await this.backendClient.saveContextConfig(ctxPayload);
                    const ctxConfig = await this.backendClient.getContextConfig();
                    this.state.setContextConfig(ctxConfig);
                    vscode.window.showInformationMessage('Context saved!');
                    break;
                // LLM config operations
                case 'saveLlmProvider':
                    await this.llmConfigHandler.setProvider(message.provider);
                    vscode.window.showInformationMessage(`LLM provider set to ${message.provider}`);
                    break;
                case 'saveLlmAzure':
                    await this.llmConfigHandler.saveAzure(message.config);
                    vscode.window.showInformationMessage('Azure LLM config saved!');
                    break;
                case 'saveLlmLmstudio':
                    await this.llmConfigHandler.saveLmstudio(message.config);
                    vscode.window.showInformationMessage('LM Studio config saved!');
                    break;
                case 'resetLlm':
                    await this.llmConfigHandler.reset();
                    vscode.window.showInformationMessage('LLM config reset!');
                    break;
                // Embedding config operations
                case 'saveEmbeddingProvider':
                    await this.embeddingHandler.setProvider(message.provider);
                    vscode.window.showInformationMessage(`Embedding provider set to ${message.provider}`);
                    break;
                case 'saveEmbeddingAzure':
                    await this.embeddingHandler.saveAzure(message.config);
                    vscode.window.showInformationMessage('Azure embedding config saved!');
                    break;
                case 'saveEmbeddingLmstudio':
                    await this.embeddingHandler.saveLmstudio(message.config);
                    vscode.window.showInformationMessage('LM Studio embedding config saved!');
                    break;
                case 'resetEmbedding':
                    await this.embeddingHandler.reset();
                    vscode.window.showInformationMessage('Embedding config reset!');
                    break;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error: ${errorMessage}`);
            this.postMessage({ type: 'error', message: errorMessage });
        }
    }
    // ============================================================================
    // State Synchronization
    // ============================================================================
    syncState() {
        this.postMessage({ type: 'state', state: this.state.getUiState() });
    }
    postMessage(message) {
        var _a;
        (_a = this.webview) === null || _a === void 0 ? void 0 : _a.postMessage(message);
    }
    async loadAllConfigs() {
        if (!this.backendClient.hasBaseUrl())
            return;
        // First check authentication status
        const authResult = await this.backendClient.checkAuth();
        this.state.setAuthState(Boolean(authResult), authResult === null || authResult === void 0 ? void 0 : authResult.email);
        // If not authenticated, skip loading protected configs
        if (!authResult) {
            console.log('Not authenticated, skipping LLM/graphs config loading');
            return;
        }
        try {
            const [llmConfig, graphs, wsConfig, ctxConfig, embConfig, tools] = await Promise.all([
                this.backendClient.getLlmConfig().catch(() => undefined),
                this.backendClient.listAgentGraphs().catch(() => ({ graphs: [] })),
                this.backendClient.getWorkspaceConfig().catch(() => undefined),
                this.backendClient.getContextConfig().catch(() => undefined),
                this.backendClient.getEmbeddingConfig().catch(() => undefined),
                this.backendClient.getToolsList().catch(() => ({ tools: [] })),
            ]);
            this.state.bulkUpdate({
                llmConfig,
                graphs: graphs.graphs,
                workspaceConfig: wsConfig,
                contextConfig: ctxConfig,
                embeddingConfig: embConfig,
                toolsList: tools.tools,
            });
        }
        catch (error) {
            console.error('Failed to load configs:', error);
        }
    }
    // ============================================================================
    // Webview HTML
    // ============================================================================
    getHtmlForWebview(webview) {
        const mediaPath = path.join(this.context.extensionPath, 'media');
        const htmlPath = path.join(mediaPath, 'webview.html');
        // Get URIs for resources
        const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'styles.css')));
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'app.js')));
        const nonce = this.getNonce();
        // Read HTML template and replace placeholders
        let html;
        try {
            html = fs.readFileSync(htmlPath, 'utf-8');
        }
        catch {
            // Fallback to inline template if file not found
            html = this.getInlineHtmlTemplate();
        }
        const csp = [
            `default-src 'none'`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
            `img-src ${webview.cspSource} data: https:`,
            `font-src ${webview.cspSource}`,
        ].join('; ');
        return html
            .replace('{{CSP}}', csp)
            .replace('{{NONCE}}', nonce)
            .replace('{{STYLES_URI}}', stylesUri.toString())
            .replace('{{SCRIPT_URI}}', scriptUri.toString());
    }
    getInlineHtmlTemplate() {
        // Fallback inline template if bundled assets aren't available
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="{{CSP}}" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Numezis Code</title>
        <link rel="stylesheet" href="{{STYLES_URI}}" />
      </head>
      <body>
        <div id="root">
          <p style="padding:1rem;color:var(--vscode-descriptionForeground);">
            Loading... If this persists, run <code>npm run build:webview</code> in the extension folder.
          </p>
        </div>
        <script nonce="{{NONCE}}" src="{{SCRIPT_URI}}"></script>
      </body>
      </html>
    `;
    }
    getNonce() {
        let text = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    }
    // ============================================================================
    // Public API for Commands
    // ============================================================================
    /**
     * Run a prompt with the specified agent (used by commands)
     */
    async runPrompt(prompt, agentId) {
        await this.runHandler.startRun(prompt, agentId);
    }
    /**
     * Request to apply diff for a run (used by commands)
     */
    async requestApplyDiff(runId) {
        const targetId = runId || this.state.getSelectedRunId() || this.state.getLastRunId();
        if (!targetId) {
            vscode.window.showErrorMessage('No run selected to apply diff.');
            return;
        }
        await this.runHandler.applyDiff(targetId);
    }
    /**
     * Factory method for creating ChatPanel from WebviewView
     */
    static createForView(view, extensionUri, backendClient, treeProvider, _onSettingsUpdated, _storage) {
        // Get context from the workspace state - we need to find it
        const context = globalThis.numezisContext;
        if (!context) {
            throw new Error('Extension context not available. Ensure activate() stores it globally.');
        }
        if (!ChatPanel.instance) {
            ChatPanel.instance = new ChatPanel(context, backendClient, treeProvider);
        }
        ChatPanel.instance.setWebview(view.webview);
        return ChatPanel.instance;
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        return ChatPanel.instance;
    }
}
exports.ChatPanel = ChatPanel;
