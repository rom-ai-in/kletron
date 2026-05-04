import { describe, expect, it } from "vitest";
import {
    composeSkillMarkdown,
    skillCreateSchema,
    skillFrontmatterSchema,
} from "../src/skills/types";

describe("skillFrontmatterSchema", () => {
    it("accepts a minimal frontmatter", () => {
        const result = skillFrontmatterSchema.safeParse({ name: "Research" });
        expect(result.success).toBe(true);
    });

    it("requires a name", () => {
        const result = skillFrontmatterSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it("rejects invalid version format", () => {
        const result = skillFrontmatterSchema.safeParse({
            name: "x",
            version: "v1",
        });
        expect(result.success).toBe(false);
    });

    it("accepts a tagged skill", () => {
        const result = skillFrontmatterSchema.safeParse({
            name: "Research",
            version: "1.2.3",
            tags: ["research", "drafting"],
            requiredTools: ["fetch_url"],
        });
        expect(result.success).toBe(true);
    });
});

describe("skillCreateSchema", () => {
    it("requires kebab-case slug", () => {
        const result = skillCreateSchema.safeParse({
            slug: "Bad Slug",
            frontmatter: { name: "X" },
            body: "",
        });
        expect(result.success).toBe(false);
    });

    it("accepts a valid skill", () => {
        const result = skillCreateSchema.parse({
            slug: "my-skill",
            frontmatter: { name: "My Skill", version: "1.0.0" },
            body: "Hello",
        });
        expect(result.slug).toBe("my-skill");
        expect(result.body).toBe("Hello");
    });
});

describe("composeSkillMarkdown", () => {
    it("renders a SKILL.md document", () => {
        const md = composeSkillMarkdown({
            name: "Research",
            version: "1.2.3",
            description: "Web research",
            tags: ["research"],
            requiredTools: ["fetch_url"],
            suggestedTools: [],
            extends: [],
            body: "Body text",
        });
        expect(md.startsWith("---")).toBe(true);
        expect(md).toContain("name: Research");
        expect(md).toContain("version: 1.2.3");
        expect(md).toContain("- fetch_url");
        expect(md).toContain("Body text");
    });
});
