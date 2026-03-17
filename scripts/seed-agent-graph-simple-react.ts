import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { buildSimpleReactAgentGraph } from "@kletron/server/services/agentGraphPresets";
import * as db from "@kletron/server/lib/db";

async function main() {
  const graph = buildSimpleReactAgentGraph();
  const existing = await agentGraphService.listGraphs({ search: "Simple ReAct" });
  const matches = existing.filter((g) => g.name === graph.name);
  const keep = matches[0];
  if (keep?._id) {
    const duplicates = matches.slice(1);
    for (const dup of duplicates) {
      if (dup._id) await agentGraphService.deleteGraph(String(dup._id));
    }
    // Update existing graph with latest configuration (nodes, edges, description)
    await agentGraphService.updateGraph(String(keep._id), {
      nodes: graph.nodes,
      edges: graph.edges,
      description: graph.description,
    });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        { updatedGraphId: String(keep._id), name: graph.name, deletedDuplicates: duplicates.length },
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
    console.error("Failed to seed simple react agent graph:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
        await closeFn().catch(() => undefined);
    }
  });
