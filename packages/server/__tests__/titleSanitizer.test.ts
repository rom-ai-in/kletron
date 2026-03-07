import { describe, expect, it } from "vitest";
import {
  heuristicTitle,
  sanitizeAssistantVisibleContent,
  sanitizeTitle,
  stripThoughtContent,
} from "@numezis/server/services/titleSanitizer";

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

  it("filters meta reasoning paragraphs from assistant visible content", () => {
    const dirty = [
      "Now, we need to determine if this can make the user a millionaire.",
      "",
      "## Real answer",
      "Use the backtester and validate with out-of-sample windows.",
    ].join("\n");
    expect(sanitizeAssistantVisibleContent(dirty)).toContain("## Real answer");
    expect(sanitizeAssistantVisibleContent(dirty)).not.toContain("Now, we need to determine");
  });

  it("removes repeated long paragraphs in assistant visible content", () => {
    const paragraph = "This is a long paragraph that explains the same result with enough characters to trigger deduplication logic safely.";
    const dirty = `${paragraph}\n\n${paragraph}\n\nShort note`;
    const cleaned = sanitizeAssistantVisibleContent(dirty);
    expect((cleaned.match(/This is a long paragraph/g) || []).length).toBe(1);
    expect(cleaned).toContain("Short note");
  });
});
