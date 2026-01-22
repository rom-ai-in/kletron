import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./mongoClient";
import {
    LlmConfig,
    AzureOpenAIConfig,
    LMStudioConfig,
    validateLlmConfig,
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
            return storedConfig;
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
        provider: config.defaultProvider as "azure" | "lmstudio",
        azure: config.azure.endpoint
            ? {
                endpoint: config.azure.endpoint,
                apiKey: config.azure.apiKey ?? "",
                deployment: config.azure.deployment ?? "",
                model: config.azure.model,
                apiVersion: config.azure.apiVersion,
            }
            : undefined,
        lmstudio: {
            baseUrl: config.lmstudio.baseUrl,
            apiKey: config.lmstudio.apiKey,
            model: config.lmstudio.model,
        },
        defaultProvider: config.defaultProvider as "azure" | "lmstudio",
    };
}

/**
 * Update Azure OpenAI configuration
 */
export async function updateAzureConfig(
    azureConfig: AzureOpenAIConfig
): Promise<LlmConfig> {
    const collection = await getCollection();
    const currentConfig = await getLlmConfig();

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        azure: azureConfig,
        updatedAt: new Date(),
    };

    const validatedConfig = validateLlmConfig(updatedConfig);

    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            {
                $set: validatedConfig,
            }
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
 * Update LM Studio configuration
 */
export async function updateLMStudioConfig(
    lmstudioConfig: LMStudioConfig
): Promise<LlmConfig> {
    const collection = await getCollection();
    const currentConfig = await getLlmConfig();

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        lmstudio: lmstudioConfig,
        updatedAt: new Date(),
    };

    const validatedConfig = validateLlmConfig(updatedConfig);

    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            {
                $set: validatedConfig,
            }
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
 * Update the default provider
 */
export async function updateDefaultProvider(
    provider: "azure" | "lmstudio"
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
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            {
                $set: validatedConfig,
            }
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
