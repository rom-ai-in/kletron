import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";

import { getLlmConfig } from "./services/llmConfigService";
import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";

export type LlmProvider = LlmProviderType;

export type LlmSelection = {
  provider: LlmProvider;
  model?: string;
};

const normalizeProvider = (value?: string): LlmProvider | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const validProviders: LlmProvider[] = ["azure", "openai", "claude", "gemini", "lmstudio", "ollama", "vllm"];
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
  const provider = normalizeProvider(input?.provider);
  if (!provider) {
    throw new Error("LLM provider is required.");
  }
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
  vllm?: { baseUrl?: string };
};

export type ChatModelOverrides = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
};

export async function resolveResolvedLlmInfo(selection?: Partial<LlmSelection>): Promise<ResolvedLlmInfo> {
  const runtimeConfig = await getLlmConfig();

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
        lmstudio: { baseUrl: lmstudioConfig?.baseUrl },
      };
    }
    case "ollama": {
      const ollamaConfig = runtimeConfig.ollama;
      return {
        provider: "ollama",
        model: selection?.model ?? ollamaConfig?.model,
        ollama: { baseUrl: ollamaConfig?.baseUrl },
      };
    }
    case "vllm": {
      const vllmConfig = runtimeConfig.vllm;
      return {
        provider: "vllm",
        model: selection?.model ?? vllmConfig?.model,
        vllm: { baseUrl: vllmConfig?.baseUrl },
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
  const runtimeConfig = await getLlmConfig();

  const provider = selection?.provider ?? runtimeConfig.defaultProvider;
  const overrideTemperature = typeof overrides?.temperature === "number" ? overrides.temperature : undefined;
  const temperature = overrideTemperature ?? 1;

  switch (provider) {
    case "azure": {
      const azureConfig = runtimeConfig.azure;
      if (!azureConfig?.endpoint || !azureConfig?.apiKey || !azureConfig?.deployment) {
        throw new Error(
          "Azure OpenAI is not configured. Configure it in the UI before running."
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
          "OpenAI is not configured. Configure it in the UI before running."
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
          "Claude (Anthropic) is not configured. Configure it in the UI before running."
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
          "Gemini is not configured. Configure it in the UI before running."
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
          "LM Studio model name is required. Configure a model in the UI or provide a model in the request."
        );
      }
      if (!lmstudioConfig?.baseUrl) {
        throw new Error("LM Studio base URL is required. Configure it in the UI.");
      }
      const modelSettings = lmstudioConfig?.modelSettings?.[model];
      const resolvedTemperature =
        overrideTemperature ??
        (typeof modelSettings?.temperature === "number" ? modelSettings.temperature : 1);
      const resolvedMaxTokens =
        typeof overrides?.maxTokens === "number" ? overrides.maxTokens : modelSettings?.maxTokens;
      const resolvedTopP =
        typeof overrides?.topP === "number" ? overrides.topP : modelSettings?.topP;
      const resolvedPresencePenalty =
        typeof overrides?.presencePenalty === "number"
          ? overrides.presencePenalty
          : modelSettings?.presencePenalty;
      const resolvedFrequencyPenalty =
        typeof overrides?.frequencyPenalty === "number"
          ? overrides.frequencyPenalty
          : modelSettings?.frequencyPenalty;
      const resolvedTopK =
        typeof overrides?.topK === "number" ? overrides.topK : modelSettings?.topK;
      const resolvedRepeatPenalty =
        typeof overrides?.repeatPenalty === "number"
          ? overrides.repeatPenalty
          : modelSettings?.repeatPenalty;

      const modelKwargs: Record<string, unknown> = {};
      if (typeof resolvedTopK === "number") {
        modelKwargs.top_k = resolvedTopK;
      }
      if (typeof resolvedRepeatPenalty === "number") {
        modelKwargs.repeat_penalty = resolvedRepeatPenalty;
      }
      return new ChatOpenAI({
        model,
        apiKey: lmstudioConfig?.apiKey ?? "lm-studio",
        configuration: {
          baseURL: lmstudioConfig.baseUrl,
        },
        temperature: resolvedTemperature,
        ...(typeof resolvedMaxTokens === "number" ? { maxTokens: resolvedMaxTokens } : {}),
        ...(typeof resolvedTopP === "number" ? { topP: resolvedTopP } : {}),
        ...(typeof resolvedPresencePenalty === "number" ? { presencePenalty: resolvedPresencePenalty } : {}),
        ...(typeof resolvedFrequencyPenalty === "number" ? { frequencyPenalty: resolvedFrequencyPenalty } : {}),
        ...(Object.keys(modelKwargs).length ? { modelKwargs } : {}),
      });
    }

    case "ollama": {
      const ollamaConfig = runtimeConfig.ollama;
      const model = selection?.model ?? ollamaConfig?.model;
      if (!model) {
        throw new Error(
          "Ollama model name is required. Configure a model in the UI or provide a model in the request."
        );
      }
      if (!ollamaConfig?.baseUrl) {
        throw new Error("Ollama base URL is required. Configure it in the UI.");
      }
      return new ChatOllama({
        model,
        baseUrl: ollamaConfig.baseUrl,
        temperature,
      });
    }

    case "vllm": {
      const vllmConfig = runtimeConfig.vllm;
      const model = selection?.model ?? vllmConfig?.model;
      if (!model) {
        throw new Error(
          "vLLM model name is required. Configure a model in the UI or provide a model in the request."
        );
      }
      if (!vllmConfig?.baseUrl) {
        throw new Error("vLLM base URL is required. Configure it in the UI.");
      }
      // Ensure the OpenAI-compatible endpoint has /v1
      const vllmOpenAIBaseUrl = vllmConfig.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1";
      const modelSettings = vllmConfig?.modelSettings?.[model];
      const resolvedTemperature =
        overrideTemperature ??
        (typeof modelSettings?.temperature === "number" ? modelSettings.temperature : 1);
      const resolvedMaxTokens =
        typeof overrides?.maxTokens === "number" ? overrides.maxTokens : modelSettings?.maxTokens;
      const resolvedTopP =
        typeof overrides?.topP === "number" ? overrides.topP : modelSettings?.topP;
      const resolvedPresencePenalty =
        typeof overrides?.presencePenalty === "number"
          ? overrides.presencePenalty
          : modelSettings?.presencePenalty;
      const resolvedFrequencyPenalty =
        typeof overrides?.frequencyPenalty === "number"
          ? overrides.frequencyPenalty
          : modelSettings?.frequencyPenalty;
      const resolvedTopK =
        typeof overrides?.topK === "number" ? overrides.topK : modelSettings?.topK;
      const resolvedRepeatPenalty =
        typeof overrides?.repeatPenalty === "number"
          ? overrides.repeatPenalty
          : modelSettings?.repeatPenalty;

      const modelKwargs: Record<string, unknown> = {};
      if (typeof resolvedTopK === "number") {
        modelKwargs.top_k = resolvedTopK;
      }
      if (typeof resolvedRepeatPenalty === "number") {
        modelKwargs.repeat_penalty = resolvedRepeatPenalty;
      }
      return new ChatOpenAI({
        model,
        apiKey: vllmConfig?.apiKey ?? "vllm",
        configuration: {
          baseURL: vllmOpenAIBaseUrl,
        },
        temperature: resolvedTemperature,
        ...(typeof resolvedMaxTokens === "number" ? { maxTokens: resolvedMaxTokens } : {}),
        ...(typeof resolvedTopP === "number" ? { topP: resolvedTopP } : {}),
        ...(typeof resolvedPresencePenalty === "number" ? { presencePenalty: resolvedPresencePenalty } : {}),
        ...(typeof resolvedFrequencyPenalty === "number" ? { frequencyPenalty: resolvedFrequencyPenalty } : {}),
        ...(Object.keys(modelKwargs).length ? { modelKwargs } : {}),
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
