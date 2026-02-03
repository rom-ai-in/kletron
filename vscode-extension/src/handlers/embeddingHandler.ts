import type { BackendClient } from '../utils/backendClient';
import type { PanelState } from '../state/panelState';
import type { EmbeddingConfig } from '../types/api';

/**
 * Handles embedding configuration operations
 */
export class EmbeddingHandler {
    constructor(
        private readonly backendClient: BackendClient,
        private readonly state: PanelState
    ) { }

    /**
     * Load embedding configuration from backend
     */
    async loadConfig(): Promise<EmbeddingConfig> {
        const config = await this.backendClient.getEmbeddingConfig();
        this.state.setEmbeddingConfig(config);
        return config;
    }

    /**
     * Set the active embedding provider
     */
    async setProvider(provider: string): Promise<EmbeddingConfig> {
        const config = await this.backendClient.setEmbeddingProvider(provider);
        this.state.setEmbeddingConfig(config);
        return config;
    }

    /**
     * Save Azure embedding configuration
     */
    async saveAzure(configJson: string): Promise<EmbeddingConfig> {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveEmbeddingAzure(payload);
        this.state.setEmbeddingConfig(config);
        return config;
    }

    /**
     * Save LM Studio embedding configuration
     */
    async saveLmstudio(configJson: string): Promise<EmbeddingConfig> {
        const payload = configJson ? JSON.parse(configJson) : {};
        const config = await this.backendClient.saveEmbeddingLmstudio(payload);
        this.state.setEmbeddingConfig(config);
        return config;
    }

    /**
     * Reset embedding configuration
     */
    async reset(): Promise<EmbeddingConfig> {
        const config = await this.backendClient.resetEmbedding();
        this.state.setEmbeddingConfig(config);
        return config;
    }
}
