import { z } from "zod";

// ============================================================================
// Provider-specific configuration schemas
// ============================================================================

export const AzureOpenAIConfigSchema = z.object({
    endpoint: z.string().url().describe("Azure OpenAI endpoint URL"),
    apiKey: z.string().min(1).describe("Azure OpenAI API key"),
    deployment: z.string().min(1).describe("Deployment name"),
    model: z.string().min(1).describe("Model name"),
    apiVersion: z.string().min(1).describe("API version"),
});

export const OpenAIConfigSchema = z.object({
    apiKey: z.string().min(1).describe("OpenAI API key"),
    model: z.string().min(1).describe("Model name (e.g., gpt-4o, gpt-4-turbo)"),
    organization: z.string().optional().describe("OpenAI organization ID (optional)"),
    baseUrl: z.string().url().optional().describe("Custom base URL (optional, for proxies)"),
});

export const ClaudeConfigSchema = z.object({
    apiKey: z.string().min(1).describe("Anthropic API key"),
    model: z.string().min(1).describe("Model name (e.g., claude-sonnet-4-20250514, claude-3-5-sonnet-20241022)"),
});

export const GeminiConfigSchema = z.object({
    apiKey: z.string().min(1).describe("Google AI API key"),
    model: z.string().min(1).describe("Model name (e.g., gemini-2.5-pro, gemini-2.5-flash)"),
});

export const LMStudioModelConfigSchema = z.object({
    contextWindow: z.number().int().positive().optional().describe("Context window size (tokens)"),
    maxTokens: z.number().int().positive().optional().describe("Max output tokens"),
    temperature: z.number().min(0).max(5).optional().describe("Sampling temperature"),
    topP: z.number().min(0).max(1).optional().describe("Nucleus sampling (top-p)"),
    topK: z.number().int().min(0).optional().describe("Top-k sampling"),
    repeatPenalty: z.number().min(0).optional().describe("Repeat penalty"),
    presencePenalty: z.number().min(-2).max(2).optional().describe("Presence penalty"),
    frequencyPenalty: z.number().min(-2).max(2).optional().describe("Frequency penalty"),
});

export const LMStudioConfigSchema = z.object({
    baseUrl: z.string().url().describe("LM Studio base URL"),
    apiKey: z.string().optional().describe("LM Studio API key (optional)"),
    model: z.string().min(1).describe("Model name"),
    modelSettings: z.record(LMStudioModelConfigSchema).optional().describe("Per-model settings"),
});

export const OllamaConfigSchema = z.object({
    baseUrl: z.string().url().describe("Ollama base URL (e.g., http://localhost:11434)"),
    model: z.string().min(1).describe("Model name (e.g., llama3.2, mistral, codellama)"),
});

export const VLLMModelConfigSchema = z.object({
    contextWindow: z.number().int().positive().optional().describe("Context window size (tokens)"),
    maxTokens: z.number().int().positive().optional().describe("Max output tokens"),
    temperature: z.number().min(0).max(5).optional().describe("Sampling temperature"),
    topP: z.number().min(0).max(1).optional().describe("Nucleus sampling (top-p)"),
    topK: z.number().int().min(0).optional().describe("Top-k sampling"),
    repeatPenalty: z.number().min(0).optional().describe("Repeat penalty"),
    presencePenalty: z.number().min(-2).max(2).optional().describe("Presence penalty"),
    frequencyPenalty: z.number().min(-2).max(2).optional().describe("Frequency penalty"),
});

export const VLLMConfigSchema = z.object({
    baseUrl: z.string().url().describe("vLLM server base URL (e.g., http://127.0.0.1:8000)"),
    apiKey: z.string().optional().describe("vLLM API key (optional)"),
    model: z.string().min(1).describe("Model name (HuggingFace model ID)"),
    modelSettings: z.record(VLLMModelConfigSchema).optional().describe("Per-model settings"),
});

// ============================================================================
// Provider types
// ============================================================================

export const LLM_PROVIDERS = ["azure", "openai", "claude", "gemini", "lmstudio", "ollama", "vllm"] as const;
export type LlmProviderType = (typeof LLM_PROVIDERS)[number];

// ============================================================================
// Main LLM config schema
// ============================================================================

export const LlmConfigSchema = z.object({
    _id: z.string().optional(),
    provider: z.enum(LLM_PROVIDERS).describe("Active LLM provider"),
    azure: AzureOpenAIConfigSchema.optional(),
    openai: OpenAIConfigSchema.optional(),
    claude: ClaudeConfigSchema.optional(),
    gemini: GeminiConfigSchema.optional(),
    lmstudio: LMStudioConfigSchema.optional(),
    ollama: OllamaConfigSchema.optional(),
    vllm: VLLMConfigSchema.optional(),
    defaultProvider: z.enum(LLM_PROVIDERS).describe("Default provider to use"),
    enabledProviders: z.array(z.enum(LLM_PROVIDERS)).optional().describe("List of enabled providers (default: all)"),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type AzureOpenAIConfig = z.infer<typeof AzureOpenAIConfigSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export type LMStudioModelConfig = z.infer<typeof LMStudioModelConfigSchema>;
export type LMStudioConfig = z.infer<typeof LMStudioConfigSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;
export type VLLMModelConfig = z.infer<typeof VLLMModelConfigSchema>;
export type VLLMConfig = z.infer<typeof VLLMConfigSchema>;
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

// ============================================================================
// Validation helpers
// ============================================================================

export function validateLlmConfig(data: unknown): LlmConfig {
    return LlmConfigSchema.parse(data);
}

export function validateAzureConfig(data: unknown): AzureOpenAIConfig {
    return AzureOpenAIConfigSchema.parse(data);
}

export function validateOpenAIConfig(data: unknown): OpenAIConfig {
    return OpenAIConfigSchema.parse(data);
}

export function validateClaudeConfig(data: unknown): ClaudeConfig {
    return ClaudeConfigSchema.parse(data);
}

export function validateGeminiConfig(data: unknown): GeminiConfig {
    return GeminiConfigSchema.parse(data);
}

export function validateLMStudioConfig(data: unknown): LMStudioConfig {
    return LMStudioConfigSchema.parse(data);
}

export function validateOllamaConfig(data: unknown): OllamaConfig {
    return OllamaConfigSchema.parse(data);
}

export function validateVLLMConfig(data: unknown): VLLMConfig {
    return VLLMConfigSchema.parse(data);
}

// ============================================================================
// Model recommendations (latest models as of Feb 2026)
// ============================================================================

export const MODEL_RECOMMENDATIONS = {
    azure: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4"],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini", "o1"],
    claude: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-pro"],
    lmstudio: ["local-model"],
    ollama: ["llama3.2", "llama3.1", "mistral", "codellama", "deepseek-coder"],
    vllm: ["nvidia/nemotron-3-nano", "mistralai/Mistral-Small-24B", "Qwen/Qwen3-32B", "deepseek-ai/deepseek-coder-33b", "meta-llama/Llama-3.1-8B-Instruct"],
} as const;
