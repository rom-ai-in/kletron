import { z } from "zod";

// Azure OpenAI Embedding Configuration
export const AzureEmbeddingConfigSchema = z.object({
    endpoint: z.string().url().describe("Azure OpenAI endpoint URL"),
    apiKey: z.string().min(1).describe("Azure OpenAI API key"),
    deployment: z.string().min(1).describe("Embedding deployment name"),
    model: z.string().min(1).default("text-embedding-ada-002").describe("Embedding model name"),
    apiVersion: z.string().min(1).default("2024-02-01").describe("API version"),
});

// LM Studio Embedding Configuration
export const LMStudioEmbeddingConfigSchema = z.object({
    baseUrl: z.string().url().describe("LM Studio base URL"),
    apiKey: z.string().optional().describe("LM Studio API key (optional)"),
    model: z.string().min(1).describe("Embedding model name"),
    dimensions: z.number().int().positive().default(1536).describe("Embedding dimensions"),
});

// Combined Embedding Configuration
export const EmbeddingConfigSchema = z.object({
    _id: z.string().optional(),
    provider: z.enum(["azure", "lmstudio"]).describe("Embedding provider type"),
    azure: AzureEmbeddingConfigSchema.optional(),
    lmstudio: LMStudioEmbeddingConfigSchema.optional(),
    defaultProvider: z.enum(["azure", "lmstudio"]).describe("Default embedding provider"),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export type AzureEmbeddingConfig = z.infer<typeof AzureEmbeddingConfigSchema>;
export type LMStudioEmbeddingConfig = z.infer<typeof LMStudioEmbeddingConfigSchema>;
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// Validation helpers
export function validateEmbeddingConfig(data: unknown): EmbeddingConfig {
    return EmbeddingConfigSchema.parse(data);
}

export function validateAzureEmbeddingConfig(data: unknown): AzureEmbeddingConfig {
    return AzureEmbeddingConfigSchema.parse(data);
}

export function validateLMStudioEmbeddingConfig(data: unknown): LMStudioEmbeddingConfig {
    return LMStudioEmbeddingConfigSchema.parse(data);
}
