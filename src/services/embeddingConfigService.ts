import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./mongoClient";
import {
    EmbeddingConfig,
    AzureEmbeddingConfig,
    LMStudioEmbeddingConfig,
    validateEmbeddingConfig,
    AzureEmbeddingConfigSchema,
    LMStudioEmbeddingConfigSchema,
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

        // Fallback to environment variables (use same as LLM config)
        return getEnvBasedConfig();
    } catch (error) {
        console.warn("Failed to fetch embedding config from MongoDB, using env fallback:", error);
        return getEnvBasedConfig();
    }
}

/**
 * Create configuration from environment variables
 * Uses same Azure credentials as LLM config by default
 */
function getEnvBasedConfig(): EmbeddingConfig {
    return {
        provider: (config.defaultProvider as "azure" | "lmstudio") ?? "azure",
        azure: config.azure.endpoint
            ? {
                endpoint: config.azure.endpoint,
                apiKey: config.azure.apiKey ?? "",
                deployment: process.env.AZURE_EMBEDDING_DEPLOYMENT ?? config.azure.deployment ?? "",
                model: process.env.AZURE_EMBEDDING_MODEL ?? "text-embedding-ada-002",
                apiVersion: config.azure.apiVersion ?? "2024-02-01",
            }
            : undefined,
        lmstudio: {
            baseUrl: config.lmstudio.baseUrl,
            apiKey: config.lmstudio.apiKey,
            model: process.env.LMSTUDIO_EMBEDDING_MODEL ?? "nomic-embed-text",
            dimensions: 1536,
        },
        defaultProvider: (config.defaultProvider as "azure" | "lmstudio") ?? "azure",
    };
}

/**
 * Update Azure embedding configuration
 */
export async function updateAzureEmbeddingConfig(
    azureConfig: AzureEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    // If API key is empty or masked, try to preserve the existing one
    let configToSave = { ...azureConfig };
    if (!configToSave.apiKey || configToSave.apiKey.trim() === "" || configToSave.apiKey.includes("•")) {
        if (currentConfig.azure?.apiKey && !currentConfig.azure.apiKey.includes("•")) {
            configToSave.apiKey = currentConfig.azure.apiKey;
        } else {
            if (configToSave.apiKey?.includes("•")) {
                throw new Error("Cannot save masked API key. Please enter the actual API key.");
            }
        }
    }

    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "azure",
        azure: configToSave,
        updatedAt: new Date(),
    };

    const validatedAzure = AzureEmbeddingConfigSchema.parse(configToSave);
    updatedConfig.azure = validatedAzure;

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

/**
 * Update LM Studio embedding configuration
 */
export async function updateLMStudioEmbeddingConfig(
    lmstudioConfig: LMStudioEmbeddingConfig
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    let configToSave = { ...lmstudioConfig };
    if (!configToSave.apiKey || configToSave.apiKey.trim() === "" || configToSave.apiKey.includes("•")) {
        if (currentConfig.lmstudio?.apiKey && !currentConfig.lmstudio.apiKey.includes("•")) {
            configToSave.apiKey = currentConfig.lmstudio.apiKey;
        } else {
            if (configToSave.apiKey?.includes("•")) {
                throw new Error("Cannot save masked API key. Please enter the actual API key.");
            }
        }
    }

    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider: "lmstudio",
        lmstudio: configToSave,
        updatedAt: new Date(),
    };

    const validatedLMStudio = LMStudioEmbeddingConfigSchema.parse(configToSave);
    updatedConfig.lmstudio = validatedLMStudio;

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

/**
 * Update the default embedding provider
 */
export async function updateDefaultEmbeddingProvider(
    provider: "azure" | "lmstudio"
): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    const currentConfig = await getEmbeddingConfig();

    const updatedConfig: EmbeddingConfig = {
        ...currentConfig,
        provider,
        defaultProvider: provider,
        updatedAt: new Date(),
    };

    const validatedConfig = validateEmbeddingConfig(updatedConfig);

    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            { $set: validatedConfig }
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
export async function resetEmbeddingToEnvConfig(): Promise<EmbeddingConfig> {
    const collection = await getCollection();
    await collection.deleteMany({});
    return getEnvBasedConfig();
}
