import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedSkillRecord } from "@kletron/shared/skills/types";
import {
    applySkillSlashPreflight,
    mergeLoadedSkillIds,
    preflightMissionForNewRun,
} from "../src/services/skillSlashPreflight";
import * as skillsService from "../src/services/skillsService";

vi.mock("../src/services/skillsService", () => ({
    resolveWorkspaceSkills: vi.fn(),
}));

describe("mergeLoadedSkillIds", () => {
    it("dedupes while preserving first-seen order", () => {
        expect(mergeLoadedSkillIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    });
});

describe("applySkillSlashPreflight", () => {
    beforeEach(() => {
        vi.mocked(skillsService.resolveWorkspaceSkills).mockReset();
    });

    it("returns no-op for non-slash messages", async () => {
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([]);
        const r = await applySkillSlashPreflight("hello", "ws1");
        expect(r).toEqual({ mission: "hello", loadedSkillIdsToAppend: [] });
    });

    it("does not treat reserved commands as skills", async () => {
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([]);
        const r = await applySkillSlashPreflight("/plan do something", "ws1");
        expect(r.mission).toBe("/plan do something");
        expect(r.loadedSkillIdsToAppend).toEqual([]);
    });

    it("strips enabled skill and returns rest as mission", async () => {
        const analyze: ResolvedSkillRecord = {
            slug: "analyze",
            name: "Analyze",
            version: "1.0.0",
            description: "d",
            tags: [],
            requiredTools: [],
            suggestedTools: [],
            extends: [],
            body: "",
            source: "user",
            createdAt: "",
            updatedAt: "",
            resolvedSystemPrompt: "",
            resolvedTools: [],
            extendsChain: ["analyze"],
        };
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([analyze]);
        const r = await applySkillSlashPreflight("/analyze the repo", "ws1");
        expect(r.mission).toBe("the repo");
        expect(r.loadedSkillIdsToAppend).toEqual(["analyze"]);
    });

    it("leaves message unchanged when skill is not workspace-enabled", async () => {
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([]);
        const r = await applySkillSlashPreflight("/analyze only", "ws1");
        expect(r.mission).toBe("/analyze only");
        expect(r.loadedSkillIdsToAppend).toEqual([]);
    });

    it("uses full trimmed message as mission when slash has no rest", async () => {
        const analyze: ResolvedSkillRecord = {
            slug: "analyze",
            name: "Analyze",
            version: "1.0.0",
            description: "d",
            tags: [],
            requiredTools: [],
            suggestedTools: [],
            extends: [],
            body: "",
            source: "user",
            createdAt: "",
            updatedAt: "",
            resolvedSystemPrompt: "",
            resolvedTools: [],
            extendsChain: ["analyze"],
        };
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([analyze]);
        const r = await applySkillSlashPreflight("  /analyze  ", "ws1");
        expect(r.mission).toBe("/analyze");
        expect(r.loadedSkillIdsToAppend).toEqual(["analyze"]);
    });
});

describe("preflightMissionForNewRun", () => {
    beforeEach(() => {
        vi.mocked(skillsService.resolveWorkspaceSkills).mockReset();
    });

    it("returns loadedSkillIds and skillLoads for slash match", async () => {
        const analyze: ResolvedSkillRecord = {
            slug: "analyze",
            name: "Analyze",
            version: "1.0.0",
            description: "d",
            tags: [],
            requiredTools: [],
            suggestedTools: [],
            extends: [],
            body: "",
            source: "user",
            createdAt: "",
            updatedAt: "",
            resolvedSystemPrompt: "",
            resolvedTools: [],
            extendsChain: ["analyze"],
        };
        vi.mocked(skillsService.resolveWorkspaceSkills).mockResolvedValue([analyze]);
        const r = await preflightMissionForNewRun("/analyze go", "ws");
        expect(r.mission).toBe("go");
        expect(r.loadedSkillIds).toEqual(["analyze"]);
        expect(r.skillLoads).toHaveLength(1);
        expect(r.skillLoads[0]?.slug).toBe("analyze");
        expect(r.skillLoads[0]?.reason).toBe("slash_preflight");
    });
});
