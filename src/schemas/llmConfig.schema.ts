import { z } from "zod";

export const AzureOpenAIConfigSchema = z.object({
    endpoint: z.string().url().describe("Azure OpenAI endpoint URL"),
    apiKey: z.string().min(1).describe("Azure OpenAI API key"),
    deployment: z.string().min(1).describe("Deployment name"),
    model: z.string().min(1).describe("Model name"),
    apiVersion: z.string().min(1).describe("API version"),
});

export const LMStudioConfigSchema = z.object({
    baseUrl: z.string().url().describe("LM Studio base URL"),
    apiKey: z.string().optional().describe("LM Studio API key (optional)"),
    model: z.string().min(1).describe("Model name"),
});

export const LlmConfigSchema = z.object({
    _id: z.string().optional(),
    provider: z.enum(["azure", "lmstudio"]).describe("LLM provider type"),
    azure: AzureOpenAIConfigSchema.optional(),
    lmstudio: LMStudioConfigSchema.optional(),
    defaultProvider: z.enum(["azure", "lmstudio"]).describe("Default provider to use"),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export type AzureOpenAIConfig = z.infer<typeof AzureOpenAIConfigSchema>;
export type LMStudioConfig = z.infer<typeof LMStudioConfigSchema>;
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

// Validation helpers
export function validateLlmConfig(data: unknown): LlmConfig {
    return LlmConfigSchema.parse(data);
}

export function validateAzureConfig(data: unknown): AzureOpenAIConfig {
    return AzureOpenAIConfigSchema.parse(data);
}

export function validateLMStudioConfig(data: unknown): LMStudioConfig {
    return LMStudioConfigSchema.parse(data);
}
