import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  gitScopePrefixFromPaths,
  isRepoPathInGitScope,
} from "../src/gitWorkspaceScope";

describe("gitScopePrefixFromPaths", () => {
  it("returns null when workspace is the repo root", () => {
    expect(gitScopePrefixFromPaths("/a/repo", "/a/repo")).toBeNull();
  });

  it("returns posix-style prefix for a nested workspace", () => {
    const root = path.resolve("/projects/mono");
    const ws = path.resolve("/projects/mono/business/app");
    expect(gitScopePrefixFromPaths(root, ws)).toBe("business/app");
  });

  it("returns null when workspace is outside git root", () => {
    expect(gitScopePrefixFromPaths("/a/repo", "/other/out")).toBeNull();
  });
});

describe("isRepoPathInGitScope", () => {
  const scope = "business";

  it("allows all paths when scope is null", () => {
    expect(isRepoPathInGitScope("apps/web/foo.tsx", null)).toBe(true);
  });

  it("includes paths under the prefix", () => {
    expect(isRepoPathInGitScope("business/src/index.ts", scope)).toBe(true);
    expect(isRepoPathInGitScope("business", scope)).toBe(true);
  });

  it("excludes sibling folders (monorepo confusion)", () => {
    expect(isRepoPathInGitScope("apps/web/page.tsx", scope)).toBe(false);
    expect(isRepoPathInGitScope("other/pkg/x.ts", scope)).toBe(false);
  });

  it("does not prefix-match shorter sibling names", () => {
    expect(isRepoPathInGitScope("business-other/file.ts", scope)).toBe(false);
  });
});
