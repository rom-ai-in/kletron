import { agentGraphService } from "@numezis/server/services/agentGraphService";
import {
  buildCursorLikeRobustGraph,
  buildSimpleReactAgentGraph,
  buildDiamondFlowAgentGraph,
  buildPresentationGeneratorProGraph,
  buildCompleteDeepAgentGraph,
  buildDriftAnalysisGraph,
  buildCampaignsGraph,
} from "@numezis/server/services/agentGraphPresets";
import * as db from "@numezis/server/lib/db";

type GraphPreset = {
  name: string;
  builder: () => Omit<any, "_id" | "createdAt" | "updatedAt">;
};

const presets: GraphPreset[] = [
  { name: "Cursor-like Robust Loop (agent graph)", builder: buildCursorLikeRobustGraph },
  { name: "Simple ReAct (agent graph)", builder: buildSimpleReactAgentGraph },
  { name: "Diamond flow (agent graph)", builder: buildDiamondFlowAgentGraph },
  { name: "Presentation Generator Pro", builder: buildPresentationGeneratorProGraph },
  { name: "Complete Deep Agent (agent graph)", builder: buildCompleteDeepAgentGraph },
  { name: "Drift Analysis (agent graph)", builder: buildDriftAnalysisGraph },
  { name: "Campaigns (agent graph)", builder: buildCampaignsGraph },
];

async function upsertPreset(preset: GraphPreset) {
  const graph = preset.builder();
  const existing = await agentGraphService.listGraphs({ search: preset.name });
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
    return {
      updatedGraphId: String(keep._id),
      name: graph.name,
      deletedDuplicates: duplicates.length,
      action: "UPDATED",
    };
  }
  const id = await agentGraphService.createGraph(graph);
  return { insertedGraphId: id, name: graph.name, action: "CREATED" };
}

async function main() {
  const results = [];
  for (const preset of presets) {
    results.push(await upsertPreset(preset));
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ results }, null, 2));
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
