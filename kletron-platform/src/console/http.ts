import express from "express";
import type { AppendOnlyJournal } from "../journal/journal.js";
import type { PolicyEngine } from "../policy/engine.js";
import type { StopController } from "../policy/stops.js";
import { buildLockedConfig } from "./config.js";
import type { OpenShellHarness } from "../openshell/harness.js";

export interface ConsoleDeps {
  policy: PolicyEngine;
  stops: StopController;
  journal: AppendOnlyJournal;
  openshell: OpenShellHarness;
  gatewayUrl: string;
  litellmBaseUrl: string;
  defaultModel: string;
  providerStage: "beta" | "ga";
}

export function createConsoleApp(deps: ConsoleDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "kletron-console" });
  });

  /**
   * Locked remote config for Desktop/agent (Hermès remote config shape analogue).
   * Query: ?profile=&employeeId=
   */
  app.get("/v1/config/self", (req, res) => {
    const profile = String(req.query.profile ?? "default");
    const employeeId = String(req.query.employeeId ?? "unknown");
    const cfg = buildLockedConfig({
      policy: deps.policy.getPolicy(),
      stops: deps.stops.getState(),
      employeeId,
      gatewayUrl: deps.gatewayUrl,
      profile,
      litellmBaseUrl: deps.litellmBaseUrl,
      defaultModel: deps.defaultModel,
      providerStage: deps.providerStage,
    });
    deps.journal.append({
      kind: "config_served",
      actor: employeeId,
      detail: { profile, stops: cfg.stops },
    });
    res.json(cfg);
  });

  app.get("/v1/stops", (_req, res) => {
    res.json(deps.stops.getState());
  });

  app.post("/v1/stops/global", (req, res) => {
    const active = Boolean(req.body?.active);
    const by = String(req.body?.by ?? "console-admin");
    const state = deps.stops.setGlobal(active, by);
    deps.journal.append({
      kind: active ? "stop_set" : "stop_cleared",
      actor: by,
      reason: "global_stop",
      detail: { scope: "global", active },
    });
    res.json(state);
  });

  app.post("/v1/stops/client", (req, res) => {
    const active = Boolean(req.body?.active);
    const by = String(req.body?.by ?? "console-admin");
    const state = deps.stops.setClient(active, by);
    deps.journal.append({
      kind: active ? "stop_set" : "stop_cleared",
      actor: by,
      reason: "client_stop",
      detail: { scope: "client", active },
    });
    res.json(state);
  });

  app.post("/v1/stops/employee/:employeeId", (req, res) => {
    const active = Boolean(req.body?.active);
    const by = String(req.body?.by ?? "console-admin");
    const state = deps.stops.setEmployee(req.params.employeeId, active, by);
    deps.journal.append({
      kind: active ? "stop_set" : "stop_cleared",
      actor: by,
      reason: "employee_stop",
      detail: { scope: "employee", employeeId: req.params.employeeId, active },
    });
    res.json(state);
  });

  app.get("/v1/journal", (_req, res) => {
    res.json({ events: deps.journal.readAll() });
  });

  app.get("/v1/openshell", (_req, res) => {
    res.json(deps.openshell.describe());
  });

  return app;
}
