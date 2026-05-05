import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillRecord, WorkspaceSkillRecord } from "@kletron/shared/skills/types";

const getWorkspaceByIdUnsafe = vi.hoisted(() => vi.fn());
vi.mock("../src/services/workspaceService", () => ({
    getWorkspaceByIdUnsafe: (...args: unknown[]) => getWorkspaceByIdUnsafe(...args),
}));

const listSkills = vi.hoisted(() => vi.fn());
const listWorkspaceSkills = vi.hoisted(() => vi.fn());
const getSkillBySlug = vi.hoisted(() => vi.fn());
vi.mock("../src/services/skillsService", () => ({
    listSkills: (...args: unknown[]) => listSkills(...args),
    listWorkspaceSkills: (...args: unknown[]) => listWorkspaceSkills(...args),
    getSkillBySlug: (...args: unknown[]) => getSkillBySlug(...args),
}));

const listWorkspaceSkillRecords = vi.hoisted(() => vi.fn());
vi.mock("../src/services/workspaceSkillFiles", () => ({
    listWorkspaceSkillRecords: (...args: unknown[]) => listWorkspaceSkillRecords(...args),
}));

import {
    buildThreadSkillState,
    listWorkspaceSkillViews,
    resolveWorkspaceAutoLoadSkillSlugs,
} from "../src/services/workspaceSkillStateService";

function makeSkill(overrides: Partial<SkillRecord> & Pick<SkillRecord, "slug" | "name">): SkillRecord {
    return {
        slug: overrides.slug,
        name: overrides.name,
        version: overrides.version ?? "1.0.0",
        description: overrides.description ?? "",
        tags: overrides.tags ?? [],
        requiredTools: overrides.requiredTools ?? [],
        suggestedTools: overrides.suggestedTools ?? [],
        extends: overrides.extends ?? [],
        body: overrides.body ?? "",
        source: overrides.source ?? "builtin",
        ownerId: overrides.ownerId,
        organizationId: overrides.organizationId,
        author: overrides.author,
        outputFormat: overrides.outputFormat,
        maxToolCalls: overrides.maxToolCalls,
        createdAt: overrides.createdAt ?? new Date("2026-05-05T08:00:00.000Z").toISOString(),
        updatedAt: overrides.updatedAt ?? new Date("2026-05-05T08:00:00.000Z").toISOString(),
    };
}

describe("workspaceSkillStateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getWorkspaceByIdUnsafe.mockResolvedValue({
            _id: "workspace-1",
            ownerId: "user-1",
            rootPath: "/tmp/workspace",
        });
        listWorkspaceSkills.mockResolvedValue([
            {
                workspaceId: "workspace-1",
                skillSlug: "activated-skill",
                enabled: true,
                addedAt: new Date("2026-05-05T08:00:00.000Z").toISOString(),
                autoLoadInNewThreads: true,
            },
            {
                workspaceId: "workspace-1",
                skillSlug: "repo-skill",
                enabled: false,
                addedAt: new Date("2026-05-05T08:01:00.000Z").toISOString(),
                autoLoadInNewThreads: true,
            },
        ] satisfies WorkspaceSkillRecord[]);
        listSkills.mockResolvedValue([
            makeSkill({ slug: "activated-skill", name: "Activated skill", source: "user", ownerId: "user-1" }),
            makeSkill({ slug: "repo-skill", name: "Repo skill", source: "user", ownerId: "user-1" }),
            makeSkill({ slug: "library-only", name: "Library only", source: "builtin" }),
        ]);
        listWorkspaceSkillRecords.mockResolvedValue([
            makeSkill({ slug: "repo-skill", name: "Repo skill", source: "user", ownerId: "user-1" }),
        ]);
        getSkillBySlug.mockResolvedValue(makeSkill({ slug: "pinned-skill", name: "Pinned skill", source: "builtin" }));
    });

    it("derives workspace availability from activations and repo-native files", async () => {
        const result = await listWorkspaceSkillViews("workspace-1", "user-1");
        const bySlug = new Map(result.skills.map((skill) => [skill.slug, skill]));

        expect(bySlug.get("activated-skill")).toMatchObject({
            availableInWorkspace: true,
            explicitlyEnabled: true,
            repoNativePresent: false,
            availabilitySource: "activation",
            autoLoadInNewThreads: true,
        });
        expect(bySlug.get("repo-skill")).toMatchObject({
            availableInWorkspace: true,
            explicitlyEnabled: false,
            repoNativePresent: true,
            availabilitySource: "repo_native",
            autoLoadInNewThreads: true,
        });
        expect(bySlug.get("library-only")).toMatchObject({
            availableInWorkspace: false,
            explicitlyEnabled: false,
            repoNativePresent: false,
            availabilitySource: "none",
            autoLoadInNewThreads: false,
        });
    });

    it("resolves autoload skills from the explicit flag and effective availability", async () => {
        await expect(resolveWorkspaceAutoLoadSkillSlugs("workspace-1")).resolves.toEqual([
            "activated-skill",
            "repo-skill",
        ]);
    });

    it("builds thread skill state with loaded and pinned summaries", async () => {
        const state = await buildThreadSkillState({
            workspaceId: "workspace-1",
            graph: {
                _id: "graph-1" as any,
                name: "Graph",
                createdAt: new Date("2026-05-05T08:00:00.000Z"),
                updatedAt: new Date("2026-05-05T08:00:00.000Z"),
                nodes: [
                    {
                        id: "node-1",
                        label: "Node 1",
                        react: {
                            systemPrompt: "",
                            userPromptTemplate: "",
                            toolNames: [],
                            skillIds: ["pinned-skill", "pinned-skill"],
                        },
                        output: { schemaId: "conversational" },
                    },
                ],
                edges: [],
            },
            state: {
                loadedSkillIds: ["activated-skill"],
                skillLoads: [
                    { slug: "activated-skill", at: "2026-05-05T08:00:00.000Z", reason: "workspace_autoload" },
                ],
            },
        });

        expect(state.loadedSkills).toEqual([
            {
                slug: "activated-skill",
                name: "Activated skill",
                loadedAt: "2026-05-05T08:00:00.000Z",
                reason: "workspace_autoload",
            },
        ]);
        expect(state.pinnedSkills).toEqual([
            {
                slug: "pinned-skill",
                name: "Pinned skill",
                nodeIds: ["node-1"],
                nodeLabels: ["Node 1"],
            },
        ]);
    });
});
