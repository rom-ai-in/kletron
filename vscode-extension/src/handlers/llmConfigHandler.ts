import type { BackendClient } from '../utils/backendClient';
import type { PanelState } from '../state/panelState';
import type { LlmConfig } from '../types/api';

/**
 * Handles LLM configuration operations
 */
export class LlmConfigHandler {
    constructor(
        private readonly backendClient: BackendClient,
        private readonly state: PanelState
    ) { }

    /**
     * Load LLM configuration from backend and update state
     */
    async loadConfig(): Promise<LlmConfig> {
        const config = await this.backendClient.getLlmConfig();
        this.state.setLlmConfig(config);
        return config;
    }

    /**
     * Set the active LLM provider
     */
    async setProvider(provider: string): Promise<LlmConfig> {
        const config = await this.backendClient.setLlmProvider(provider);
        this.state.setLlmConfig(config);
        return config;
    }

    /**
     * Save Azure LLM configuration
     */
    async saveAzure(configJson: string): Promise<LlmConfig> {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveLlmAzure(payload);
        this.state.setLlmConfig(config);
        return config;
    }

    /**
     * Save LM Studio configuration
     */
    async saveLmstudio(configJson: string): Promise<LlmConfig> {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveLlmLmstudio(payload);
        this.state.setLlmConfig(config);
        return config;
    }

    /**
     * Reset LLM configuration to environment defaults
     */
    async reset(): Promise<LlmConfig> {
        const config = await this.backendClient.resetLlm();
        this.state.setLlmConfig(config);
        return config;
    }

    /**
     * Test LLM configuration
     */
    async test(provider: string, config: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
        return this.backendClient.testLlmConfig(provider, config);
    }
}
