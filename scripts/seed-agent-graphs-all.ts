import { agentGraphService } from "@kletron/server/services/agentGraphService";
import {
  buildCoderAgentGraph,
  buildExplorerAgentGraph,
  buildPlannerAgentGraph,
  buildCompanyGrowthWorkGraph,
} from "@kletron/server/services/agentGraphPresets";
import * as db from "@kletron/server/lib/db";

const CANONICAL_GRAPH_NAMES = new Set([
  buildCompanyGrowthWorkGraph().name,
  buildCoderAgentGraph().name,
  buildPlannerAgentGraph().name,
  buildExplorerAgentGraph().name,
]);

// Legacy / removed graph names — delete any remaining copies from the database
const LEGACY_NAMES = [
  "Campaigns (agent graph)",
  "Campaign planning and execution graph with task tracking.",
  "Diamond flow (agent graph)",
  "Presentation Generator Pro",
  "Automations (agent graph)",
  "Cursor-like Robust Loop (agent graph)",
  "Complete Deep Agent (agent graph)",
  "Continuous Improvement (agent graph)",
  "Simple ReAct (agent graph)",
  "Drift Analysis (agent graph)",
  "Business Analyst",
  "Code Comparator (agent graph)",
];

async function main() {
  const allGraphs = await agentGraphService.listGraphs();
  // eslint-disable-next-line no-console
  console.log(`Found ${allGraphs.length} total graphs in database.`);

  let deletedLegacy = 0;
  for (const legacyName of LEGACY_NAMES) {
    for (const g of allGraphs) {
      if (g.name === legacyName) {
        const id = String(g._id);
        // eslint-disable-next-line no-console
        console.log(`  Deleting legacy graph "${g.name}" (${id})`);
        await agentGraphService.deleteGraph(id);
        deletedLegacy++;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log("Upserting canonical graphs at fixed ObjectIds…");
  const upsert = await agentGraphService.upsertCanonicalPresetGraphs();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ deletedLegacy, ...upsert }, null, 2));

  const after = await agentGraphService.listGraphs();
  const deletedNonCanonical: Array<{ _id: string; name: string }> = [];
  for (const g of after) {
    if (!CANONICAL_GRAPH_NAMES.has(g.name)) {
      const id = String(g._id);
      // eslint-disable-next-line no-console
      console.log(`  Deleting non-canonical graph "${g.name}" (${id})`);
      await agentGraphService.deleteGraph(id);
      deletedNonCanonical.push({ _id: id, name: g.name });
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ deletedNonCanonical }, null, 2));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed all agent graphs:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
      await closeFn().catch(() => undefined);
    }
  });
