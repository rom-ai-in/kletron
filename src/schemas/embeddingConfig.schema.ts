import { z } from "zod";

// ============================================
// Embedding Provider Types
// ============================================
export const EMBEDDING_PROVIDERS = ["azure", "openai", "voyage", "gemini", "lmstudio", "ollama"] as const;
export type EmbeddingProviderType = typeof EMBEDDING_PROVIDERS[number];

// ============================================
// Embedding Model Recommendations
// ============================================
export const EMBEDDING_MODEL_RECOMMENDATIONS: Record<EmbeddingProviderType, string[]> = {
    azure: ["text-embedding-3-large", "text-embedding-3-small", "text-embedding-ada-002"],
    openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
    voyage: ["voyage-3", "voyage-3-lite", "voyage-code-3", "voyage-finance-2"],
    gemini: ["text-embedding-004", "embedding-001"],
    lmstudio: ["nomic-embed-text-v1.5", "bge-large-en-v1.5", "all-MiniLM-L6-v2"],
    ollama: ["nomic-embed-text", "mxbai-embed-large", "all-minilm", "snowflake-arctic-embed"],
};

// ============================================
// Provider-Specific Schemas
// ============================================

// Azure OpenAI Embedding Configuration
export const AzureEmbeddingConfigSchema = z.object({
    endpoint: z.string().describe("Azure OpenAI endpoint URL"),
    apiKey: z.string().describe("Azure OpenAI API key"),
    deployment: z.string().describe("Embedding deployment name"),
    model: z.string().default("text-embedding-ada-002").describe("Embedding model name"),
    apiVersion: z.string().default("2024-02-01").describe("API version"),
});

// OpenAI Embedding Configuration
export const OpenAIEmbeddingConfigSchema = z.object({
    apiKey: z.string().describe("OpenAI API key"),
    model: z.string().default("text-embedding-3-small").describe("Embedding model name"),
    dimensions: z.number().int().positive().optional().describe("Output dimensions (optional, model-dependent)"),
    organization: z.string().optional().describe("OpenAI organization ID (optional)"),
});

// Voyage AI Embedding Configuration
export const VoyageEmbeddingConfigSchema = z.object({
    apiKey: z.string().describe("Voyage AI API key"),
    model: z.string().default("voyage-3").describe("Embedding model name"),
    inputType: z.enum(["query", "document"]).optional().describe("Input type for search optimization"),
});

// Google Gemini Embedding Configuration
export const GeminiEmbeddingConfigSchema = z.object({
    apiKey: z.string().describe("Google AI API key"),
    model: z.string().default("text-embedding-004").describe("Embedding model name"),
    taskType: z.enum(["RETRIEVAL_QUERY", "RETRIEVAL_DOCUMENT", "SEMANTIC_SIMILARITY", "CLASSIFICATION", "CLUSTERING"]).optional(),
});

// LM Studio Embedding Configuration
export const LMStudioEmbeddingConfigSchema = z.object({
    baseUrl: z.string().describe("LM Studio base URL"),
    apiKey: z.string().optional().describe("LM Studio API key (optional)"),
    model: z.string().describe("Embedding model name"),
    dimensions: z.number().int().positive().default(1536).describe("Embedding dimensions"),
});

// Ollama Embedding Configuration
export const OllamaEmbeddingConfigSchema = z.object({
    baseUrl: z.string().default("http://127.0.0.1:11434").describe("Ollama server URL"),
    model: z.string().default("nomic-embed-text").describe("Embedding model name"),
});

// ============================================
// Combined Embedding Configuration
// ============================================
export const EmbeddingConfigSchema = z.object({
    _id: z.string().optional(),
    provider: z.enum(EMBEDDING_PROVIDERS).describe("Active embedding provider"),
    azure: AzureEmbeddingConfigSchema.optional(),
    openai: OpenAIEmbeddingConfigSchema.optional(),
    voyage: VoyageEmbeddingConfigSchema.optional(),
    gemini: GeminiEmbeddingConfigSchema.optional(),
    lmstudio: LMStudioEmbeddingConfigSchema.optional(),
    ollama: OllamaEmbeddingConfigSchema.optional(),
    defaultProvider: z.enum(EMBEDDING_PROVIDERS).describe("Default embedding provider"),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// ============================================
// Type Exports
// ============================================
export type AzureEmbeddingConfig = z.infer<typeof AzureEmbeddingConfigSchema>;
export type OpenAIEmbeddingConfig = z.infer<typeof OpenAIEmbeddingConfigSchema>;
export type VoyageEmbeddingConfig = z.infer<typeof VoyageEmbeddingConfigSchema>;
export type GeminiEmbeddingConfig = z.infer<typeof GeminiEmbeddingConfigSchema>;
export type LMStudioEmbeddingConfig = z.infer<typeof LMStudioEmbeddingConfigSchema>;
export type OllamaEmbeddingConfig = z.infer<typeof OllamaEmbeddingConfigSchema>;
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ============================================
// Validation Helpers
// ============================================
export function validateEmbeddingConfig(data: unknown): EmbeddingConfig {
    return EmbeddingConfigSchema.parse(data);
}

export function validateAzureEmbeddingConfig(data: unknown): AzureEmbeddingConfig {
    return AzureEmbeddingConfigSchema.parse(data);
}

export function validateOpenAIEmbeddingConfig(data: unknown): OpenAIEmbeddingConfig {
    return OpenAIEmbeddingConfigSchema.parse(data);
}

export function validateVoyageEmbeddingConfig(data: unknown): VoyageEmbeddingConfig {
    return VoyageEmbeddingConfigSchema.parse(data);
}

export function validateGeminiEmbeddingConfig(data: unknown): GeminiEmbeddingConfig {
    return GeminiEmbeddingConfigSchema.parse(data);
}

export function validateLMStudioEmbeddingConfig(data: unknown): LMStudioEmbeddingConfig {
    return LMStudioEmbeddingConfigSchema.parse(data);
}

export function validateOllamaEmbeddingConfig(data: unknown): OllamaEmbeddingConfig {
    return OllamaEmbeddingConfigSchema.parse(data);
}
