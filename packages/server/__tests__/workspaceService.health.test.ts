import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWorkspaceHealthy,
  validateWorkspaceRoot,
  WorkspaceResolutionError,
  type Workspace,
} from "@kletron/server/services/workspaceService";

const tempDirs: string[] = [];

function makeWorkspace(rootPath: string): Workspace {
  const now = new Date();
  return {
    name: "temp-workspace",
    rootPath,
    createdAt: now,
    updatedAt: now,
  };
}

describe("workspaceService health", () => {
  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("returns healthy for existing directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-health-"));
    tempDirs.push(dir);
    const result = validateWorkspaceRoot(makeWorkspace(dir));
    expect(result.status).toBe("healthy");
  });

  it("returns missing for non-existing directory", () => {
    const dir = path.join(os.tmpdir(), "workspace-health-missing-dir");
    const result = validateWorkspaceRoot(makeWorkspace(dir));
    expect(result.status).toBe("missing");
  });

  it("throws structured resolution error for missing directory", () => {
    const dir = path.join(os.tmpdir(), "workspace-health-missing-dir-2");
    expect(() => assertWorkspaceHealthy(makeWorkspace(dir))).toThrowError(WorkspaceResolutionError);
    try {
      assertWorkspaceHealthy(makeWorkspace(dir));
    } catch (error) {
      const resolved = error as WorkspaceResolutionError;
      expect(resolved.code).toBe("WORKSPACE_PATH_MISSING");
      expect(resolved.status).toBe(422);
      expect(resolved.payload.action).toBe("select_or_fix_workspace");
    }
  });
});
