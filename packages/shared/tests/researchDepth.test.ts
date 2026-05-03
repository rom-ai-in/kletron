import { describe, it, expect } from "vitest";
import { normalizeResearchDepth } from "../src/researchDepth";

describe("normalizeResearchDepth", () => {
    it("defaults unknown to exhaustive", () => {
        expect(normalizeResearchDepth(undefined)).toBe("exhaustive");
        expect(normalizeResearchDepth(null)).toBe("exhaustive");
        expect(normalizeResearchDepth("")).toBe("exhaustive");
        expect(normalizeResearchDepth("nope")).toBe("exhaustive");
    });

    it("accepts canonical ids", () => {
        expect(normalizeResearchDepth("fast")).toBe("fast");
        expect(normalizeResearchDepth("exhaustive")).toBe("exhaustive");
    });

    it("accepts aliases", () => {
        expect(normalizeResearchDepth("FAST")).toBe("fast");
        expect(normalizeResearchDepth("quick")).toBe("fast");
        expect(normalizeResearchDepth("speed")).toBe("fast");
    });
});
