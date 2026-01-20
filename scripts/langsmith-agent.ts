import {
  ensurePortsFree,
  createMcpLauncher,
  createLangGraphLauncher,
  requireTargetRepoRoot,
} from "./lib/serviceLauncher.js";

const PORTS = [9000, 8080];
const MCP_URL = "http://localhost:9000/sse";

async function main() {
  console.log("✨ LangSmith agent workflow initializing...");

  if (!process.env.LANGSMITH_API_KEY) {
    console.warn("⚠️ LANGSMITH_API_KEY is not set, LangSmith telemetry will be disabled.");
  }

  await ensurePortsFree(PORTS);

  const targetRepoRoot = await requireTargetRepoRoot();
  console.log(`📁 MCP repo root: ${targetRepoRoot}`);

  const children = [
    createMcpLauncher(targetRepoRoot, { MCP_PORT: "9000" }),
    createLangGraphLauncher({
      overrides: {
        LANGGRAPH_PORT: "8080",
        LANGSMITH_AGENT: "1",
        MCP_URL,
      },
    }),
  ];

  const stopChildren = () => {
    console.log("\n🛑 Terminating LangSmith agent services...");
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", stopChildren);
  process.on("SIGTERM", stopChildren);

  console.log("🚀 LangSmith-targeted services are live (MCP 9000 + LangGraph 8080).");
}

main().catch((error) => {
  console.error("❌ LangSmith workflow failed:", error);
  process.exit(1);
});
