import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./mongoClient";
import {
    LlmConfig,
    AzureOpenAIConfig,
    LMStudioConfig,
    validateLlmConfig,
    AzureOpenAIConfigSchema,
    LMStudioConfigSchema,
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

    // If API key is empty or masked, try to preserve the existing one
    let configToSave = { ...azureConfig };
    if (!configToSave.apiKey || configToSave.apiKey.trim() === "" || configToSave.apiKey.includes("•")) {
        if (currentConfig.azure?.apiKey && !currentConfig.azure.apiKey.includes("•")) {
            configToSave.apiKey = currentConfig.azure.apiKey;
        } else {
            // If we can't recover the key, and it's masked or empty, this is invalid state if we're trying to save.
            // However, allowing empty might be valid if they want to clear it?
            // But allowing "••••••••" is definitely wrong.
            if (configToSave.apiKey?.includes("•")) {
                throw new Error("Cannot save masked API key. Please enter the actual API key.");
            }
        }
    }

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        azure: configToSave,
        updatedAt: new Date(),
    };

    // We only validate the Azure config here, as we don't want to fail
    // if the existing LM Studio config is invalid/incomplete
    const validatedAzure = AzureOpenAIConfigSchema.parse(configToSave);
    updatedConfig.azure = validatedAzure;

    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            {
                $set: updatedConfig,
            }
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
 * Update LM Studio configuration
 */
export async function updateLMStudioConfig(
    lmstudioConfig: LMStudioConfig
): Promise<LlmConfig> {
    const collection = await getCollection();
    const currentConfig = await getLlmConfig();

    // If API key is empty or masked, try to preserve the existing one
    let configToSave = { ...lmstudioConfig };
    if (!configToSave.apiKey || configToSave.apiKey.trim() === "" || configToSave.apiKey.includes("•") || configToSave.apiKey === "lm-studio") {
        // Note: LM Studio default might be "lm-studio", but if user explicitly clears it or it's masked...
        if (currentConfig.lmstudio?.apiKey && !currentConfig.lmstudio.apiKey.includes("•")) {
            configToSave.apiKey = currentConfig.lmstudio.apiKey;
        } else {
            if (configToSave.apiKey?.includes("•")) {
                throw new Error("Cannot save masked API key. Please enter the actual API key.");
            }
        }
    }

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        lmstudio: configToSave,
        updatedAt: new Date(),
    };

    // We only validate the LM Studio config here, as we don't want to fail
    // if the existing Azure config is invalid/incomplete
    const validatedLMStudio = LMStudioConfigSchema.parse(configToSave);
    updatedConfig.lmstudio = validatedLMStudio;

    if (currentConfig._id) {
        await collection.updateOne(
            { _id: new ObjectId(currentConfig._id) } as any,
            {
                $set: updatedConfig,
            }
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
