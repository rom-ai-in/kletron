import { agentGraphService } from "@numezis/server/services/agentGraphService";
import * as db from "@numezis/server/lib/db";

async function main() {
  const existing = await agentGraphService.listGraphs({ search: "Cursor-like Robust Loop" });
  const matches = existing.filter((g) => g.name === "Cursor-like Robust Loop (agent graph)");

  for (const m of matches) {
    if (!m._id) continue;
    await agentGraphService.deleteGraph(String(m._id));
    // eslint-disable-next-line no-console
    console.log(`Deleted Cursor-like Robust Loop graph ${String(m._id)}`);
  }

  if (matches.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No Cursor-like Robust Loop graphs found to delete.");
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed cursor-like agent graph:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
        await closeFn().catch(() => undefined);
    }
  });
