import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";

import { config } from "./config";

export function getChatModel() {
  if (config.azure.endpoint && config.azure.apiKey && config.azure.deployment) {
    return new AzureChatOpenAI({
      azureOpenAIApiKey: config.azure.apiKey,
      azureOpenAIApiDeploymentName: config.azure.deployment,
      azureOpenAIApiVersion: config.azure.apiVersion,
      azureOpenAIApiInstanceName: config.azure.endpoint
        ? new URL(config.azure.endpoint).hostname.split(".")[0]
        : undefined,
      azureOpenAIEndpoint: config.azure.endpoint,
      temperature: 1,
    });
  }

  return new ChatOpenAI({
    modelName: config.azure.model,
    verbose: false,
    temperature: 1,
  });
}
