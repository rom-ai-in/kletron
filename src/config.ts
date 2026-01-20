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

if (!azureEndpoint || !azureApiKey) {
  console.warn(
    "⚠️  Azure OpenAI variables (AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY) are not set."
  );
}

process.env.MCP_DEFAULT_DIR = repoRoot;
process.env.GITHUB_MCP_DEFAULT_DIR = repoRoot;

export const config = {
  repoRoot,
  azure: {
    endpoint: azureEndpoint,
    apiKey: azureApiKey,
    deployment: azureDeployment,
    model: azureModel,
    apiVersion: azureApiVersion,
  },
};
