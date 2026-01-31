"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumezisViewProvider = void 0;
const ChatPanel_1 = require("../panels/ChatPanel");
class NumezisViewProvider {
    constructor(extensionUri, backendClient, treeProvider, onSettingsUpdated, storage) {
        this.extensionUri = extensionUri;
        this.backendClient = backendClient;
        this.treeProvider = treeProvider;
        this.onSettingsUpdated = onSettingsUpdated;
        this.storage = storage;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.title = 'Studio';
        webviewView.description = 'Numezis';
        ChatPanel_1.ChatPanel.createForView(webviewView, this.extensionUri, this.backendClient, this.treeProvider, this.onSettingsUpdated, this.storage);
    }
}
exports.NumezisViewProvider = NumezisViewProvider;
