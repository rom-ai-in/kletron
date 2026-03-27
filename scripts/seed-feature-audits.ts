/**
 * Seed script: cleans up old domain automations and seeds ONE single full audit automation.
 * 
 * Run with: npx tsx scripts/seed-feature-audits.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { getDb, closeDb } from "@kletron/server/lib/db";

async function main() {
    const db = await getDb();

    // ── Step 1: Clean up ALL old feature audit automations (domain-split + E2E tests) ──
    console.log("🧹 Cleaning up old feature audit automations...");
    const deleteResult = await db.collection("audit_chains").deleteMany({
        name: { $regex: /^(A43 Feature Audit|E2E Test)/ }
    });
    console.log(`   Deleted ${deleteResult.deletedCount} automation(s)\n`);

    // Also clean up orphaned runs
    const runCleanup = await db.collection("automation_runs").deleteMany({
        chainId: { $nin: (await db.collection("audit_chains").find({}, { projection: { _id: 1 } }).toArray()).map(a => a._id) }
    });
    if (runCleanup.deletedCount > 0) {
        console.log(`   Cleaned up ${runCleanup.deletedCount} orphaned run(s)\n`);
    }

    // ── Step 2: Seed ONE single full audit automation ──
    console.log("🌱 Seeding single full feature audit automation...\n");
    const result = await automationExecutor.ensureDefaultAutomations();

    if (result.created.length > 0) {
        console.log(`✅ Created: ${result.created[0]}`);
    }
    if (result.skipped.length > 0) {
        console.log(`⏩ Skipped: ${result.skipped[0]} (already exists)`);
    }

    // ── Step 3: Verify ──
    const automations = await db.collection("audit_chains").find({
        name: { $regex: /^A43/ }
    }).toArray();

    console.log(`\n📊 Verification:`);
    console.log(`   Total A43 automations: ${automations.length}`);
    for (const a of automations) {
        console.log(`   • ${a.name} — ${(a as any).stages?.length || 0} stages`);
    }

    // ── Step 4: Idempotency check ──
    console.log(`\n🔁 Testing idempotency...`);
    const result2 = await automationExecutor.ensureDefaultAutomations();
    console.log(`   Created: ${result2.created.length}, Skipped: ${result2.skipped.length}`);
    console.log(`   ${result2.skipped.length === 1 ? "✅ Idempotency verified!" : "❌ Idempotency failed!"}\n`);

    await closeDb();
}

main();
