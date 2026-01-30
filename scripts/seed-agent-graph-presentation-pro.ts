import { agentGraphService } from "../src/services/agentGraphService";
import { buildPresentationGeneratorProGraph } from "../src/services/agentGraphPresets";
import { closeDb } from "../src/lib/db";

async function main() {
    const graph = buildPresentationGeneratorProGraph();
    // Search for existing Presentation Generator Pro graph
    const existing = await agentGraphService.listGraphs({ search: "Presentation Generator Pro" });
    const matches = existing.filter((g) => g.name === graph.name);
    const keep = matches[0];

    if (keep?._id) {
        // Update existing graph with new prompts
        await agentGraphService.updateGraph(String(keep._id), graph);
        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify(
                {
                    action: "updated",
                    graphId: String(keep._id),
                    name: graph.name,
                    message: "Updated with new Outputs folder path and BLANK template"
                },
                null,
                2
            )
        );

        // Clean up duplicates if any
        const duplicates = matches.slice(1);
        for (const dup of duplicates) {
            if (dup._id) {
                await agentGraphService.deleteGraph(String(dup._id));
            }
        }
        if (duplicates.length > 0) {
            console.log(`Deleted ${duplicates.length} duplicate(s)`);
        }
        return;
    }

    // Create new graph if not exists
    const id = await agentGraphService.createGraph(graph);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        action: "created",
        insertedGraphId: id,
        name: graph.name,
        message: "Created new Presentation Generator Pro graph"
    }, null, 2));
}

main()
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to seed/update Presentation Generator Pro graph:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb().catch(() => undefined);
    });
