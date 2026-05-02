import { useEffect, useRef, useState } from "react";
import { joinApiOrigin, mergeRequestHeaders, type GetRequestHeaders } from "@kletron/shared";

/** Minimal skill row for the slash palette (from GET /api/skills). */
export type SlashSkillRow = { slug: string; description: string; name?: string };

/**
 * Loads the skills library for slash-command autocomplete (GET /api/skills).
 * Pass `workspaceId` when a workspace is active so repo-native `.kletron/skills` entries are merged in.
 * Uses the same origin / auth pattern as useAgentSession / useSessionStream.
 */
export function useSlashSkills(options: {
  apiOrigin?: string;
  getRequestHeaders?: GetRequestHeaders;
  /** When false, skips fetch (default true). */
  enabled?: boolean;
  /** When set, includes merged skills from this workspace’s `.kletron/skills` on disk. */
  workspaceId?: string | null;
}): { skills: SlashSkillRow[] } {
  const getRequestHeadersRef = useRef(options.getRequestHeaders);
  getRequestHeadersRef.current = options.getRequestHeaders;
  const enabled = options.enabled !== false;

  const [skills, setSkills] = useState<SlashSkillRow[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const headers = await mergeRequestHeaders(getRequestHeadersRef.current);
        const params = new URLSearchParams({ limit: "200" });
        if (options.workspaceId) params.set("workspaceId", options.workspaceId);
        const url = joinApiOrigin(options.apiOrigin, `/api/skills?${params.toString()}`);
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { skills?: SlashSkillRow[] };
        if (!cancelled) setSkills(Array.isArray(data.skills) ? data.skills : []);
      } catch {
        if (!cancelled) setSkills([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [options.apiOrigin, options.workspaceId, enabled]);

  return { skills };
}
