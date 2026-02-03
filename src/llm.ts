import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";

import { config } from "./config";
import { getLlmConfig } from "./services/llmConfigService";
import type { LlmProviderType } from "./schemas/llmConfig.schema";

export type LlmProvider = LlmProviderType;

export type LlmSelection = {
  provider: LlmProvider;
  model?: string;
};

const normalizeProvider = (value?: string): LlmProvider | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const validProviders: LlmProvider[] = ["azure", "openai", "claude", "gemini", "lmstudio", "ollama"];
  return validProviders.includes(normalized as LlmProvider) ? (normalized as LlmProvider) : undefined;
};

// Use this when you want DB-configured defaults to apply.
// (i.e. if provider isn't explicitly provided, return undefined)
export const parseLlmSelectionInput = (input?: {
  provider?: string;
  model?: string;
}): Partial<LlmSelection> | undefined => {
  const provider = normalizeProvider(input?.provider);
  const model = typeof input?.model === "string" ? input.model.trim() : undefined;

  if (!provider && !model) return undefined;
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
};

export const resolveLlmSelection = (input?: {
  provider?: string;
  model?: string;
}): LlmSelection => {
  const provider = normalizeProvider(input?.provider) ?? config.defaultProvider;
  const model = typeof input?.model === "string" ? input.model.trim() : undefined;
  return { provider: provider as LlmProvider, model: model || undefined };
};

export type ResolvedLlmInfo = {
  provider: LlmProvider;
  model?: string;
  // Provider-specific debugging fields
  azure?: { deployment?: string; endpoint?: string; apiVersion?: string };
  openai?: { organization?: string };
  claude?: Record<string, never>;
  gemini?: Record<string, never>;
  lmstudio?: { baseUrl?: string };
  ollama?: { baseUrl?: string };
};

export type ChatModelOverrides = {
  temperature?: number;
};

