import { describe, it, expect } from "vitest";
import { workModeStorageValuesMatching } from "../src/workMode";

describe("workModeStorageValuesMatching", () => {
  it("includes canonical id and every legacy alias for work", () => {
    const w = workModeStorageValuesMatching("work");
    expect(w).toContain("work");
    expect(w).toContain("drafting");
    expect(w).toContain("automation");
    expect(w).toContain("general");
    expect(w).not.toContain("code");
    expect(w).not.toContain("coding");
  });

  it("includes canonical id and legacy coding alias for code", () => {
    const c = workModeStorageValuesMatching("code");
    expect(c).toContain("code");
    expect(c).toContain("coding");
    expect(c).not.toContain("work");
    expect(c).not.toContain("drafting");
  });
});
