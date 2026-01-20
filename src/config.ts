import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const configuredRepoRoot =
  process.env.GITHUB_MCP_DEFAULT_DIR ?? process.env.MCP_DEFAULT_DIR;
const repoRoot = configuredRepoRoot ? path.resolve(configuredRepoRoot) : process.cwd();

const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const azureModel = process.env.AZURE_OPENAI_MODEL ?? "gpt-5-mini";
const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";
const lmstudioBaseUrl = process.env.LMSTUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1";
const lmstudioApiKey = process.env.LMSTUDIO_API_KEY;
const lmstudioModel = process.env.LMSTUDIO_MODEL ?? "";
const defaultProviderRaw = process.env.LLM_DEFAULT_PROVIDER;
const isDefaultProviderValid = defaultProviderRaw === "azure" || defaultProviderRaw === "lmstudio";
const defaultProvider =
  (isDefaultProviderValid ? defaultProviderRaw : undefined) ??
  (azureEndpoint && azureApiKey && azureDeployment ? "azure" : "lmstudio");

if (!azureEndpoint || !azureApiKey || !azureDeployment) {
  console.warn(
    "⚠️  Azure OpenAI variables (AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY/AZURE_OPENAI_DEPLOYMENT) are not set."
  );
}

process.env.MCP_DEFAULT_DIR = repoRoot;
process.env.GITHUB_MCP_DEFAULT_DIR = repoRoot;

export const config = {
  repoRoot,
  defaultProvider,
  azure: {
    endpoint: azureEndpoint,
    apiKey: azureApiKey,
    deployment: azureDeployment,
    model: azureModel,
    apiVersion: azureApiVersion,
  },
  lmstudio: {
    baseUrl: lmstudioBaseUrl,
    apiKey: lmstudioApiKey,
    model: lmstudioModel,
  },
};
