import {
  ensurePortsFree,
  createLangGraphDevServer,
  createMcpLauncher,
  createDriftAnalysisWorkerLauncher,
  createTerminalWorkerLauncher,
  createWebLauncher,
  createDesktopLauncher,
  requireTargetRepoRoot,
  waitForHttpOk,
} from "./lib/serviceLauncher.js";

const PORTS = [9000, 8080, Number(process.env.WEB_PORT ?? 3000), 3002, 5173];
const MCP_URL = "http://localhost:9000/sse";
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const WEB_URL = `http://localhost:${WEB_PORT}`;
const MCP_HEALTH = "http://localhost:9000/health";
const LANGGRAPH_INFO = "http://localhost:8080/info";
const LANGGRAPH_TIMEOUT_MS = Number(process.env.LANGGRAPH_TIMEOUT_MS ?? 120_000);

async function main() {
  console.log("✨ Dev workflow initializing...");
  await ensurePortsFree(PORTS);

  const targetRepoRoot = await requireTargetRepoRoot();
  console.log(`📁 MCP repo root: ${targetRepoRoot}`);

  const children = [
    createMcpLauncher(targetRepoRoot, { MCP_PORT: "9000" }),
    createLangGraphDevServer({
      port: 8080,
      configPath: "langgraph.json",
      env: {
        MCP_URL,
      },
    }),
    createWebLauncher(WEB_PORT),
    createDesktopLauncher(),
    createDriftAnalysisWorkerLauncher({ watch: true }),
    createTerminalWorkerLauncher({ watch: true }),
  ].filter(Boolean);

  console.log("⏳ Waiting for MCP + LangGraph dev server...");
  await waitForHttpOk(MCP_HEALTH, { timeoutMs: 20_000 });
  await waitForHttpOk(LANGGRAPH_INFO, { timeoutMs: LANGGRAPH_TIMEOUT_MS });
  await waitForHttpOk(WEB_URL, { timeoutMs: 30_000 });
  console.log("✅ Health checks passed.");
  console.log(`🌐 Web UI ready: ${WEB_URL}`);

  const stopChildren = () => {
    console.log("\n🛑 Stopping dev services...");
    for (const child of children) {
      try {
        if (child) child.kill("SIGTERM");
      } catch {
        // ignore silently
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", stopChildren);
  process.on("SIGTERM", stopChildren);

  console.log("✅ Dev services running: MCP 9000 + LangGraph dev server 8080.");
}

main().catch((error) => {
  console.error("❌ Dev workflow failed:", error);
  process.exit(1);
});
