import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";

import { config } from "./config";

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
  return { provider, model: model || undefined };
};

export function getChatModel(selection?: Partial<LlmSelection>) {
  const provider = selection?.provider ?? config.defaultProvider;

  if (provider === "lmstudio") {
    const model = selection?.model ?? config.lmstudio.model;
    if (!model) {
      throw new Error(
        "LM Studio model name is required. Set LMSTUDIO_MODEL or provide a model in the request."
      );
    }
    return new ChatOpenAI({
      model,
      apiKey: config.lmstudio.apiKey ?? "lm-studio",
      configuration: {
        baseURL: config.lmstudio.baseUrl,
      },
      temperature: 1,
    });
  }

  if (!config.azure.endpoint || !config.azure.apiKey || !config.azure.deployment) {
    throw new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT."
    );
  }

  return new AzureChatOpenAI({
    azureOpenAIApiKey: config.azure.apiKey,
    azureOpenAIApiDeploymentName: config.azure.deployment,
    azureOpenAIApiVersion: config.azure.apiVersion,
    azureOpenAIApiInstanceName: config.azure.endpoint
      ? new URL(config.azure.endpoint).hostname.split(".")[0]
      : undefined,
    azureOpenAIEndpoint: config.azure.endpoint,
    model: selection?.model ?? config.azure.model,
    temperature: 1,
  });
}
