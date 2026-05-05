import type {
    SkillRecord,
    ThreadAvailableSkillSummary,
    ThreadLoadedSkillSummary,
    ThreadPinnedSkillSummary,
    ThreadSkillState,
    WorkspaceSkillAvailabilitySource,
    WorkspaceSkillRecord,
    WorkspaceSkillView,
} from "@kletron/shared/skills/types";

import type { AgentGraphDefinition, AgentGraphState } from "./agentGraphTypes";
import { getWorkspaceByIdUnsafe } from "./workspaceService";
import { listWorkspaceSkillRecords } from "./workspaceSkillFiles";
import { getSkillBySlug, listSkills, listWorkspaceSkills } from "./skillsService";

function sortByName<T extends { name: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function availabilitySourceFor(
    explicitlyEnabled: boolean,
    repoNativePresent: boolean,
): WorkspaceSkillAvailabilitySource {
    if (explicitlyEnabled && repoNativePresent) return "both";
    if (explicitlyEnabled) return "activation";
    if (repoNativePresent) return "repo_native";
    return "none";
}

function toThreadAvailableSkillSummary(skill: WorkspaceSkillView): ThreadAvailableSkillSummary {
    return {
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        availabilitySource: skill.availabilitySource,
        autoLoadInNewThreads: skill.autoLoadInNewThreads,
    };
}

type WorkspaceSkillStateContext = {
    workspaceId: string;
    workspaceRootPath?: string;
    ownerId?: string;
};

async function resolveWorkspaceSkillStateContext(workspaceId: string): Promise<WorkspaceSkillStateContext> {
    const workspace = await getWorkspaceByIdUnsafe(workspaceId);
    return {
        workspaceId,
        workspaceRootPath: workspace?.rootPath?.trim() || undefined,
        ownerId: workspace?.ownerId,
    };
}

function mergeSkillLibrary(
    library: SkillRecord[],
    diskRecords: SkillRecord[],
): SkillRecord[] {
    const bySlug = new Map<string, SkillRecord>();
    for (const skill of library) {
        bySlug.set(skill.slug, skill);
    }
    for (const disk of diskRecords) {
        const existing = bySlug.get(disk.slug);
        if (existing?.source === "builtin") continue;
        bySlug.set(disk.slug, { ...disk, source: "user" });
    }
    return sortByName(Array.from(bySlug.values()));
}

export async function listWorkspaceSkillViews(
    workspaceId: string,
    viewerUserId?: string | null,
): Promise<{ workspaceId: string; activations: WorkspaceSkillRecord[]; skills: WorkspaceSkillView[] }> {
    const context = await resolveWorkspaceSkillStateContext(workspaceId);
    const [activations, library, diskRecords] = await Promise.all([
        listWorkspaceSkills(workspaceId),
        listSkills({
            viewerUserId: viewerUserId ?? context.ownerId ?? null,
            ...(context.workspaceRootPath ? { workspaceRootPath: context.workspaceRootPath } : {}),
        }),
        context.workspaceRootPath
            ? listWorkspaceSkillRecords(context.workspaceRootPath).catch(() => [])
            : Promise.resolve([]),
    ]);

    const activationMap = new Map<string, WorkspaceSkillRecord>();
    for (const activation of activations) {
        activationMap.set(activation.skillSlug, activation);
    }
    const diskSet = new Set(diskRecords.map((record) => record.slug));

    const mergedLibrary = mergeSkillLibrary(library, diskRecords);
    const skills = mergedLibrary.map((skill): WorkspaceSkillView => {
        const activation = activationMap.get(skill.slug);
        const explicitlyEnabled = activation?.enabled ?? false;
        const repoNativePresent = diskSet.has(skill.slug);
        const availableInWorkspace = explicitlyEnabled || repoNativePresent;
        return {
            ...skill,
            enabled: availableInWorkspace,
            explicitlyEnabled,
            repoNativePresent,
            availabilitySource: availabilitySourceFor(explicitlyEnabled, repoNativePresent),
            availableInWorkspace,
            autoLoadInNewThreads: Boolean(activation?.autoLoadInNewThreads),
        };
    });

    return { workspaceId, activations, skills };
}

export async function resolveWorkspaceAutoLoadSkillSlugs(workspaceId: string): Promise<string[]> {
    const { skills } = await listWorkspaceSkillViews(workspaceId, null);
    return skills
        .filter((skill) => skill.availableInWorkspace && skill.autoLoadInNewThreads)
        .map((skill) => skill.slug);
}

export async function buildThreadSkillState(input: {
    workspaceId: string;
    graph: AgentGraphDefinition | null;
    state?: Pick<AgentGraphState, "loadedSkillIds" | "skillLoads"> | null;
}): Promise<ThreadSkillState> {
    const { workspaceId, graph, state } = input;
    const context = await resolveWorkspaceSkillStateContext(workspaceId);
    const { skills } = await listWorkspaceSkillViews(workspaceId, null);
    const availableSkills = sortByName(
        skills
            .filter((skill) => skill.availableInWorkspace)
            .map(toThreadAvailableSkillSummary),
    );

    const loadedSkillIds = state?.loadedSkillIds ?? [];
    const loadTrail = new Map(
        ((state?.skillLoads ?? []) as Array<{ slug: string; at?: string; reason?: string }>).map((load) => [
            load.slug,
            load,
        ]),
    );
    const loadedSkills: ThreadLoadedSkillSummary[] = [];
    for (const slug of loadedSkillIds) {
        const available = skills.find((skill) => skill.slug === slug);
        const resolved =
            available ??
            (await getSkillBySlug(slug, {
                ...(context.workspaceRootPath ? { workspaceRootPath: context.workspaceRootPath } : {}),
            }));
        loadedSkills.push({
            slug,
            name: resolved?.name ?? slug,
            loadedAt: loadTrail.get(slug)?.at,
            reason: loadTrail.get(slug)?.reason,
        });
    }

    const pinnedBySlug = new Map<string, ThreadPinnedSkillSummary>();
    for (const node of graph?.nodes ?? []) {
        for (const slug of node.react?.skillIds ?? []) {
            const existing = pinnedBySlug.get(slug);
            if (existing) {
                if (!existing.nodeIds.includes(node.id)) existing.nodeIds.push(node.id);
                if (!existing.nodeLabels.includes(node.label)) existing.nodeLabels.push(node.label);
                continue;
            }
            const available = skills.find((skill) => skill.slug === slug);
            const resolved =
                available ??
                (await getSkillBySlug(slug, {
                    ...(context.workspaceRootPath ? { workspaceRootPath: context.workspaceRootPath } : {}),
                }));
            pinnedBySlug.set(slug, {
                slug,
                name: resolved?.name ?? slug,
                nodeIds: [node.id],
                nodeLabels: [node.label],
            });
        }
    }

    return {
        availableSkills,
        loadedSkills,
        pinnedSkills: sortByName(Array.from(pinnedBySlug.values())),
    };
}
