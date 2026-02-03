"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmConfigHandler = void 0;
/**
 * Handles LLM configuration operations
 */
class LlmConfigHandler {
    constructor(backendClient, state) {
        this.backendClient = backendClient;
        this.state = state;
    }
    /**
     * Load LLM configuration from backend and update state
     */
    async loadConfig() {
        const config = await this.backendClient.getLlmConfig();
        this.state.setLlmConfig(config);
        return config;
    }
    /**
     * Set the active LLM provider
     */
    async setProvider(provider) {
        const config = await this.backendClient.setLlmProvider(provider);
        this.state.setLlmConfig(config);
        return config;
    }
    /**
     * Save Azure LLM configuration
     */
    async saveAzure(configJson) {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveLlmAzure(payload);
        this.state.setLlmConfig(config);
        return config;
    }
    /**
     * Save LM Studio configuration
     */
    async saveLmstudio(configJson) {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveLlmLmstudio(payload);
        this.state.setLlmConfig(config);
        return config;
    }
    /**
     * Reset LLM configuration to environment defaults
     */
    async reset() {
        const config = await this.backendClient.resetLlm();
        this.state.setLlmConfig(config);
        return config;
    }
    /**
     * Test LLM configuration
     */
    async test(provider, config) {
        return this.backendClient.testLlmConfig(provider, config);
    }
}
exports.LlmConfigHandler = LlmConfigHandler;
