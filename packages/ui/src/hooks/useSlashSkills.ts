import { useEffect, useRef, useState } from "react";
import { joinApiOrigin, mergeRequestHeaders, type GetRequestHeaders } from "@kletron/shared";

/** Minimal skill row for the slash palette (from GET /api/skills). */
export type SlashSkillRow = { slug: string; description: string; name?: string };

/**
 * Loads the global skills library for slash-command autocomplete.
 * Uses the same origin / auth pattern as useAgentSession / useSessionStream.
 */
export function useSlashSkills(options: {
  apiOrigin?: string;
  getRequestHeaders?: GetRequestHeaders;
  /** When false, skips fetch (default true). */
  enabled?: boolean;
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
        const url = joinApiOrigin(options.apiOrigin, "/api/skills?limit=200");
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
  }, [options.apiOrigin, enabled]);

  return { skills };
}
