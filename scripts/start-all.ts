import {
  ensurePortsFree,
  createMcpLauncher,
  createLangGraphLauncher,
  resolveTargetRepoRoot,
} from "./lib/serviceLauncher.js";

const PORTS = [
  { name: "MCP", port: 9000 },
  { name: "LangGraph", port: 8080 },
];
const MCP_URL = "http://localhost:9000/sse";

async function main() {
  console.log("✨ Preparing ports...");
  await ensurePortsFree(PORTS.map((entry) => entry.port));

  let targetRepoRoot: string | undefined;
  try {
    targetRepoRoot = resolveTargetRepoRoot();
    console.log(`📁 MCP repo root: ${targetRepoRoot}`);
  } catch {
    console.warn("⚠️  No repository path configured yet. You can set it later in the UI at Configuration > Repository Settings.");
  }

  const children = [
    createMcpLauncher(targetRepoRoot ?? process.cwd(), { MCP_PORT: "9000" }),
    createLangGraphLauncher({ overrides: { LANGGRAPH_PORT: "8080", MCP_URL } }),
  ];

  const stopChildren = () => {
    console.log("\n🛑 Stopping child processes...");
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore already terminated
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", stopChildren);
  process.on("SIGTERM", stopChildren);

  console.log("✅ Both MCP (+9000) and LangGraph (+8080) are running.");
}

main().catch((error) => {
  console.error("❌ Failed to start services:", error);
  process.exit(1);
});