export async function resolveResolvedLlmInfo(selection?: Partial<LlmSelection>): Promise<ResolvedLlmInfo> {
  // Fetch current configuration from MongoDB (or env fallback)
  let runtimeConfig;
  try {
    runtimeConfig = await getLlmConfig();
  } catch (error) {
    console.warn("Failed to fetch LLM config, using environment variables:", error);
    runtimeConfig = {
      provider: config.defaultProvider as LlmProvider,
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
      defaultProvider: config.defaultProvider as LlmProvider,
    };
  }

  const provider = (selection?.provider ?? runtimeConfig.defaultProvider) as LlmProvider;

  switch (provider) {
    case "azure": {
      const azureConfig = runtimeConfig.azure;
      return {
        provider: "azure",
        model: selection?.model ?? azureConfig?.model,
        azure: {
          deployment: azureConfig?.deployment,
          endpoint: azureConfig?.endpoint,
          apiVersion: azureConfig?.apiVersion,
        },
      };
    }
    case "openai": {
      const openaiConfig = runtimeConfig.openai;
      return {
        provider: "openai",
        model: selection?.model ?? openaiConfig?.model,
        openai: {
          organization: openaiConfig?.organization,
        },
      };
    }
    case "claude": {
      const claudeConfig = runtimeConfig.claude;
      return {
        provider: "claude",
        model: selection?.model ?? claudeConfig?.model,
        claude: {},
      };
    }
    case "gemini": {
      const geminiConfig = runtimeConfig.gemini;
      return {
        provider: "gemini",
        model: selection?.model ?? geminiConfig?.model,
        gemini: {},
      };
    }
    case "lmstudio": {
      const lmstudioConfig = runtimeConfig.lmstudio;
      return {
        provider: "lmstudio",
        model: selection?.model ?? lmstudioConfig?.model,
        lmstudio: { baseUrl: lmstudioConfig?.baseUrl ?? config.lmstudio.baseUrl },
      };
    }
    case "ollama": {
      const ollamaConfig = runtimeConfig.ollama;
      return {
        provider: "ollama",
        model: selection?.model ?? ollamaConfig?.model,
        ollama: { baseUrl: ollamaConfig?.baseUrl ?? config.ollama?.baseUrl },
      };
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Get chat model with runtime configuration from MongoDB (falls back to env vars)
 * Now async to support dynamic configuration loading
 */
export async function getChatModel(selection?: Partial<LlmSelection>, overrides?: ChatModelOverrides) {
  // Fetch current configuration from MongoDB (or env fallback)
  let runtimeConfig;
  try {
    runtimeConfig = await getLlmConfig();
  } catch (error) {
    console.warn("Failed to fetch LLM config, using environment variables:", error);
    runtimeConfig = {
      provider: config.defaultProvider as LlmProvider,
      azure: config.azure.endpoint ? {
        endpoint: config.azure.endpoint,
        apiKey: config.azure.apiKey ?? "",
        deployment: config.azure.deployment ?? "",
        model: config.azure.model,
        apiVersion: config.azure.apiVersion,
      } : undefined,
      openai: config.openai?.apiKey ? {
        apiKey: config.openai.apiKey,
        model: config.openai.model,
        organization: config.openai.organization,
      } : undefined,
      claude: config.claude?.apiKey ? {
        apiKey: config.claude.apiKey,
        model: config.claude.model,
      } : undefined,
      gemini: config.gemini?.apiKey ? {
        apiKey: config.gemini.apiKey,
        model: config.gemini.model,
      } : undefined,
      lmstudio: {
        baseUrl: config.lmstudio.baseUrl,
        apiKey: config.lmstudio.apiKey,
        model: config.lmstudio.model,
      },
      ollama: config.ollama?.baseUrl ? {
        baseUrl: config.ollama.baseUrl,
        model: config.ollama.model,
      } : undefined,
      defaultProvider: config.defaultProvider as LlmProvider,
    };
  }

  const provider = selection?.provider ?? runtimeConfig.defaultProvider;
  const temperature = typeof overrides?.temperature === "number" ? overrides.temperature : 1;

  switch (provider) {
    case "azure": {
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
        temperature,
      });
    }

    case "openai": {
      const openaiConfig = runtimeConfig.openai;
      if (!openaiConfig?.apiKey) {
        throw new Error(
          "OpenAI is not configured. Set OPENAI_API_KEY or configure via the UI."
        );
      }
      const model = selection?.model ?? openaiConfig.model;
      if (!model) {
        throw new Error("OpenAI model name is required.");
      }
      return new ChatOpenAI({
        model,
        apiKey: openaiConfig.apiKey,
        configuration: openaiConfig.organization
          ? { organization: openaiConfig.organization }
          : undefined,
        temperature,
      });
    }

    case "claude": {
      const claudeConfig = runtimeConfig.claude;
      if (!claudeConfig?.apiKey) {
        throw new Error(
          "Claude (Anthropic) is not configured. Set ANTHROPIC_API_KEY or configure via the UI."
        );
      }
      const model = selection?.model ?? claudeConfig.model;
      if (!model) {
        throw new Error("Claude model name is required.");
      }
      return new ChatAnthropic({
        model,
        anthropicApiKey: claudeConfig.apiKey,
        temperature,
      });
    }

    case "gemini": {
      const geminiConfig = runtimeConfig.gemini;
      if (!geminiConfig?.apiKey) {
        throw new Error(
          "Gemini is not configured. Set GOOGLE_API_KEY or configure via the UI."
        );
      }
      const model = selection?.model ?? geminiConfig.model;
      if (!model) {
        throw new Error("Gemini model name is required.");
      }
      return new ChatGoogleGenerativeAI({
        model,
        apiKey: geminiConfig.apiKey,
        temperature,
      });
    }

    case "lmstudio": {
      const lmstudioConfig = runtimeConfig.lmstudio;
      const model = selection?.model ?? lmstudioConfig?.model;
      if (!model) {
        throw new Error(
          "LM Studio model name is required. Set LMSTUDIO_MODEL or provide a model in the request."
        );
      }
      return new ChatOpenAI({
        model,
        apiKey: lmstudioConfig?.apiKey ?? "lm-studio",
        configuration: {
          baseURL: lmstudioConfig?.baseUrl ?? config.lmstudio.baseUrl,
        },
        temperature,
      });
    }

    case "ollama": {
      const ollamaConfig = runtimeConfig.ollama;
      const model = selection?.model ?? ollamaConfig?.model;
      if (!model) {
        throw new Error(
          "Ollama model name is required. Set OLLAMA_MODEL or provide a model in the request."
        );
      }
      return new ChatOllama({
        model,
        baseUrl: ollamaConfig?.baseUrl ?? config.ollama?.baseUrl ?? "http://127.0.0.1:11434",
        temperature,
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
