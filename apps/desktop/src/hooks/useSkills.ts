import { useState, useCallback } from "react";
import type { Skill } from "../types";

const SKILLS_STORAGE_KEY = "kletron.desktop.skills";

export function useSkills(
  backendUrlTrimmed: string,
  backendReady: boolean,
  getAccessToken: () => Promise<string | null>
) {
  const [skills, setSkills] = useState<Skill[]>(() => {
    try {
      const stored = localStorage.getItem(SKILLS_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Skill[];
    } catch {
      // ignore
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  function persistSkills(list: Skill[]) {
    try {
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  const loadSkills = useCallback(async () => {
    if (!backendReady) return;
    const token = await getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrlTrimmed}/api/tools/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const tools = Array.isArray(data) ? data : data?.tools ?? [];
      // Filter for skill-type tools
      const skillTools: Skill[] = tools
        .filter((t: any) => t.name?.startsWith("load_skill") || t.name?.startsWith("list_skills") || t.isSkill)
        .map((t: any) => ({
          id: t.name ?? t.id,
          name: t.name ?? "Unknown",
          description: t.description ?? "",
          enabled: true,
          category: "custom" as const,
        }));

      if (skillTools.length > 0) {
        setSkills(skillTools);
        persistSkills(skillTools);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [backendUrlTrimmed, backendReady, getAccessToken]);

  const addSkill = useCallback((name: string) => {
    const newSkill: Skill = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      description: `Custom skill: ${name}`,
      enabled: true,
      category: "custom",
    };
    setSkills((prev) => {
      const next = [...prev, newSkill];
      persistSkills(next);
      return next;
    });
  }, []);

  const removeSkill = useCallback((skillId: string) => {
    setSkills((prev) => {
      const next = prev.filter((s) => s.id !== skillId);
      persistSkills(next);
      return next;
    });
  }, []);

  const toggleSkill = useCallback((skillId: string, enabled: boolean) => {
    setSkills((prev) => {
      const next = prev.map((s) => (s.id === skillId ? { ...s, enabled } : s));
      persistSkills(next);
      return next;
    });
  }, []);

  return {
    skills,
    loading,
    loadSkills,
    addSkill,
    removeSkill,
    toggleSkill,
  };
}
