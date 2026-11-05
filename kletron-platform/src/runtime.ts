import { readFileSync } from "node:fs";
import { ApprovalStore } from "./approvals/store.js";
import { createConsoleApp } from "./console/http.js";
import { createGatewayApp } from "./gateway/http.js";
import { GatewayService } from "./gateway/service.js";
import { IdempotencyStore } from "./idempotency/store.js";
import { AppendOnlyJournal } from "./journal/journal.js";
import { OpenShellHarness } from "./openshell/harness.js";
import { PolicyEngine } from "./policy/engine.js";
import { StopController } from "./policy/stops.js";
import type { PolicyDocument } from "./shared/types.js";

export interface PlatformRuntime {
  policy: PolicyEngine;
  stops: StopController;
  approvals: ApprovalStore;
  idempotency: IdempotencyStore;
  journal: AppendOnlyJournal;
  openshell: OpenShellHarness;
  gateway: GatewayService;
  gatewayApp: ReturnType<typeof createGatewayApp>;
  consoleApp: ReturnType<typeof createConsoleApp>;
  gatewayInternalToken: string;
}

export function loadPolicy(path: string): PolicyDocument {
  return JSON.parse(readFileSync(path, "utf8")) as PolicyDocument;
}

export function createRuntime(opts: {
  dataDir: string;
  policy: PolicyDocument;
  gatewayInternalToken?: string;
  gatewayUrl?: string;
  litellmBaseUrl?: string;
  defaultModel?: string;
  providerStage?: "beta" | "ga";
  openshellAllowlist?: string[];
}): PlatformRuntime {
  const journal = new AppendOnlyJournal(opts.dataDir);
  const policy = new PolicyEngine(opts.policy);
  const stops = new StopController();
  const approvals = new ApprovalStore();
  const idempotency = new IdempotencyStore();
  const gatewayInternalToken =
    opts.gatewayInternalToken ?? "demo-gateway-internal-not-a-secret";
  const allowlist = opts.openshellAllowlist ?? [
    "127.0.0.1:7100",
    "127.0.0.1:7101",
  ];
  const openshell = new OpenShellHarness(
    { mode: "deny-by-default", allowlist },
    journal,
  );
  const gateway = new GatewayService({
    policy,
    stops,
    approvals,
    idempotency,
    journal,
    openshell,
    gatewayInternalToken,
    connectorHosts: {
      bexio: "bexio.example.invalid:443",
      m365: "graph.microsoft.example.invalid:443",
    },
  });
  const gatewayApp = createGatewayApp(gateway);
  const consoleApp = createConsoleApp({
    policy,
    stops,
    journal,
    openshell,
    gatewayUrl: opts.gatewayUrl ?? "http://127.0.0.1:7101",
    litellmBaseUrl: opts.litellmBaseUrl ?? "http://127.0.0.1:4000",
    defaultModel: opts.defaultModel ?? "kletron-default",
    providerStage: opts.providerStage ?? "beta",
  });

  return {
    policy,
    stops,
    approvals,
    idempotency,
    journal,
    openshell,
    gateway,
    gatewayApp,
    consoleApp,
    gatewayInternalToken,
  };
}
