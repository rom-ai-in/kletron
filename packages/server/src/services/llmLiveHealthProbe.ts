import type { LlmConfig, LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";

const FETCH_MS = 8000;

function signal() {
    return AbortSignal.timeout(FETCH_MS);
}

async function fetchOk(url: string, init?: RequestInit): Promise<boolean> {
    try {
        const res = await fetch(url, { ...init, signal: signal(), cache: "no-store" });
        return res.ok;
    } catch {
        return false;
    }
}

async function probeLmStudio(baseUrl: string, apiKey?: string): Promise<{ ok: boolean; message: string }> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

    if (await fetchOk(`${cleanBaseUrl}/api/v1/models`, { headers })) {
        return { ok: true, message: "LM Studio reachable" };
    }
    if (await fetchOk(`${cleanBaseUrl}/api/v0/models`, { headers })) {
        return { ok: true, message: "LM Studio reachable" };
    }

    const openAiRoot = baseUrl.replace(/\/+$/, "").endsWith("/v1")
        ? baseUrl.replace(/\/+$/, "")
        : `${cleanBaseUrl}/v1`;
    if (await fetchOk(`${openAiRoot}/models`, { headers })) {
        return { ok: true, message: "LM Studio reachable (OpenAI-compatible endpoint)" };
    }

    return {
        ok: false,
        message: "Cannot reach LM Studio. Start the local server or fix the base URL.",
    };
}

async function probeOllama(baseUrl: string): Promise<{ ok: boolean; message: string }> {
    const clean = baseUrl.replace(/\/+$/, "");
    const ok = await fetchOk(`${clean}/api/tags`);
    return ok
        ? { ok: true, message: "Ollama reachable" }
        : { ok: false, message: "Cannot reach Ollama. Is it running?" };
}

async function probeVllm(baseUrl: string, apiKey?: string): Promise<{ ok: boolean; message: string }> {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    if (await fetchOk(`${cleanBaseUrl}/api/status`, { headers })) {
        return { ok: true, message: "vLLM reachable" };
    }
    if (await fetchOk(`${cleanBaseUrl}/v1/models`, { headers })) {
        return { ok: true, message: "vLLM reachable (OpenAI API)" };
    }
    return { ok: false, message: "Cannot reach vLLM server. Check URL and port." };
}

