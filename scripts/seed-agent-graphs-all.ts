import { agentGraphService } from "@kletron/server/services/agentGraphService";
import {
  buildSimpleReactAgentGraph,
  buildDriftAnalysisGraph,
  buildCoderAgentGraph,
  buildExplorerAgentGraph,
  buildPlannerAgentGraph,
  buildBusinessAnalystGraph,
} from "@kletron/server/services/agentGraphPresets";
import * as db from "@kletron/server/lib/db";

type GraphPreset = {
  name: string;
  builder: () => Omit<any, "_id" | "createdAt" | "updatedAt">;
};

const presets: GraphPreset[] = [
  { name: "Simple ReAct (agent graph)", builder: buildSimpleReactAgentGraph },
  { name: "Coder Agent (agent graph)", builder: buildCoderAgentGraph },
  { name: "Explorer Agent (agent graph)", builder: buildExplorerAgentGraph },
  { name: "Planner Agent (agent graph)", builder: buildPlannerAgentGraph },
  { name: "Drift Analysis (agent graph)", builder: buildDriftAnalysisGraph },
  { name: "Business Analyst", builder: buildBusinessAnalystGraph },
];

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
];

async function main() {
  // 1. Load ALL graphs from DB at once (no search filter → no regex issues)
  const allGraphs = await agentGraphService.listGraphs();
  // eslint-disable-next-line no-console
  console.log(`Found ${allGraphs.length} total graphs in database.`);

  // 2. Build lookup: name → list of matching DB entries
  const byName = new Map<string, Array<{ _id: string; name: string }>>();
  for (const g of allGraphs) {
    const id = String(g._id);
    const name = g.name;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push({ _id: id, name });
  }

  // 3. Delete legacy-named graphs
  let deletedLegacy = 0;
  for (const legacyName of LEGACY_NAMES) {
    const matches = byName.get(legacyName) ?? [];
    for (const m of matches) {
      // eslint-disable-next-line no-console
      console.log(`  Deleting legacy graph "${m.name}" (${m._id})`);
      await agentGraphService.deleteGraph(m._id);
      deletedLegacy++;
    }
    byName.delete(legacyName);
  }

  // 4. Upsert each preset: keep ONE copy, delete duplicates, update definition
  const results = [];
  for (const preset of presets) {
    const graph = preset.builder();
    const matches = byName.get(graph.name) ?? [];
    const keep = matches[0];

    if (keep) {
      // Delete all duplicates (keep only the first)
      const duplicates = matches.slice(1);
      for (const dup of duplicates) {
        // eslint-disable-next-line no-console
        console.log(`  Deleting duplicate "${dup.name}" (${dup._id})`);
        await agentGraphService.deleteGraph(dup._id);
      }
      // Update the kept graph with latest definition
      await agentGraphService.updateGraph(keep._id, graph);
      results.push({
        updatedGraphId: keep._id,
        name: graph.name,
        deletedDuplicates: duplicates.length,
        action: "UPDATED",
      });
    } else {
      // No existing graph — create new
      const id = await agentGraphService.createGraph(graph);
      results.push({ insertedGraphId: id, name: graph.name, action: "CREATED" });
    }
  }

  // 5. Report orphaned graphs (exist in DB but not in presets)
  const presetNames = new Set(presets.map((p) => p.name));
  const orphaned = allGraphs
    .filter((g) => !presetNames.has(g.name) && !LEGACY_NAMES.includes(g.name))
    .map((g) => ({ _id: String(g._id), name: g.name }));

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ results, deletedLegacy, orphanedGraphs: orphaned }, null, 2));
  if (orphaned.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${orphaned.length} orphaned graph(s) found (not in presets). Review manually if needed.`);
  }
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
