import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { buildDriftAnalysisGraph } from "@numezis/server/services/agentGraphPresets";
import * as db from "@numezis/server/lib/db";

async function main() {
  const graph = buildDriftAnalysisGraph();
  const existing = await agentGraphService.listGraphs({ search: "Drift Analysis" });
  const matches = existing.filter((g) => g.name === graph.name);
  const keep = matches[0];
  if (keep?._id) {
    const duplicates = matches.slice(1);
    for (const dup of duplicates) {
      if (dup._id) {
        await agentGraphService.deleteGraph(String(dup._id));
      }
    }
    await agentGraphService.updateGraph(String(keep._id), graph);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          updatedGraphId: String(keep._id),
          name: graph.name,
          deletedDuplicates: duplicates.length,
          action: "UPDATED with latest preset",
        },
        null,
        2
      )
    );
    return;
  }

  const id = await agentGraphService.createGraph(graph);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ insertedGraphId: id, name: graph.name }, null, 2));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed drift analysis graph:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
      await closeFn().catch(() => undefined);
    }
  });
