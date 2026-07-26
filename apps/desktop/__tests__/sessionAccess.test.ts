import { describe, expect, it } from "vitest";
import { isSessionUnlocked } from "../src/sessionAccess";
import type { SessionStatus } from "../src/types";

const ALL: SessionStatus[] = [
  "unconfigured",
  "signed-out",
  "signing-in",
  "active",
  "refreshing",
  "expired",
  "offline",
];

describe("isSessionUnlocked", () => {
  it("locks the shell for every state without a server-accepted session", () => {
    expect(isSessionUnlocked("signed-out")).toBe(false);
    expect(isSessionUnlocked("expired")).toBe(false);
    expect(isSessionUnlocked("signing-in")).toBe(false);
    expect(isSessionUnlocked("unconfigured")).toBe(false);
  });

  it("keeps the shell mounted while tokens are alive but the network is not", () => {
    // A wifi blip or a token rollover must not evict the user from a running thread.
    expect(isSessionUnlocked("offline")).toBe(true);
    expect(isSessionUnlocked("refreshing")).toBe(true);
  });

  it("unlocks a live session", () => {
    expect(isSessionUnlocked("active")).toBe(true);
  });

  it("classifies every known status (new states must opt in explicitly)", () => {
    const unlocked = ALL.filter(isSessionUnlocked);
    expect(unlocked.sort()).toEqual(["active", "offline", "refreshing"]);
  });
});
