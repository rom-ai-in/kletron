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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const backendClient_1 = require("./utils/backendClient");
const AgentTreeProvider_1 = require("./tree/AgentTreeProvider");
const NumezisViewProvider_1 = require("./views/NumezisViewProvider");
const auth_1 = require("./commands/auth");
function activate(context) {
    // Store context for ChatPanel static factory
    globalThis.numezisContext = context;
    const backendClient = new backendClient_1.BackendClient();
    const treeProvider = new AgentTreeProvider_1.AgentTreeProvider();
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    const configuration = vscode.workspace.getConfiguration('numezis');
    const savedUrl = configuration.get('backendUrl', '');
    const savedToken = configuration.get('apiToken', '');
    if (savedUrl) {
        backendClient.setBaseUrl(savedUrl);
    }
    if (savedToken) {
        backendClient.setToken(savedToken);
    }
    let authState = { isAuthenticated: false };
    const refreshStatusBar = () => {
        if (authState.isAuthenticated && authState.user) {
            statusBar.text = `$(account) ${authState.user.email}`;
            statusBar.tooltip = `Signed in as ${authState.user.email}\n${authState.tokenLabel || 'VS Code Extension'}`;
            statusBar.command = 'numezis.logout';
        }
        else if (backendClient.hasBaseUrl()) {
            statusBar.text = `$(plug) Numezis`;
            statusBar.tooltip = `Connected to ${backendClient.getBaseUrl()} (not signed in)`;
            statusBar.command = 'numezis.login';
        }
        else {
            statusBar.text = '$(plug) Numezis';
            statusBar.tooltip = 'Click to sign in';
            statusBar.command = 'numezis.login';
        }
    };
    refreshStatusBar();
    statusBar.show();
    context.subscriptions.push(statusBar);
    // Register auth commands
    (0, auth_1.registerAuthCommands)(context, backendClient, configuration, (newState) => {
        authState = newState;
        refreshStatusBar();
    });
    // Auto-validate token on startup
    if (savedToken) {
        vscode.commands.executeCommand('numezis.validateToken');
    }
    const storage = {
        getRuns: () => context.globalState.get('numezis.runs', []),
        setRuns: (runs) => {
            void context.globalState.update('numezis.runs', runs);
        },
    };
    const persistedRuns = storage.getRuns();
    if (persistedRuns.length) {
        treeProvider.setRuns(persistedRuns.map((run) => ({
            agentId: run.agentId,
            prompt: run.prompt,
            runId: run.runId,
            status: run.status,
        })));
    }
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('numezis.chatView', new NumezisViewProvider_1.NumezisViewProvider(context.extensionUri, backendClient, treeProvider, () => {
        const latestConfig = vscode.workspace.getConfiguration('numezis');
        const url = latestConfig.get('backendUrl', '');
        const token = latestConfig.get('apiToken', '');
        if (url) {
            backendClient.setBaseUrl(url);
        }
        if (token) {
            backendClient.setToken(token);
        }
        refreshStatusBar();
    }, storage)));
    // All UX is now available directly inside the sidebar webview.
}
exports.activate = activate;
function deactivate() {
    globalThis.numezisContext = undefined;
}
exports.deactivate = deactivate;
