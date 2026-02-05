import { Collection, ObjectId } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "../lib/db";
import type {
    LlmConfig,
    AzureOpenAIConfig,
    OpenAIConfig,
    ClaudeConfig,
    GeminiConfig,
    LMStudioConfig,
    OllamaConfig,
    LlmProviderType,
} from "@numezis/shared/schemas/llmConfig.schema";
import * as LlmSchema from "@numezis/shared/schemas/llmConfig.schema";

const {
    validateLlmConfig,
    AzureOpenAIConfigSchema,
    OpenAIConfigSchema,
    ClaudeConfigSchema,
    GeminiConfigSchema,
    LMStudioConfigSchema,
    OllamaConfigSchema,
} = LlmSchema;

const COLLECTION_NAME = "llm_configs";
const CONFIG_JSON_PATH = path.resolve(process.cwd(), "config", "config.json");
const LLM_CONFIG_KEY = "llmConfig";

const DEFAULT_ENABLED_PROVIDERS: LlmProviderType[] = [
    "azure",
    "openai",
    "claude",
    "gemini",
    "lmstudio",
    "ollama",
];

function getDefaultConfig(): LlmConfig {
    return {
        provider: "lmstudio",
        defaultProvider: "lmstudio",
        enabledProviders: DEFAULT_ENABLED_PROVIDERS,
    };
}

function readConfigFile(): LlmConfig | null {
    try {
        if (!fs.existsSync(CONFIG_JSON_PATH)) return null;
        const raw = fs.readFileSync(CONFIG_JSON_PATH, "utf-8");
        const data = JSON.parse(raw) as Record<string, unknown>;
        const candidate = data?.[LLM_CONFIG_KEY];
        if (!candidate) return null;
        return validateLlmConfig(candidate);
    } catch (error) {
        console.warn("[LLM Config] Failed to read config.json fallback:", error);
        return null;
    }
}

function writeConfigFile(configToWrite: LlmConfig): void {
    const dir = path.dirname(CONFIG_JSON_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let existing: Record<string, unknown> = {};
    if (fs.existsSync(CONFIG_JSON_PATH)) {
        try {
            existing = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, "utf-8"));
        } catch {
            existing = {};
        }
    }
    existing[LLM_CONFIG_KEY] = configToWrite;
    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(existing, null, 2), "utf-8");
}

async function getCollection(): Promise<Collection<LlmConfig>> {
    const db = await getDatabase();
    return db.collection<LlmConfig>(COLLECTION_NAME);
}

/**
 * Get the current LLM configuration from MongoDB
 * Falls back to config.json if MongoDB is unavailable
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
    } catch (error) {
        console.warn("Failed to fetch LLM config from MongoDB, using config.json fallback:", error);
    }

    return readConfigFile() ?? getDefaultConfig();
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
    let collection: Collection<LlmConfig> | null = null;
    try {
        collection = await getCollection();
    } catch (error) {
        console.warn("[LLM Config] MongoDB unavailable; persisting to config.json only.", error);
    }

    const currentConfig = await getLlmConfig();

    const validatedConfig = schema.parse(configToSave);

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        [providerKey]: validatedConfig,
        updatedAt: new Date(),
    };

    if (collection) {
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
    }

    writeConfigFile(updatedConfig);
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
        ...currentConfig.lmstudio,
        ...lmstudioConfig,
        modelSettings: lmstudioConfig.modelSettings ?? currentConfig.lmstudio?.modelSettings,
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
    let collection: Collection<LlmConfig> | null = null;
    try {
        collection = await getCollection();
    } catch (error) {
        console.warn("[LLM Config] MongoDB unavailable; persisting to config.json only.", error);
    }

    const currentConfig = await getLlmConfig();

    // Only update the provider fields - no full schema validation needed
    // This allows switching to any provider even if other providers are not configured
    const updatedConfig: LlmConfig = {
        ...currentConfig,
        provider,
        defaultProvider: provider,
        updatedAt: new Date(),
    };

    if (collection) {
        if (currentConfig._id) {
            await collection.updateOne(
                { _id: new ObjectId(currentConfig._id) } as any,
                { $set: { provider, defaultProvider: provider, updatedAt: new Date() } }
            );
        } else {
            const result = await collection.insertOne({
                ...updatedConfig,
                createdAt: new Date(),
            });
            updatedConfig._id = result.insertedId.toString();
        }
    }

    writeConfigFile(updatedConfig);
    return updatedConfig;
}

/**
 * Reset configuration to defaults (no provider secrets)
 */
export async function resetToDefaultConfig(): Promise<LlmConfig> {
    let collection: Collection<LlmConfig> | null = null;
    try {
        collection = await getCollection();
    } catch (error) {
        console.warn("[LLM Config] MongoDB unavailable; clearing config.json only.", error);
    }

    if (collection) {
        await collection.deleteMany({});
    }

    const defaults = getDefaultConfig();
    writeConfigFile(defaults);
    return defaults;
}

/**
 * Get list of enabled providers
 * Returns all providers if enabledProviders is not set
 */
export async function getEnabledProviders(): Promise<LlmProviderType[]> {
    const llmConfig = await getLlmConfig();
    // Default: all providers are enabled
    return llmConfig.enabledProviders ?? DEFAULT_ENABLED_PROVIDERS;
}

/**
 * Enable or disable a specific provider
 */
export async function setProviderEnabled(
    provider: LlmProviderType,
    enabled: boolean
): Promise<LlmConfig> {
    let collection: Collection<LlmConfig> | null = null;
    try {
        collection = await getCollection();
    } catch (error) {
        console.warn("[LLM Config] MongoDB unavailable; persisting to config.json only.", error);
    }

    const currentConfig = await getLlmConfig();

    // Get current enabled providers or default to all
    const currentEnabled = (currentConfig.enabledProviders ?? DEFAULT_ENABLED_PROVIDERS) as LlmProviderType[];

    let newEnabledProviders: LlmProviderType[];

    if (enabled) {
        // Add provider if not already in list
        newEnabledProviders = currentEnabled.includes(provider)
            ? [...currentEnabled]
            : [...currentEnabled, provider];
    } else {
        // Cannot disable the active provider
        if (currentConfig.provider === provider) {
            throw new Error(`Cannot disable the active provider (${provider}). Switch to a different provider first.`);
        }
        // Remove provider from list
        newEnabledProviders = currentEnabled.filter(p => p !== provider);
    }

    const updatedConfig: LlmConfig = {
        ...currentConfig,
        enabledProviders: newEnabledProviders,
        updatedAt: new Date(),
    };

    if (collection) {
        if (currentConfig._id) {
            await collection.updateOne(
                { _id: new ObjectId(currentConfig._id) } as any,
                { $set: { enabledProviders: newEnabledProviders, updatedAt: new Date() } }
            );
        } else {
            const result = await collection.insertOne({
                ...updatedConfig,
                createdAt: new Date(),
            });
            updatedConfig._id = result.insertedId.toString();
        }
    }

    writeConfigFile(updatedConfig);
    return updatedConfig;
}