async function probeOpenAI(apiKey: string, baseUrl?: string): Promise<{ ok: boolean; message: string }> {
    const root = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const ok = await fetchOk(`${root}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    return ok
        ? { ok: true, message: "OpenAI API reachable" }
        : { ok: false, message: "Cannot reach OpenAI. Check API key or base URL." };
}

async function probeAzure(endpoint: string, apiKey: string, apiVersion: string): Promise<{ ok: boolean; message: string }> {
    const ep = endpoint.replace(/\/+$/, "");
    const url = `${ep}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`;
    const ok = await fetchOk(url, {
        headers: { "api-key": apiKey, Accept: "application/json" },
    });
    return ok
        ? { ok: true, message: "Azure OpenAI reachable" }
        : { ok: false, message: "Cannot reach Azure OpenAI. Check endpoint, key, and API version." };
}

async function probeClaude(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const ok = await fetchOk("https://api.anthropic.com/v1/models", {
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            Accept: "application/json",
        },
    });
    return ok
        ? { ok: true, message: "Anthropic API reachable" }
        : { ok: false, message: "Cannot reach Anthropic. Check API key." };
}

async function probeGemini(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const ok = await fetchOk(url);
    return ok
        ? { ok: true, message: "Gemini API reachable" }
        : { ok: false, message: "Cannot reach Google AI. Check API key." };
}

async function probeVertex(
    projectId: string,
    location: string,
    credentialsJson?: string
): Promise<{ ok: boolean; message: string }> {
    let GoogleAuthCtor: typeof import("google-auth-library").GoogleAuth;
    try {
        // Lazy-loaded so we don't pull google-auth-library into the cold path
        // for users on other providers.
        ({ GoogleAuth: GoogleAuthCtor } = await import("google-auth-library"));
    } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        return { ok: false, message: `google-auth-library not available: ${reason}` };
    }

    let parsedCreds: object | undefined;
    if (credentialsJson && credentialsJson.trim().length > 0) {
        try {
            parsedCreds = JSON.parse(credentialsJson);
        } catch (error) {
            const reason = error instanceof Error ? error.message : "invalid JSON";
            return { ok: false, message: `Service account JSON invalid: ${reason}` };
        }
    }

    let token: string | undefined;
    try {
        const auth = new GoogleAuthCtor({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            projectId,
            ...(parsedCreds ? { credentials: parsedCreds as never } : {}),
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token ?? undefined;
    } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        return {
            ok: false,
            message: parsedCreds
                ? `Service account auth failed: ${reason}`
                : `Application Default Credentials unavailable: ${reason}. On Cloud Run, attach a service account; locally, run \`gcloud auth application-default login\` or paste a service account JSON.`,
        };
    }

    if (!token) {
        return { ok: false, message: "Could not acquire a Vertex AI access token." };
    }

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models?pageSize=1`;
    const ok = await fetchOk(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });
    return ok
        ? { ok: true, message: "Vertex AI reachable" }
        : {
              ok: false,
              message: `Cannot reach Vertex AI at ${location}. Check projectId, location, and that the service account has the Vertex AI User role.`,
          };
}

/**
 * Server-side reachability probe (no chat completion). Used for live UI status.
 */
export async function probeLlmLiveHealth(
    provider: LlmProviderType,
    fullConfig: LlmConfig
): Promise<{ ok: boolean; message: string }> {
    switch (provider) {
        case "lmstudio": {
            const c = fullConfig.lmstudio;
            if (!c?.baseUrl) return { ok: false, message: "Base URL not configured" };
            return probeLmStudio(c.baseUrl, c.apiKey);
        }
        case "ollama": {
            const c = fullConfig.ollama;
            if (!c?.baseUrl) return { ok: false, message: "Base URL not configured" };
            return probeOllama(c.baseUrl);
        }
        case "vllm": {
            const c = fullConfig.vllm;
            if (!c?.baseUrl) return { ok: false, message: "Base URL not configured" };
            return probeVllm(c.baseUrl, c.apiKey);
        }
        case "openai": {
            const c = fullConfig.openai;
            if (!c?.apiKey) return { ok: false, message: "API key not configured" };
            return probeOpenAI(c.apiKey, c.baseUrl);
        }
        case "codex": {
            const c = fullConfig.codex;
            const fallback = fullConfig.openai;
            const lmstudio = fullConfig.lmstudio;
            const baseUrl = c?.baseUrl ?? fallback?.baseUrl ?? lmstudio?.baseUrl;
            if (!baseUrl) return { ok: false, message: "Base URL not configured" };
            const apiKey = c?.apiKey ?? fallback?.apiKey ?? lmstudio?.apiKey ?? "codex-local";
            return probeOpenAI(apiKey, baseUrl);
        }
        case "azure": {
            const c = fullConfig.azure;
            if (!c?.endpoint || !c.apiKey || !c.apiVersion) {
                return { ok: false, message: "Azure configuration incomplete" };
            }
            return probeAzure(c.endpoint, c.apiKey, c.apiVersion);
        }
        case "claude": {
            const c = fullConfig.claude;
            if (!c?.apiKey) return { ok: false, message: "API key not configured" };
            return probeClaude(c.apiKey);
        }
        case "gemini": {
            const c = fullConfig.gemini;
            if (!c?.apiKey) return { ok: false, message: "API key not configured" };
            return probeGemini(c.apiKey);
        }
        case "vertex": {
            const c = fullConfig.vertex;
            if (!c?.projectId || !c.location) {
                return { ok: false, message: "Project ID and location are required" };
            }
            return probeVertex(c.projectId, c.location, c.credentialsJson);
        }
        default:
            return { ok: false, message: "Unknown provider" };
    }
}
