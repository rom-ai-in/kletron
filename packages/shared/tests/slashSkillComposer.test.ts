import { describe, expect, it } from "vitest";
import {
  composeMessageWithSlashSkillChips,
  stripLeadingSlashSkillSlugs,
} from "../src/slashSkillComposer";

describe("stripLeadingSlashSkillSlugs", () => {
  it("parses one slug", () => {
    expect(stripLeadingSlashSkillSlugs("/memory-management hello")).toEqual({
      slugs: ["memory-management"],
      rest: "hello",
    });
  });

  it("parses several slugs", () => {
    expect(stripLeadingSlashSkillSlugs("/a /b tail")).toEqual({
      slugs: ["a", "b"],
      rest: "tail",
    });
  });

  it("returns empty when no leading token", () => {
    expect(stripLeadingSlashSkillSlugs("hello /a")).toEqual({
      slugs: [],
      rest: "hello /a",
    });
  });
});

describe("composeMessageWithSlashSkillChips", () => {
  it("merges chips with typed leading slugs without duplicating", () => {
    const chips = [{ id: "skill:memory-management" }];
    expect(composeMessageWithSlashSkillChips("/memory-management do X", chips)).toBe(
      "/memory-management do X",
    );
  });

  it("adds chip slugs before typed-only slugs", () => {
    const chips = [{ id: "skill:a" }];
    expect(composeMessageWithSlashSkillChips("/b c", chips)).toBe("/a /b c");
  });

  it("falls back to raw body when no chips and no leading slugs", () => {
    expect(composeMessageWithSlashSkillChips("plain", [])).toBe("plain");
  });
});
