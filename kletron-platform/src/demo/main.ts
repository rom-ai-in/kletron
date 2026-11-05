import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRuntime, loadPolicy } from "../runtime.js";

const root = resolve(import.meta.dirname, "../..");
const dataDir = process.env.KLETRON_DATA_DIR
  ? resolve(process.env.KLETRON_DATA_DIR)
  : resolve(root, "data/runtime");
mkdirSync(dataDir, { recursive: true });

const policyPath =
  process.env.KLETRON_POLICY_FILE ?? resolve(root, "config/demo-policy.json");
const policy = loadPolicy(policyPath);

const consolePort = Number(process.env.CONSOLE_PORT ?? 7100);
const gatewayPort = Number(process.env.GATEWAY_PORT ?? 7101);
const consoleHost = process.env.CONSOLE_HOST ?? "127.0.0.1";
const gatewayHost = process.env.GATEWAY_HOST ?? "127.0.0.1";

const rt = createRuntime({
  dataDir,
  policy,
  gatewayInternalToken: process.env.GATEWAY_INTERNAL_TOKEN,
  gatewayUrl: `http://${gatewayHost}:${gatewayPort}`,
  litellmBaseUrl: `http://127.0.0.1:${process.env.LITELLM_PORT ?? 4000}`,
  openshellAllowlist: (process.env.OPENSHELL_ALLOWLIST ?? `${consoleHost}:${consolePort},${gatewayHost}:${gatewayPort}`).split(","),
});

rt.consoleApp.listen(consolePort, consoleHost, () => {
  console.log(`Console listening on http://${consoleHost}:${consolePort}`);
  console.log(`  GET /v1/config/self?profile=default&employeeId=emp-alice`);
});

rt.gatewayApp.listen(gatewayPort, gatewayHost, () => {
  console.log(`MCP gateway listening on http://${gatewayHost}:${gatewayPort}`);
  console.log(`  POST /mcp/tools/call`);
});
