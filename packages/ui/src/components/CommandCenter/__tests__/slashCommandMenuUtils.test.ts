import { describe, it, expect } from "vitest";
import {
  filterSlashCommandItems,
  normalizeSlashQuery,
  slashItemMatchesQuery,
} from "../slashCommandMenuUtils";

describe("normalizeSlashQuery", () => {
  it("strips leading slash and lowercases", () => {
    expect(normalizeSlashQuery("/Foo")).toBe("foo");
    expect(normalizeSlashQuery("//bar")).toBe("/bar");
  });
});

describe("slashItemMatchesQuery", () => {
  const item = { id: "skill-canvas", label: "canvas", description: "React canvas" };

  it("matches empty query", () => {
    expect(slashItemMatchesQuery(item, "")).toBe(true);
  });

  it("matches label, id, description", () => {
    expect(slashItemMatchesQuery(item, "can")).toBe(true);
    expect(slashItemMatchesQuery(item, "skill")).toBe(true);
    expect(slashItemMatchesQuery(item, "react")).toBe(true);
    expect(slashItemMatchesQuery(item, "zzz")).toBe(false);
  });
});

describe("filterSlashCommandItems", () => {
  const items = [
    { id: "a", label: "alpha", description: "one" },
    { id: "b", label: "beta", description: "two" },
  ];

  it("returns all when filter is empty or only slash", () => {
    expect(filterSlashCommandItems(items, "").length).toBe(2);
    expect(filterSlashCommandItems(items, "/").length).toBe(2);
  });

  it("filters by substring", () => {
    expect(filterSlashCommandItems(items, "/bet").map((i) => i.id)).toEqual(["b"]);
    expect(filterSlashCommandItems(items, "one").map((i) => i.id)).toEqual(["a"]);
  });
});
