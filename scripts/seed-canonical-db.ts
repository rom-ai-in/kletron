/**
 * Upsert canonical agent graphs (fixed ObjectIds), optionally seed all automation presets
 * and reconcile stage graph ids. Uses MONGODB_URI from .env.
 *
 * Usage:
 *   npx tsx scripts/seed-canonical-db.ts
 *   WORKSPACE_ID=<24-char-hex> npx tsx scripts/seed-canonical-db.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
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

async function main() {
    const workspaceId = process.env.WORKSPACE_ID?.trim();

    console.log("📌 Upserting canonical agent graphs (stable ObjectIds)…");
    const graphs = await agentGraphService.upsertCanonicalPresetGraphs();
    console.log(`   upserted: ${graphs.upserted}, duplicate names removed: ${graphs.deletedDuplicateNames}`);

    console.log("🔧 Reconciling automation stage graph ids…");
    const reconciled = await automationExecutor.reconcileAutomationStageGraphs();
    console.log(`   documents updated: ${reconciled.updated}`);

    if (workspaceId) {
        console.log(`🌱 Seeding preset automations for workspace ${workspaceId}…`);
        const seed = await automationExecutor.ensureDefaultAutomations(workspaceId);
        console.log(`   created: ${seed.created.length}`, seed.created);
        console.log(`   skipped (already exist): ${seed.skipped.length}`);
    } else {
        console.log("⏭  Set WORKSPACE_ID to seed preset automations for a tenant.");
    }

    // Remove any stray graphs that are not the four canonical names
    const listed = await agentGraphService.listGraphs();
    for (const g of listed) {
        if (!CANONICAL_GRAPH_NAMES.has(g.name)) {
            const id = String(g._id);
            console.log(`🗑  Deleting non-canonical graph "${g.name}" (${id})`);
            await agentGraphService.deleteGraph(id);
        }
    }

    console.log("✅ Done.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
        if (closeFn) await closeFn().catch(() => undefined);
    });
