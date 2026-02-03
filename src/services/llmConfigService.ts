import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./mongoClient";
import {
    LlmConfig,
    AzureOpenAIConfig,
    OpenAIConfig,
    ClaudeConfig,
    GeminiConfig,
    LMStudioConfig,
    OllamaConfig,
    LlmProviderType,
    validateLlmConfig,
    AzureOpenAIConfigSchema,
    OpenAIConfigSchema,
    ClaudeConfigSchema,
    GeminiConfigSchema,
    LMStudioConfigSchema,
    OllamaConfigSchema,
} from "../schemas/llmConfig.schema";
import { config } from "../config";

const COLLECTION_NAME = "llm_configs";

async function getCollection(): Promise<Collection<LlmConfig>> {
    const db = await getDatabase();
    return db.collection<LlmConfig>(COLLECTION_NAME);
}

/**
 * Get the current LLM configuration from MongoDB
 * Falls back to environment variables if no config exists in DB
 */
export async function getLlmConfig(): Promise<LlmConfig> {
    try {
        const collection = await getCollection();
        const storedConfig = await collection.findOne({});

        if (storedConfig) {
            return {
                ...storedConfig,
                _id: storedConfig._id.toString(),
            };
        }

        // Fallback to environment variables
        return getEnvBasedConfig();
    } catch (error) {
        console.warn("Failed to fetch LLM config from MongoDB, using env fallback:", error);
        return getEnvBasedConfig();
    }
}

/**
 * Create configuration from environment variables
 */
function getEnvBasedConfig(): LlmConfig {
    return {
        provider: config.defaultProvider as LlmProviderType,
        azure: config.azure.endpoint
            ? {
                endpoint: config.azure.endpoint,
                apiKey: config.azure.apiKey ?? "",
                deployment: config.azure.deployment ?? "",
                model: config.azure.model,
                apiVersion: config.azure.apiVersion,
            }
            : undefined,
        openai: config.openai?.apiKey
            ? {
                apiKey: config.openai.apiKey,
                model: config.openai.model,
                organization: config.openai.organization,
            }
            : undefined,
        claude: config.claude?.apiKey
            ? {
                apiKey: config.claude.apiKey,
                model: config.claude.model,
            }
            : undefined,
        gemini: config.gemini?.apiKey
            ? {
                apiKey: config.gemini.apiKey,
                model: config.gemini.model,
            }
            : undefined,
        lmstudio: {
            baseUrl: config.lmstudio.baseUrl,
            apiKey: config.lmstudio.apiKey,
            model: config.lmstudio.model,
        },
        ollama: config.ollama?.baseUrl
            ? {
                baseUrl: config.ollama.baseUrl,
                model: config.ollama.model,
            }
            : undefined,
        defaultProvider: config.defaultProvider as LlmProviderType,
    };
}

/**
 * Helper to preserve API key if the incoming value is masked or empty
 */
function preserveApiKey(
    newKey: string | undefined,
    existingKey: string | undefined
): string | undefined {
    if (!newKey || newKey.trim() === "" || newKey.includes("•")) {
        if (existingKey && !existingKey.includes("•")) {
            return existingKey;
        }
        if (newKey?.includes("•")) {
            throw new Error("Cannot save masked API key. Please enter the actual API key.");
        }
        return newKey;
    }
    return newKey;
}

/**
 * Generic update config helper
 */
async function updateProviderConfig<T>(
    providerKey: keyof LlmConfig,
    configToSave: T,
    schema: { parse: (data: unknown) => T }
): Promise<LlmConfig> {
    const collection = await getCollection();
    const currentConfig = await getLlmConfig();

    const validatedConfig = schema.parse(configToSave);

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        [providerKey]: validatedConfig,
        updatedAt: new Date(),
    };

    if (currentConfig._id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...configWithoutId } = updatedConfig;

        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            { $set: configWithoutId }
        );
    } else {
        const result = await collection.insertOne({
            ...updatedConfig,
            createdAt: new Date(),
        });
        updatedConfig._id = result.insertedId.toString();
    }

    return updatedConfig;
}

/**
 * Update Azure OpenAI configuration
 */
export async function updateAzureConfig(
    azureConfig: AzureOpenAIConfig
): Promise<LlmConfig> {
    const currentConfig = await getLlmConfig();
    const configToSave = {
        ...azureConfig,
        apiKey: preserveApiKey(azureConfig.apiKey, currentConfig.azure?.apiKey) ?? "",
    };
    return updateProviderConfig("azure", configToSave, AzureOpenAIConfigSchema);
}

/**
 * Update OpenAI configuration
 */
export async function updateOpenAIConfig(
    openaiConfig: OpenAIConfig
): Promise<LlmConfig> {
    const currentConfig = await getLlmConfig();
    const configToSave = {
        ...openaiConfig,
        apiKey: preserveApiKey(openaiConfig.apiKey, currentConfig.openai?.apiKey) ?? "",
    };
    return updateProviderConfig("openai", configToSave, OpenAIConfigSchema);
}

/**
 * Update Claude (Anthropic) configuration
 */
export async function updateClaudeConfig(
    claudeConfig: ClaudeConfig
): Promise<LlmConfig> {
    const currentConfig = await getLlmConfig();
    const configToSave = {
        ...claudeConfig,
        apiKey: preserveApiKey(claudeConfig.apiKey, currentConfig.claude?.apiKey) ?? "",
    };
    return updateProviderConfig("claude", configToSave, ClaudeConfigSchema);
}

/**
 * Update Gemini configuration
 */
export async function updateGeminiConfig(
    geminiConfig: GeminiConfig
): Promise<LlmConfig> {
    const currentConfig = await getLlmConfig();
    const configToSave = {
        ...geminiConfig,
        apiKey: preserveApiKey(geminiConfig.apiKey, currentConfig.gemini?.apiKey) ?? "",
    };
    return updateProviderConfig("gemini", configToSave, GeminiConfigSchema);
}

/**
 * Update LM Studio configuration
 */
export async function updateLMStudioConfig(
    lmstudioConfig: LMStudioConfig
): Promise<LlmConfig> {
    const currentConfig = await getLlmConfig();
    const configToSave = {
        ...lmstudioConfig,
        apiKey: preserveApiKey(lmstudioConfig.apiKey, currentConfig.lmstudio?.apiKey),
    };
    return updateProviderConfig("lmstudio", configToSave, LMStudioConfigSchema);
}

/**
 * Update Ollama configuration
 */
export async function updateOllamaConfig(
    ollamaConfig: OllamaConfig
): Promise<LlmConfig> {
    return updateProviderConfig("ollama", ollamaConfig, OllamaConfigSchema);
}

/**
 * Update the default provider
 */
export async function updateDefaultProvider(
    provider: LlmProviderType
): Promise<LlmConfig> {
    const collection = await getCollection();
    const currentConfig = await getLlmConfig();

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        provider,
        defaultProvider: provider,
        updatedAt: new Date(),
    };

    const validatedConfig = validateLlmConfig(updatedConfig);

    if (currentConfig._id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...configWithoutId } = validatedConfig;

        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            { $set: configWithoutId }
        );
    } else {
        const result = await collection.insertOne({
            ...validatedConfig,
            createdAt: new Date(),
        });
        validatedConfig._id = result.insertedId.toString();
    }

    return validatedConfig;
}

/**
 * Reset configuration to environment variables
 */
export async function resetToEnvConfig(): Promise<LlmConfig> {
    const collection = await getCollection();
    await collection.deleteMany({});
    return getEnvBasedConfig();
}
