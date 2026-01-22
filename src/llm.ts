import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";

import { config } from "./config";
import { getLlmConfig } from "./services/llmConfigService";

export type LlmProvider = "azure" | "lmstudio";

export type LlmSelection = {
  provider: LlmProvider;
  model?: string;
};

const normalizeProvider = (value?: string): LlmProvider | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "azure") return "azure";
  if (normalized === "lmstudio") return "lmstudio";
  return undefined;
};

export const resolveLlmSelection = (input?: {
  provider?: string;
  model?: string;
}): LlmSelection => {
  const provider = normalizeProvider(input?.provider) ?? config.defaultProvider;
  const model = typeof input?.model === "string" ? input.model.trim() : undefined;
  return { provider: provider as LlmProvider, model: model || undefined };
};

/**
 * Get chat model with runtime configuration from MongoDB (falls back to env vars)
 * Now async to support dynamic configuration loading
 */
export async function getChatModel(selection?: Partial<LlmSelection>) {
  // Fetch current configuration from MongoDB (or env fallback)
  let runtimeConfig;
  try {
    runtimeConfig = await getLlmConfig();
  } catch (error) {
    console.warn("Failed to fetch LLM config, using environment variables:", error);
    runtimeConfig = {
      provider: config.defaultProvider as "azure" | "lmstudio",
      azure: config.azure.endpoint ? {
        endpoint: config.azure.endpoint,
        apiKey: config.azure.apiKey ?? "",
        deployment: config.azure.deployment ?? "",
        model: config.azure.model,
        apiVersion: config.azure.apiVersion,
      } : undefined,
      lmstudio: {
        baseUrl: config.lmstudio.baseUrl,
        apiKey: config.lmstudio.apiKey,
        model: config.lmstudio.model,
      },
      defaultProvider: config.defaultProvider as "azure" | "lmstudio",
    };
  }

  const provider = selection?.provider ?? runtimeConfig.defaultProvider;

  if (provider === "lmstudio") {
    const model = selection?.model ?? runtimeConfig.lmstudio?.model;
    if (!model) {
      throw new Error(
        "LM Studio model name is required. Set LMSTUDIO_MODEL or provide a model in the request."
      );
    }
    return new ChatOpenAI({
      model,
      apiKey: runtimeConfig.lmstudio?.apiKey ?? "lm-studio",
      configuration: {
        baseURL: runtimeConfig.lmstudio?.baseUrl ?? config.lmstudio.baseUrl,
      },
      temperature: 1,
    });
  }

  // Azure OpenAI
  const azureConfig = runtimeConfig.azure;
  if (!azureConfig?.endpoint || !azureConfig?.apiKey || !azureConfig?.deployment) {
    throw new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT or configure via the UI."
    );
  }

  return new AzureChatOpenAI({
    azureOpenAIApiKey: azureConfig.apiKey,
    azureOpenAIApiDeploymentName: azureConfig.deployment,
    azureOpenAIApiVersion: azureConfig.apiVersion,
    azureOpenAIApiInstanceName: azureConfig.endpoint
      ? new URL(azureConfig.endpoint).hostname.split(".")[0]
      : undefined,
    azureOpenAIEndpoint: azureConfig.endpoint,
    model: selection?.model ?? azureConfig.model,
    temperature: 1,
  });
}
