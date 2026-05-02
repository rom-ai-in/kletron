import { useCallback, useEffect, useState } from "react";

type EmbeddingJson = Record<string, unknown>;

type ContextJson = {
  enabled?: boolean;
  injection?: {
    structuralInjectionEnabled?: boolean;
    semanticInjectionEnabled?: boolean;
  };
};

function embeddingSummary(data: EmbeddingJson): string {
  const provider = typeof data.provider === "string" ? data.provider : "";
  if (!provider) return "—";
  const block = data[provider];
  const model =
    block && typeof block === "object" && block !== null && "model" in block && typeof (block as { model?: unknown }).model === "string"
      ? (block as { model: string }).model
      : "";
  return model ? `${provider} · ${model}` : provider;
}

function contextSummary(data: ContextJson): string {
  const inj = data.injection;
  if (!inj) return data.enabled === false ? "Disabled" : "Default injection";
  const s = inj.structuralInjectionEnabled !== false;
  const m = inj.semanticInjectionEnabled !== false;
  const parts = [`structural ${s ? "on" : "off"}`, `semantic ${m ? "on" : "off"}`];
  return data.enabled === false ? "Disabled" : parts.join(" · ");
}

/**
 * Read-only embedding + context status for desktop settings (portal is source of truth for editing).
 */
export function usePortalConfigSnapshot(
  backendUrlTrimmed: string,
  enabled: boolean,
  getAccessToken: () => Promise<string | null>,
  workspaceId: string | null
) {
  const [embeddingLine, setEmbeddingLine] = useState<string | null>(null);
  const [contextLine, setContextLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !workspaceId) {
      setEmbeddingLine(null);
      setContextLine(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "x-workspace-id": workspaceId };
      if (token) headers.Authorization = `Bearer ${token}`;
      const base = backendUrlTrimmed.replace(/\/$/, "");
      const [embRes, ctxRes] = await Promise.all([
        fetch(`${base}/api/embedding-config`, { headers }),
        fetch(`${base}/api/context-config`, { headers }),
      ]);
      if (embRes.ok) {
        const j = (await embRes.json()) as EmbeddingJson;
        setEmbeddingLine(embeddingSummary(j));
      } else {
        setEmbeddingLine(embRes.status === 401 ? "Sign in to view" : "Unavailable");
      }
      if (ctxRes.ok) {
        const j = (await ctxRes.json()) as ContextJson;
        setContextLine(contextSummary(j));
      } else {
        setContextLine(ctxRes.status === 401 ? "Sign in to view" : "Unavailable");
      }
    } catch {
      setError("Could not load workspace config");
      setEmbeddingLine(null);
      setContextLine(null);
    } finally {
      setLoading(false);
    }
  }, [backendUrlTrimmed, enabled, getAccessToken, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { embeddingLine, contextLine, loading, error, reload: load };
}
