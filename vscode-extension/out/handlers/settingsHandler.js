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
exports.SettingsHandler = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Handles VS Code settings synchronization
 */
class SettingsHandler {
    constructor(backendClient, onSettingsUpdated) {
        this.backendClient = backendClient;
        this.onSettingsUpdated = onSettingsUpdated;
    }
    /**
     * Get current settings from VS Code configuration
     */
    getSettings() {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            backendUrl: config.get('backendUrl', ''),
            apiToken: config.get('apiToken', ''),
            llm: this.getLlmSettings(),
            defaultGraphId: config.get('defaultGraphId', ''),
            inlineEnabled: config.get('inline.enabled', false),
        };
    }
    /**
     * Get LLM-specific settings
     */
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
    /**
     * Update all settings in VS Code configuration
     */
    async updateSettings(settings) {
        var _a, _b, _c, _d, _e, _f;
        const config = vscode.workspace.getConfiguration('numezis');
        const target = vscode.ConfigurationTarget.Global;
        // Batch update all settings
        await Promise.all([
            config.update('backendUrl', settings.backendUrl, target),
            config.update('apiToken', settings.apiToken, target),
            config.update('llm.provider', (_a = settings.llm.provider) !== null && _a !== void 0 ? _a : '', target),
            config.update('llm.baseUrl', (_b = settings.llm.baseUrl) !== null && _b !== void 0 ? _b : '', target),
            config.update('llm.model', (_c = settings.llm.model) !== null && _c !== void 0 ? _c : '', target),
            config.update('llm.apiKey', (_d = settings.llm.apiKey) !== null && _d !== void 0 ? _d : '', target),
            config.update('llm.temperature', (_e = settings.llm.temperature) !== null && _e !== void 0 ? _e : 0, target),
            config.update('llm.maxTokens', (_f = settings.llm.maxTokens) !== null && _f !== void 0 ? _f : 0, target),
            typeof settings.defaultGraphId === 'string'
                ? config.update('defaultGraphId', settings.defaultGraphId, target)
                : Promise.resolve(),
            typeof settings.inlineEnabled === 'boolean'
                ? config.update('inline.enabled', settings.inlineEnabled, target)
                : Promise.resolve(),
        ]);
        // Update backend client
        if (settings.backendUrl) {
            this.backendClient.setBaseUrl(settings.backendUrl);
        }
        if (settings.apiToken) {
            this.backendClient.setToken(settings.apiToken);
        }
        this.onSettingsUpdated();
    }
}
exports.SettingsHandler = SettingsHandler;
