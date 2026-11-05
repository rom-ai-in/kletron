import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppendOnlyJournal } from "../src/journal/journal.js";
import { generateLiteLLMConfig, renderLiteLLMYaml } from "../src/litellm/generate.js";
import { PolicyEngine } from "../src/policy/engine.js";
import { alice, demoPolicy } from "./helpers.js";
import { OpenShellHarness } from "../src/openshell/harness.js";

describe("journal append-only", () => {
  it("appends lines and never rewrites history", () => {
    const dir = mkdtempSync(join(tmpdir(), "kletron-j-"));
    const j = new AppendOnlyJournal(dir);
    j.append({ kind: "config_served", actor: "a" });
    j.append({ kind: "tool_deny", reason: "default_deny", actor: "a" });
    const events = j.readAll();
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
    const raw = readFileSync(j.path, "utf8").trim().split("\n");
    expect(raw).toHaveLength(2);
  });
});

describe("policy matrix", () => {
  it("default deny when grant missing", () => {
    const engine = new PolicyEngine(demoPolicy());
    const d = engine.evaluate(alice, "bexio", "contacts", "delete");
    expect(d.allow).toBe(false);
    expect(d.reason).toBe("default_deny");
  });

  it("allows granted read", () => {
    const engine = new PolicyEngine(demoPolicy());
    const d = engine.evaluate(alice, "bexio", "contacts", "read");
    expect(d.allow).toBe(true);
  });
});

describe("LiteLLM config from env", () => {
  it("generates model_list from EVERYWARE_* vars", () => {
    const doc = generateLiteLLMConfig({
      EVERYWARE_API_BASE: "https://everyware.example.invalid/v1",
      EVERYWARE_API_KEY: "sk-demo",
      EVERYWARE_MODEL: "demo-small",
      LITELLM_MASTER_KEY: "sk-master",
      KLETRON_CLIENT_ID: "demo-client",
    });
    expect(doc.model_list[0].litellm_params.api_base).toContain("everyware");
    const yaml = renderLiteLLMYaml(doc);
    expect(yaml).toContain("${EVERYWARE_API_KEY}");
    expect(yaml).toContain("${LITELLM_MASTER_KEY}");
  });
});

describe("OpenShell harness", () => {
  it("denies unknown hosts by default", () => {
    const h = new OpenShellHarness({
      mode: "deny-by-default",
      allowlist: ["127.0.0.1:7100", "127.0.0.1:7101"],
    });
    expect(h.checkOutbound("bexio.example.invalid:443").allowed).toBe(false);
    expect(h.checkOutbound("127.0.0.1:7101").allowed).toBe(true);
    expect(h.describe().honest).toBe(true);
  });
});
