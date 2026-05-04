import { describe, expect, it } from "vitest";
import type { ConversationHistoryItem } from "../src/types";
import {
  mergePreferredIntoSessionList,
  pickConversationIdAfterLoad,
  provisionalTitleFromUserMessage,
} from "../src/utils/threadListMerge";

describe("provisionalTitleFromUserMessage", () => {
  it("uses first line and caps length", () => {
    expect(provisionalTitleFromUserMessage("Hello world")).toBe("Hello world");
    expect(provisionalTitleFromUserMessage("Line one\nLine two")).toBe("Line one");
    expect(provisionalTitleFromUserMessage("  \n  ")).toBe("New chat");
    expect(provisionalTitleFromUserMessage(undefined)).toBe("New chat");
    const long = "x".repeat(120);
    expect(provisionalTitleFromUserMessage(long).length).toBeLessThanOrEqual(100);
    expect(provisionalTitleFromUserMessage(long).endsWith("…")).toBe(true);
  });
});

describe("mergePreferredIntoSessionList", () => {
  const a: ConversationHistoryItem = { id: "a", title: "Alpha", lastRole: "assistant" };
  const b: ConversationHistoryItem = { id: "b", title: "Beta", lastRole: "user" };

  it("returns active unchanged when preferred is absent", () => {
    expect(mergePreferredIntoSessionList([a, b], undefined, { prevThreads: [] })).toEqual([a, b]);
  });

  it("returns active unchanged when preferred already in list", () => {
    expect(mergePreferredIntoSessionList([a, b], "b", { prevThreads: [] })).toEqual([a, b]);
  });

  it("prepends placeholder when preferred missing from API list", () => {
    const merged = mergePreferredIntoSessionList([a], "new-id", {
      provisionalTitle: "Fix the bug",
      prevThreads: [],
    });
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "new-id",
      title: "Fix the bug",
      lastRole: "user",
    });
    expect(merged[1]).toEqual(a);
  });

  it("reuses previous row title when re-merging before API catches up", () => {
    const prev: ConversationHistoryItem[] = [
      { id: "new-id", title: "Fix the bug", lastRole: "user" },
      a,
    ];
    const merged = mergePreferredIntoSessionList([a], "new-id", {
      provisionalTitle: "ignored",
      prevThreads: prev,
    });
    expect(merged[0]).toMatchObject({ id: "new-id", title: "Fix the bug" });
  });
});

describe("desktop first-message race (merge + pick)", () => {
  it("keeps the new session selected when the API list has not caught up yet", () => {
    const apiList: ConversationHistoryItem[] = [{ id: "older", title: "Old thread", lastRole: "assistant" }];
    const preferredId = "brand-new-session";
    const merged = mergePreferredIntoSessionList(apiList, preferredId, {
      provisionalTitle: "Ship the feature",
      prevThreads: [],
    });
    expect(merged.some((t) => t.id === preferredId)).toBe(true);
    expect(pickConversationIdAfterLoad(merged, preferredId, null)).toBe(preferredId);
  });
});

describe("pickConversationIdAfterLoad", () => {
  const rows: ConversationHistoryItem[] = [
    { id: "x", title: "One" },
    { id: "y", title: "Two" },
  ];

  it("prefers explicit preferredId when present in merged", () => {
    expect(pickConversationIdAfterLoad(rows, "y", "x")).toBe("y");
  });

  it("keeps current when preferred not in merged but current is", () => {
    expect(pickConversationIdAfterLoad(rows, "missing", "y")).toBe("y");
  });

  it("returns null for empty merged list (no stealing first thread)", () => {
    expect(pickConversationIdAfterLoad([], "new-session", null)).toBe(null);
  });

  it("returns null when current id is not in merged (e.g. filtered by work mode)", () => {
    expect(pickConversationIdAfterLoad(rows, undefined, "gone")).toBe(null);
  });

  it("can skip auto-selecting the first row after mode switch", () => {
    expect(pickConversationIdAfterLoad(rows, undefined, null, { skipAutoSelectFirst: true })).toBe(null);
  });
});
