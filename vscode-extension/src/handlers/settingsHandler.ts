import * as vscode from 'vscode';
import type { BackendClient, LlmSettings } from '../utils/backendClient';
import type { SettingsPayload } from '../state/panelState';

/**
 * Handles VS Code settings synchronization
 */
export class SettingsHandler {
    constructor(
        private readonly backendClient: BackendClient,
        private readonly onSettingsUpdated: () => void
    ) { }

    /**
     * Get current settings from VS Code configuration
     */
    getSettings(): SettingsPayload {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            backendUrl: config.get<string>('backendUrl', ''),
            apiToken: config.get<string>('apiToken', ''),
            llm: this.getLlmSettings(),
            defaultGraphId: config.get<string>('defaultGraphId', ''),
            inlineEnabled: config.get<boolean>('inline.enabled', false),
        };
    }

    /**
     * Get LLM-specific settings
     */
    getLlmSettings(): LlmSettings {
        const config = vscode.workspace.getConfiguration('numezis');
        return {
            provider: config.get<string>('llm.provider', 'openai'),
            baseUrl: config.get<string>('llm.baseUrl', ''),
            model: config.get<string>('llm.model', 'gpt-4o-mini'),
            apiKey: config.get<string>('llm.apiKey', ''),
            temperature: config.get<number>('llm.temperature', 0.2),
            maxTokens: config.get<number>('llm.maxTokens', 0),
        };
    }

    /**
     * Update all settings in VS Code configuration
     */
    async updateSettings(settings: SettingsPayload): Promise<void> {
        const config = vscode.workspace.getConfiguration('numezis');
        const target = vscode.ConfigurationTarget.Global;

        // Batch update all settings
        await Promise.all([
            config.update('backendUrl', settings.backendUrl, target),
            config.update('apiToken', settings.apiToken, target),
            config.update('llm.provider', settings.llm.provider ?? '', target),
            config.update('llm.baseUrl', settings.llm.baseUrl ?? '', target),
            config.update('llm.model', settings.llm.model ?? '', target),
            config.update('llm.apiKey', settings.llm.apiKey ?? '', target),
            config.update('llm.temperature', settings.llm.temperature ?? 0, target),
            config.update('llm.maxTokens', settings.llm.maxTokens ?? 0, target),
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
