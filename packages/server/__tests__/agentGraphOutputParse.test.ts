import { describe, it, expect } from "vitest";

import { parseJsonOutput, stripCodeFences } from "@kletron/server/services/agentGraphUtils";

describe("agentGraphUtils.stripCodeFences", () => {
    it("removes markdown json fences", () => {
        const input = "```json\n{\"a\":1}\n```";
        expect(stripCodeFences(input)).toBe("{\"a\":1}");
    });

    it("removes generic code fences", () => {
        const input = "```\n{\"a\":1}\n```";
        expect(stripCodeFences(input)).toBe("{\"a\":1}");
    });
});

describe("agentGraphUtils.parseJsonOutput", () => {
    it("parses plain JSON", () => {
        expect(parseJsonOutput("{\"a\":1}")).toEqual({ a: 1 });
    });

    it("parses fenced JSON", () => {
        expect(parseJsonOutput("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
    });

    it("returns a structured fallback when text is not JSON (graph continues instead of hard-failing)", () => {
        const out = parseJsonOutput("not json") as Record<string, unknown>;
        expect(out._parseError).toBe(true);
        expect(typeof out._errorMessage).toBe("string");
        expect(out._rawContent).toBe("not json");
    });
});

