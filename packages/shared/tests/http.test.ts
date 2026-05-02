import { describe, expect, it } from "vitest";
import { joinApiOrigin, mergeRequestHeaders } from "../src/api/http";

describe("joinApiOrigin", () => {
  it("returns path when apiOrigin is undefined", () => {
    expect(joinApiOrigin(undefined, "/api/foo")).toBe("/api/foo");
  });

  it("returns path when apiOrigin is empty string", () => {
    expect(joinApiOrigin("", "/api/foo")).toBe("/api/foo");
  });

  it("strips trailing slash from origin", () => {
    expect(joinApiOrigin("https://app.example.com/", "/api/foo")).toBe("https://app.example.com/api/foo");
  });

  it("joins origin without trailing slash", () => {
    expect(joinApiOrigin("https://app.example.com", "/api/foo")).toBe("https://app.example.com/api/foo");
  });

  it("prefixes path without leading slash", () => {
    expect(joinApiOrigin("https://x.com", "api/foo")).toBe("https://x.com/api/foo");
  });
});

describe("mergeRequestHeaders", () => {
  it("returns empty object when fn omitted", async () => {
    expect(await mergeRequestHeaders()).toEqual({});
  });

  it("merges async headers", async () => {
    const h = await mergeRequestHeaders(async () => ({
      Authorization: "Bearer x",
      "x-workspace-id": "w1",
    }));
    expect(h.Authorization).toBe("Bearer x");
    expect(h["x-workspace-id"]).toBe("w1");
  });
});
