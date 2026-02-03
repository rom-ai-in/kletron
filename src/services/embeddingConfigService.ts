import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import {
    EmbeddingConfig,
    AzureEmbeddingConfig,
    OpenAIEmbeddingConfig,
    VoyageEmbeddingConfig,
    GeminiEmbeddingConfig,
    LMStudioEmbeddingConfig,
    OllamaEmbeddingConfig,
    validateEmbeddingConfig,
    AzureEmbeddingConfigSchema,
    OpenAIEmbeddingConfigSchema,
    VoyageEmbeddingConfigSchema,
    GeminiEmbeddingConfigSchema,
    LMStudioEmbeddingConfigSchema,
    OllamaEmbeddingConfigSchema,
    EmbeddingProviderType,
    EMBEDDING_PROVIDERS,
} from "../schemas/embeddingConfig.schema";
import { config } from "../config";

const COLLECTION_NAME = "embedding_configs";

async function getCollection(): Promise<Collection<EmbeddingConfig>> {
    const db = await getDatabase();
    return db.collection<EmbeddingConfig>(COLLECTION_NAME);
}

/**
 * Get the current embedding configuration from MongoDB
 * Falls back to environment variables if no config exists in DB
 */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
    try {
        const collection = await getCollection();
        const storedConfig = await collection.findOne({});

        if (storedConfig) {
            return storedConfig;
        }

        return getEnvBasedConfig();
    } catch (error) {
        console.warn("Failed to fetch embedding config from MongoDB, using env fallback:", error);
        return getEnvBasedConfig();
    }
}

/**
 * Determine the default embedding provider based on available environment configs
 */
function getDefaultEmbeddingProvider(): EmbeddingProviderType {
    // Check in order of priority
    if (config.azure?.endpoint && config.azure?.embeddingDeployment) return "azure";
    if (config.openai?.apiKey) return "openai";
    if (process.env.VOYAGE_API_KEY) return "voyage";
    if (config.gemini?.apiKey) return "gemini";
    if (config.ollama?.baseUrl) return "ollama";
    if (config.lmstudio?.baseUrl) return "lmstudio";
    return "openai"; // Default fallback
}

/**
 * Create configuration from environment variables
 */
function getEnvBasedConfig(): EmbeddingConfig {
    const defaultProvider = getDefaultEmbeddingProvider();

    return {
        provider: defaultProvider,
        defaultProvider,
        azure: config.azure?.endpoint ? {
            endpoint: config.azure.endpoint,
            apiKey: config.azure.apiKey ?? "",
            deployment: config.azure.embeddingDeployment ?? "",
            model: config.azure.embeddingModel ?? "text-embedding-ada-002",
            apiVersion: config.azure.apiVersion ?? "2024-02-01",
        } : undefined,
        openai: config.openai?.apiKey ? {
            apiKey: config.openai.apiKey,
            model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
            organization: config.openai.organization,
        } : undefined,
        voyage: process.env.VOYAGE_API_KEY ? {
            apiKey: process.env.VOYAGE_API_KEY,
            model: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-3",
        } : undefined,
        gemini: config.gemini?.apiKey ? {
            apiKey: config.gemini.apiKey,
            model: process.env.GOOGLE_EMBEDDING_MODEL ?? "text-embedding-004",
        } : undefined,
        lmstudio: config.lmstudio?.baseUrl ? {
            baseUrl: config.lmstudio.baseUrl,
            apiKey: config.lmstudio.apiKey,
            model: process.env.LMSTUDIO_EMBEDDING_MODEL ?? "nomic-embed-text",
            dimensions: 1536,
        } : undefined,
        ollama: {
            baseUrl: config.ollama?.baseUrl ?? "http://127.0.0.1:11434",
            model: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
        },
    };
}

// ============================================
// Helper: Preserve API keys during updates
// ============================================
function preserveApiKey(
    newKey: string | undefined,
    existingKey: string | undefined,
    keyName: string
): string {
    if (!newKey || newKey.trim() === "" || newKey.includes("•")) {
        if (existingKey && !existingKey.includes("•")) {
            return existingKey;
        }
        if (newKey?.includes("•")) {
            throw new Error(`Cannot save masked ${keyName}. Please enter the actual API key.`);
        }
    }
    return newKey ?? "";
}

