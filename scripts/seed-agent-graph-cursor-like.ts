import { agentGraphService } from "../src/services/agentGraphService";
import { buildCursorLikeRobustGraph } from "../src/services/agentGraphPresets";
import { closeDb } from "../src/lib/db";

async function main() {
  const graph = buildCursorLikeRobustGraph();
  const existing = await agentGraphService.listGraphs({ search: "Cursor-like Robust Loop" });
  const matches = existing.filter((g) => g.name === graph.name);
  const keep = matches[0];
  if (keep?._id) {
    const duplicates = matches.slice(1);
    for (const dup of duplicates) {
      if (dup._id) {
        await agentGraphService.deleteGraph(String(dup._id));
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          existingGraphId: String(keep._id),
          name: graph.name,
          deletedDuplicates: duplicates.length,
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
    console.error("Failed to seed cursor-like agent graph:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
