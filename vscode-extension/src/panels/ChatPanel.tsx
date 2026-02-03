import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { BackendClient } from '../utils/backendClient';
import type { AgentTreeProvider, AgentRun } from '../tree/AgentTreeProvider';
import { PanelState, type RunViewModel, type WebviewRequest, type PanelMessage } from '../state/panelState';
import { RunHandler, SettingsHandler, LlmConfigHandler, EmbeddingHandler, GraphHandler } from '../handlers';

/**
 * Storage adapter for persisting runs to VS Code global state
 */
function createRunStorage(context: vscode.ExtensionContext) {
  const RUNS_KEY = 'numezis.runs';
  return {
    getRuns: (): RunViewModel[] => context.globalState.get<RunViewModel[]>(RUNS_KEY) ?? [],
    setRuns: (runs: RunViewModel[]) => {
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
export class ChatPanel {
  private readonly state: PanelState;
  private readonly runHandler: RunHandler;
  private readonly settingsHandler: SettingsHandler;
  private readonly llmConfigHandler: LlmConfigHandler;
  private readonly embeddingHandler: EmbeddingHandler;
  private readonly graphHandler: GraphHandler;

  private webview?: vscode.Webview;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly backendClient: BackendClient,
    private readonly treeProvider: AgentTreeProvider
  ) {
    const storage = createRunStorage(context);
    this.state = new PanelState(storage);

    // Initialize handlers
    this.runHandler = new RunHandler(backendClient, this.state, treeProvider);
    this.settingsHandler = new SettingsHandler(backendClient, () => this.syncState());
    this.llmConfigHandler = new LlmConfigHandler(backendClient, this.state);
    this.embeddingHandler = new EmbeddingHandler(backendClient, this.state);
    this.graphHandler = new GraphHandler(backendClient, this.state, treeProvider);

    // Subscribe to state changes
    this.state.onChange((uiState) => {
      this.postMessage({ type: 'state', state: uiState });
    });

    // Populate tree provider with persisted runs
    this.state.getRuns().forEach((run) => {
      const treeRun: AgentRun = { runId: run.runId, prompt: run.prompt, agentId: run.agentId, status: run.status };
      treeProvider.addRun(treeRun);
    });
  }

  /**
   * Set the webview instance and initialize it
   */
  setWebview(webview: vscode.Webview): void {
    this.webview = webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'out')),
      ],
    };

    webview.html = this.getHtmlForWebview(webview);
    webview.onDidReceiveMessage(
      (message: WebviewRequest) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    // Send initial state
    this.syncState();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.state.cancelAllPolls();
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  private async handleMessage(message: WebviewRequest): Promise<void> {
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
          } else {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error: ${errorMessage}`);
      this.postMessage({ type: 'error', message: errorMessage });
    }
  }

  // ============================================================================
  // State Synchronization
  // ============================================================================

  private syncState(): void {
    this.postMessage({ type: 'state', state: this.state.getUiState() });
  }

  private postMessage(message: PanelMessage): void {
    this.webview?.postMessage(message);
  }

  private async loadAllConfigs(): Promise<void> {
    if (!this.backendClient.hasBaseUrl()) return;

    // First check authentication status
    const authResult = await this.backendClient.checkAuth();
    this.state.setAuthState(Boolean(authResult), authResult?.email);

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
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  }

  // ============================================================================
  // Webview HTML
  // ============================================================================

  private getHtmlForWebview(webview: vscode.Webview): string {
    const mediaPath = path.join(this.context.extensionPath, 'media');
    const htmlPath = path.join(mediaPath, 'webview.html');

    // Get URIs for resources
    const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'styles.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'app.js')));
    const nonce = this.getNonce();

    // Read HTML template and replace placeholders
    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf-8');
    } catch {
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

  private getInlineHtmlTemplate(): string {
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

  private getNonce(): string {
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
  async runPrompt(prompt: string, agentId: string): Promise<void> {
    await this.runHandler.startRun(prompt, agentId);
  }

  /**
   * Request to apply diff for a run (used by commands)
   */
  async requestApplyDiff(runId?: string): Promise<void> {
    const targetId = runId || this.state.getSelectedRunId() || this.state.getLastRunId();
    if (!targetId) {
      vscode.window.showErrorMessage('No run selected to apply diff.');
      return;
    }
    await this.runHandler.applyDiff(targetId);
  }

  // ============================================================================
  // Static Factory
  // ============================================================================

  private static instance: ChatPanel | undefined;

  /**
   * Factory method for creating ChatPanel from WebviewView
   */
  static createForView(
    view: vscode.WebviewView,
    extensionUri: vscode.Uri,
    backendClient: BackendClient,
    treeProvider: AgentTreeProvider,
    _onSettingsUpdated: () => void,
    _storage: { getRuns: () => unknown[]; setRuns: (runs: unknown[]) => void }
  ): ChatPanel {
    // Get context from the workspace state - we need to find it
    const context = (globalThis as { numezisContext?: vscode.ExtensionContext }).numezisContext;
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
  static getInstance(): ChatPanel | undefined {
    return ChatPanel.instance;
  }
}
