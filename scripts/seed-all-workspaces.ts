/**
 * Seed canonical graphs + reconcile stages, then ensure all automation presets
 * exist for every non-archived workspace.
 *
 *   npx tsx scripts/seed-all-workspaces.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { listAllWorkspaces } from "@kletron/server/services/workspaceService";
import * as db from "@kletron/server/lib/db";

async function main() {
    console.log("📌 Canonical agent graphs (fixed ObjectIds)…");
    const g = await agentGraphService.upsertCanonicalPresetGraphs();
    console.log(`   upserted: ${g.upserted}, duplicate names removed: ${g.deletedDuplicateNames}`);

    console.log("🔧 Reconcile automation stage graphs (all workspaces)…");
    const r = await automationExecutor.reconcileAutomationStageGraphs();
    console.log(`   documents updated: ${r.updated}`);

    const workspaces = await listAllWorkspaces();
    console.log(`🌱 Seeding preset automations for ${workspaces.length} workspace(s)…\n`);

    const summary: { name: string; id: string; created: number; skipped: number }[] = [];

    for (const ws of workspaces) {
        const id = ws._id?.toString();
        if (!id) continue;
        const result = await automationExecutor.ensureDefaultAutomations(id);
        summary.push({
            name: ws.name,
            id,
            created: result.created.length,
            skipped: result.skipped.length,
        });
        console.log(`   • ${ws.name} (${id}): +${result.created.length} created, ${result.skipped.length} skipped`);
    }

    const totalCreated = summary.reduce((a, s) => a + s.created, 0);
    console.log(`\n✅ Done. Total new automations this run: ${totalCreated}`);
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
