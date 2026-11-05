import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createRuntime, type PlatformRuntime } from "../src/runtime.js";
import type { PolicyDocument, Principal } from "../src/shared/types.js";

export const alice: Principal = {
  employeeId: "emp-alice",
  displayName: "Alice Demo",
  groups: ["Kletron-Utilisateurs"],
};

export const validator: Principal = {
  employeeId: "emp-bob",
  displayName: "Bob Validator",
  groups: ["Kletron-Utilisateurs", "Kletron-Validateurs"],
};

export function demoPolicy(): PolicyDocument {
  return JSON.parse(
    readFileSync(new URL("../config/demo-policy.json", import.meta.url), "utf8"),
  ) as PolicyDocument;
}

export function freshRuntime(
  mutate?: (p: PolicyDocument) => PolicyDocument,
): PlatformRuntime {
  const dir = mkdtempSync(join(tmpdir(), "kletron-plat-"));
  const policy = mutate ? mutate(demoPolicy()) : demoPolicy();
  return createRuntime({ dataDir: dir, policy });
}
