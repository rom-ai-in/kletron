import { agentGraphService } from "../src/services/agentGraphService";
import { buildDiamondFlowAgentGraph } from "../src/services/agentGraphPresets";
import { closeDb } from "../src/lib/db";

async function main() {
  const graph = buildDiamondFlowAgentGraph();
  // Search using a safe substring (avoid regex special chars in name).
  const existing = await agentGraphService.listGraphs({ search: "Diamond flow" });
  const matches = existing.filter((g) => g.name === graph.name);
  const keep = matches[0];
  if (keep?._id) {
    // Clean up accidental duplicates (keep most recently updated, delete the rest).
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
    console.error("Failed to seed diamond agent graph:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });

