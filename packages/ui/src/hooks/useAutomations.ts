import { useState, useCallback, useEffect } from "react";
import { apiFetch, type GetRequestHeaders } from "@kletron/shared";
import type { Automation } from "../components/CommandCenter/AutomationsDashboard";

function mapStatus(s: string | undefined): Automation["status"] {
  const v = (s ?? "").toLowerCase();
  if (v === "paused" || v === "disabled") return "paused";
  if (v === "completed" || v === "success") return "completed";
  if (v === "failed" || v === "error") return "failed";
  return "active";
}

export interface UseAutomationsOptions {
  apiOrigin: string;
  backendReady: boolean;
  workspaceId: string | null;
  getRequestHeaders: GetRequestHeaders;
}

export function useAutomations({
  apiOrigin,
  backendReady,
  workspaceId,
  getRequestHeaders,
}: UseAutomationsOptions) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setAutomations([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch({
        apiOrigin,
        path: "/api/automations",
        getRequestHeaders,
        method: "GET",
        cache: "no-store",
        headers: { "x-workspace-id": workspaceId },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to load automations (${res.status})`);
      }
      const data = await res.json();
      const raw = Array.isArray(data?.automations) ? data.automations : [];
      const list: Automation[] = raw.map((a: Record<string, unknown>) => ({
        id: String(a.id ?? a._id ?? ""),
        name: String(a.name ?? "Automation"),
        description: typeof a.description === "string" ? a.description : undefined,
        schedule:
          typeof (a as any).schedule === "object" && (a as any).schedule?.cron
            ? String((a as any).schedule.cron)
            : typeof (a as any).cron === "string"
              ? (a as any).cron
              : undefined,
        status: mapStatus(typeof a.status === "string" ? a.status : undefined),
        lastRunAt: typeof (a as any).lastRunAt === "string" ? (a as any).lastRunAt : undefined,
        nextRunAt: typeof (a as any).nextRunAt === "string" ? (a as any).nextRunAt : undefined,
        lastSessionId:
          typeof (a as any).lastSessionId === "string"
            ? (a as any).lastSessionId
            : typeof (a as any).lastRunSessionId === "string"
              ? (a as any).lastRunSessionId
              : undefined,
      }));
      setAutomations(list.filter((x) => x.id));
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load automations.");
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, [apiOrigin, getRequestHeaders, workspaceId]);

  useEffect(() => {
    if (!backendReady || !workspaceId) return;
    void load();
  }, [backendReady, workspaceId, load]);

  const remove = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      const res = await apiFetch({
        apiOrigin,
        path: `/api/automations/${encodeURIComponent(id)}`,
        getRequestHeaders,
        method: "DELETE",
        headers: { "x-workspace-id": workspaceId },
      });
      if (res.ok) await load();
    },
    [apiOrigin, getRequestHeaders, workspaceId, load]
  );

  const runNow = useCallback(
    async (id: string): Promise<string | undefined> => {
      if (!workspaceId) return undefined;
      const res = await apiFetch({
        apiOrigin,
        path: `/api/automations/${encodeURIComponent(id)}/execute`,
        getRequestHeaders,
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({}),
      });
      let threadId: string | undefined;
      if (res.ok) {
        try {
          const j = (await res.json()) as { threadId?: string };
          if (typeof j.threadId === "string") threadId = j.threadId;
        } catch {
          /* ignore */
        }
      }
      await load();
      return threadId;
    },
    [apiOrigin, getRequestHeaders, workspaceId, load]
  );

  return { automations, loading, error, load, remove, runNow };
}
