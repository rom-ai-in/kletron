"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingHandler = void 0;
/**
 * Handles embedding configuration operations
 */
class EmbeddingHandler {
    constructor(backendClient, state) {
        this.backendClient = backendClient;
        this.state = state;
    }
    /**
     * Load embedding configuration from backend
     */
    async loadConfig() {
        const config = await this.backendClient.getEmbeddingConfig();
        this.state.setEmbeddingConfig(config);
        return config;
    }
    /**
     * Set the active embedding provider
     */
    async setProvider(provider) {
        const config = await this.backendClient.setEmbeddingProvider(provider);
        this.state.setEmbeddingConfig(config);
        return config;
    }
    /**
     * Save Azure embedding configuration
     */
    async saveAzure(configJson) {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveEmbeddingAzure(payload);
        this.state.setEmbeddingConfig(config);
        return config;
    }
    /**
     * Save LM Studio embedding configuration
     */
    async saveLmstudio(configJson) {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveEmbeddingLmstudio(payload);
        this.state.setEmbeddingConfig(config);
        return config;
    }
    /**
     * Reset embedding configuration
     */
    async reset() {
        const config = await this.backendClient.resetEmbedding();
        this.state.setEmbeddingConfig(config);
        return config;
    }
}
exports.EmbeddingHandler = EmbeddingHandler;
