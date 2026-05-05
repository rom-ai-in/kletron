import { describe, expect, it } from "vitest";
import { deriveThreadContextFootprint } from "../threadContextFootprint";

describe("deriveThreadContextFootprint", () => {
  it("uses assistant invocations (read_file) for filesRead", () => {
    const fp = deriveThreadContextFootprint([
      {
        kind: "assistant",
        toolName: "read_file",
        toolCallId: "c1",
        toolArgs: { filePath: "/src/app.tsx" },
      },
    ]);
    expect(fp.toolInvocations).toBe(1);
    expect(fp.filesRead).toEqual(["/src/app.tsx"]);
  });

  it("merges args from assistant call and tool result by toolCallId", () => {
    const fp = deriveThreadContextFootprint([
      {
        kind: "assistant",
        toolName: "read_file",
        toolCallId: "c1",
        toolArgs: {},
      },
      {
        kind: "tool",
        toolName: "read_file",
        toolCallId: "c1",
        toolArgs: { filePath: "/merged.ts" },
      },
    ]);
    expect(fp.toolInvocations).toBe(1);
    expect(fp.filesRead).toEqual(["/merged.ts"]);
  });

  it("unwraps nested input.arguments for paths", () => {
    const fp = deriveThreadContextFootprint([
      {
        kind: "assistant",
        toolName: "read_file",
        toolArgs: { input: { filePath: "/nested.rs" } },
      },
    ]);
    expect(fp.filesRead).toEqual(["/nested.rs"]);
  });

  it("lists semantic search scope path under filesRead when present", () => {
    const fp = deriveThreadContextFootprint([
      {
        kind: "assistant",
        toolName: "semantic_code_search",
        toolArgs: { query: "foo", target_directory: "/packages/ui" },
      },
    ]);
    expect(fp.searchQueries.length).toBeGreaterThan(0);
    expect(fp.filesRead).toContain("/packages/ui");
  });
});
