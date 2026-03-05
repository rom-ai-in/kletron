import { describe, expect, it } from "vitest";
import { heuristicTitle, sanitizeTitle, stripThoughtContent } from "@numezis/server/services/titleSanitizer";

describe("titleSanitizer", () => {
  it("removes think blocks and prompt leakage content", () => {
    const dirty = `<think>internal chain of thought</think> Respond with ONLY the title, nothing else`;
    expect(stripThoughtContent(dirty)).toBe("");
  });

  it("sanitizes model output down to a short clean title", () => {
    const dirty = `Test Message.\nNo punctuation`;
    expect(sanitizeTitle(dirty)).toBe("Test Message No punctuation");
  });

  it("falls back to a clean heuristic title", () => {
    const title = heuristicTitle(`We need to produce a short chat title. user said test`);
    expect(title).toBe("Untitled");
  });
});
