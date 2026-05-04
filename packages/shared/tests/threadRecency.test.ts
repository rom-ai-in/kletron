import { describe, expect, it } from "vitest";
import {
  calendarDaysFromEarlierToLater,
  parseThreadRecencyMs,
  threadRecencyBucket,
  THREAD_RECENCY_LABELS,
  THREAD_RECENCY_SECTION_ORDER,
} from "../src/threadRecency";

describe("THREAD_RECENCY_SECTION_ORDER", () => {
  it("lists buckets in UI order", () => {
    expect(THREAD_RECENCY_SECTION_ORDER).toEqual([
      "today",
      "yesterday",
      "last7",
      "last30",
      "older",
      "missing",
    ]);
  });

  it("has a label for every bucket", () => {
    for (const b of THREAD_RECENCY_SECTION_ORDER) {
      expect(THREAD_RECENCY_LABELS[b].length).toBeGreaterThan(0);
    }
  });
});

describe("calendarDaysFromEarlierToLater", () => {
  it("returns 0 on the same local calendar day", () => {
    const earlier = new Date(2026, 4, 3, 10, 0);
    const later = new Date(2026, 4, 3, 23, 0);
    expect(calendarDaysFromEarlierToLater(earlier, later)).toBe(0);
  });

  it("returns 1 across midnight", () => {
    const earlier = new Date(2026, 4, 2, 23, 0);
    const later = new Date(2026, 4, 3, 1, 0);
    expect(calendarDaysFromEarlierToLater(earlier, later)).toBe(1);
  });
});

describe("threadRecencyBucket", () => {
  const now = new Date(2026, 4, 3, 15, 0, 0); // May 3, 2026 15:00 local

  it("returns missing for empty or invalid input", () => {
    expect(threadRecencyBucket(undefined, now)).toBe("missing");
    expect(threadRecencyBucket(null, now)).toBe("missing");
    expect(threadRecencyBucket("", now)).toBe("missing");
    expect(threadRecencyBucket("not-a-date", now)).toBe("missing");
  });

  it("classifies today", () => {
    expect(threadRecencyBucket(new Date(2026, 4, 3, 9, 0).toISOString(), now)).toBe("today");
  });

  it("classifies yesterday", () => {
    expect(threadRecencyBucket(new Date(2026, 4, 2, 20, 0).toISOString(), now)).toBe("yesterday");
  });

  it("classifies last7 as calendar offsets 2–6", () => {
    expect(threadRecencyBucket(new Date(2026, 4, 1, 12, 0).toISOString(), now)).toBe("last7");
    expect(threadRecencyBucket(new Date(2026, 3, 28, 12, 0).toISOString(), now)).toBe("last7");
  });

  it("classifies last30 as calendar offsets 7–29", () => {
    expect(threadRecencyBucket(new Date(2026, 3, 26, 12, 0).toISOString(), now)).toBe("last30");
    expect(threadRecencyBucket(new Date(2026, 3, 4, 12, 0).toISOString(), now)).toBe("last30");
  });

  it("classifies older as 30+ calendar days", () => {
    expect(threadRecencyBucket(new Date(2026, 3, 3, 12, 0).toISOString(), now)).toBe("older");
  });

  it("treats future timestamps as today", () => {
    expect(threadRecencyBucket(new Date(2026, 4, 10, 12, 0).toISOString(), now)).toBe("today");
  });
});

describe("parseThreadRecencyMs", () => {
  it("returns null for invalid input", () => {
    expect(parseThreadRecencyMs(undefined)).toBeNull();
    expect(parseThreadRecencyMs("")).toBeNull();
    expect(parseThreadRecencyMs("bad")).toBeNull();
  });

  it("returns epoch ms for valid ISO", () => {
    const iso = "2026-05-01T12:00:00.000Z";
    expect(parseThreadRecencyMs(iso)).toBe(new Date(iso).getTime());
  });
});