// ============================================
// Provider Update Functions
// ============================================

export async function updateAzureEmbeddingConfig(
    azureConfig: AzureEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const configToSave = {
        ...azureConfig,
        apiKey: preserveApiKey(azureConfig.apiKey, currentConfig.azure?.apiKey, "Azure API key"),
    };

    const validated = AzureEmbeddingConfigSchema.parse(configToSave);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "azure",
        azure: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

export async function updateOpenAIEmbeddingConfig(
    openaiConfig: OpenAIEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const configToSave = {
        ...openaiConfig,
        apiKey: preserveApiKey(openaiConfig.apiKey, currentConfig.openai?.apiKey, "OpenAI API key"),
    };

    const validated = OpenAIEmbeddingConfigSchema.parse(configToSave);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "openai",
        openai: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

export async function updateVoyageEmbeddingConfig(
    voyageConfig: VoyageEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const configToSave = {
        ...voyageConfig,
        apiKey: preserveApiKey(voyageConfig.apiKey, currentConfig.voyage?.apiKey, "Voyage API key"),
    };

    const validated = VoyageEmbeddingConfigSchema.parse(configToSave);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "voyage",
        voyage: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

export async function updateGeminiEmbeddingConfig(
    geminiConfig: GeminiEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const configToSave = {
        ...geminiConfig,
        apiKey: preserveApiKey(geminiConfig.apiKey, currentConfig.gemini?.apiKey, "Gemini API key"),
    };

    const validated = GeminiEmbeddingConfigSchema.parse(configToSave);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "gemini",
        gemini: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

export async function updateLMStudioEmbeddingConfig(
    lmstudioConfig: LMStudioEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const configToSave = {
        ...lmstudioConfig,
        apiKey: lmstudioConfig.apiKey
            ? preserveApiKey(lmstudioConfig.apiKey, currentConfig.lmstudio?.apiKey, "LM Studio API key")
            : undefined,
    };

    const validated = LMStudioEmbeddingConfigSchema.parse(configToSave);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "lmstudio",
        lmstudio: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

export async function updateOllamaEmbeddingConfig(
    ollamaConfig: OllamaEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const validated = OllamaEmbeddingConfigSchema.parse(ollamaConfig);
    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "ollama",
        ollama: validated,
        updatedAt: new Date(),
    };

    return await saveConfig(collection, currentConfig, updatedConfig);
}

// ============================================
// Update Default Provider
// ============================================

export async function updateDefaultEmbeddingProvider(
    provider: EmbeddingProviderType
): Promise<EmbeddingConfig> {
    if (!EMBEDDING_PROVIDERS.includes(provider)) {
        throw new Error(`Invalid provider: ${provider}. Must be one of: ${EMBEDDING_PROVIDERS.join(", ")}`);
    }

    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();
    const envConfig = getEnvBasedConfig();

    // Fix ObjectId vs String mismatch for Zod validation
    const safeCurrentConfig = { ...currentConfig };
    if (safeCurrentConfig._id && typeof safeCurrentConfig._id !== 'string') {
        safeCurrentConfig._id = (safeCurrentConfig._id as any).toString();
    }

    const updatedConfig: EmbeddingConfig = {
        ...safeCurrentConfig,
        provider,
        defaultProvider: provider,
        updatedAt: new Date(),
    };

    // Ensure the selected provider has at least default config
    if (!updatedConfig[provider]) {
        (updatedConfig as any)[provider] = envConfig[provider];
    }

    const validatedConfig = validateEmbeddingConfig(updatedConfig);
    return await saveConfig(collection, currentConfig, validatedConfig);
}

// ============================================
// Reset to Environment Config
// ============================================

export async function resetEmbeddingToEnvConfig(): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    await collection.deleteMany({});
    return getEnvBasedConfig();
}

// ============================================
// Helper: Save Config to MongoDB
// ============================================

async function saveConfig(
    collection: Collection<EmbeddingConfig>,
    currentConfig: EmbeddingConfig,
    updatedConfig: EmbeddingConfig
): Promise<EmbeddingConfig> {
    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            { $set: updatedConfig }
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
