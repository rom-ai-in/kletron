"use client";

import { useCallback, useEffect, useState } from "react";
import type {
    SkillCreateInput,
    SkillRecord,
    SkillUpdateInput,
} from "@kletron/shared";

interface ListResponse {
    skills: SkillRecord[];
}

export interface SkillsLibraryState {
    skills: SkillRecord[];
    /**
     * When `workspaceId` was set on fetch: slugs the agent can use for that workspace
     * (repo files + activations). Same source as GET /api/skills?executable=1.
     */
    executableSlugsForWorkspace: string[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createSkill: (input: SkillCreateInput) => Promise<SkillRecord>;
    updateSkill: (slug: string, input: SkillUpdateInput) => Promise<SkillRecord>;
    deleteSkill: (slug: string) => Promise<void>;
}

const API_BASE = "/api/skills";

export function useSkillsLibrary(options: {
    search?: string;
    tag?: string;
    /** When set, lists/reads/writes repo-native skills under `.kletron/skills` for this workspace. */
    workspaceId?: string | null;
} = {}): SkillsLibraryState {
    const [skills, setSkills] = useState<SkillRecord[]>([]);
    const [executableSlugsForWorkspace, setExecutableSlugsForWorkspace] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (options.search) params.set("search", options.search);
            if (options.tag) params.set("tag", options.tag);
            if (options.workspaceId) params.set("workspaceId", options.workspaceId);

            const libReq = fetch(`${API_BASE}?${params.toString()}`);
            const execReq = options.workspaceId
                ? fetch(
                      `${API_BASE}?${new URLSearchParams({
                          workspaceId: options.workspaceId,
                          executable: "1",
                      }).toString()}`
                  )
                : Promise.resolve(null as Response | null);

            const [libRes, execRes] = await Promise.all([libReq, execReq]);
            if (!libRes.ok) throw new Error(`Failed to load skills (${libRes.status})`);
            const data = (await libRes.json()) as ListResponse;
            setSkills(data.skills ?? []);

            if (execRes && execRes.ok) {
                const execData = (await execRes.json()) as ListResponse;
                setExecutableSlugsForWorkspace(
                    (execData.skills ?? []).map((s) => s.slug).filter(Boolean)
                );
            } else {
                setExecutableSlugsForWorkspace([]);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [options.search, options.tag, options.workspaceId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createSkill = useCallback(async (input: SkillCreateInput) => {
        const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...input,
                ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
            }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? `Failed to create skill (${res.status})`);
        }
        const json = await res.json();
        await refresh();
        return json.skill as SkillRecord;
    }, [refresh, options.workspaceId]);

    const updateSkill = useCallback(async (slug: string, input: SkillUpdateInput) => {
        const q = options.workspaceId
            ? `?workspaceId=${encodeURIComponent(options.workspaceId)}`
            : "";
        const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}${q}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? `Failed to update skill (${res.status})`);
        }
        const json = await res.json();
        await refresh();
        return json.skill as SkillRecord;
    }, [refresh, options.workspaceId]);

    const deleteSkill = useCallback(async (slug: string) => {
        const q = options.workspaceId
            ? `?workspaceId=${encodeURIComponent(options.workspaceId)}`
            : "";
        const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}${q}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? `Failed to delete skill (${res.status})`);
        }
        await refresh();
    }, [refresh, options.workspaceId]);

    return {
        skills,
        executableSlugsForWorkspace,
        isLoading,
        error,
        refresh,
        createSkill,
        updateSkill,
        deleteSkill,
    };
}
