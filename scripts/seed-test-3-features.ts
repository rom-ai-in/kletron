/**
 * Seed a 3-feature test automation + refresh full 127-feature automation, both with vllm.
 * Run: npx tsx scripts/seed-test-3-features.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { getDb, closeDb } from "@numezis/server/lib/db";

async function main() {
    const db = await getDb();

    // 1) Delete old 127-feature automation (has azure provider from old seed)
    const del = await db.collection("audit_chains").deleteMany({ name: /^A43/ });
    console.log("Cleaned old A43 automations:", del.deletedCount);

    // 2) Re-seed the full 127-feature automation (now with vllm)
    const fullResult = await automationExecutor.ensureDefaultAutomations();
    console.log("Full audit:", fullResult.created.length ? "Created" : "Skipped");

    // 3) Create a 3-feature TEST automation using vllm
    const testFeatures = ["foundation/contacts", "sales/invoices", "accounting/banking"];
    const config = AutomationConfigBuilder.buildFeatureAuditBatch(testFeatures, {
        name: "A43 Test — 3 Feature Audit (vllm)"
    });

    // Delete if already exists
    await db.collection("audit_chains").deleteMany({ name: config.name });

    const id = await automationExecutor.createAutomation({
        ...config,
        name: config.name!,
        description: config.description ?? "",
        stages: config.stages!,
        triggerType: "manual",
    } as any);
    console.log("Test automation created:", config.name, "- ID:", id);

    // 4) Verify
    const all = await db.collection("audit_chains").find({ name: /^A43/ }).toArray();
    console.log("\nFinal state:");
    for (const a of all) {
        const stages = (a as any).stages || [];
        const provider = stages[0]?.llmProvider || "unknown";
        console.log("  -", a.name, "-", stages.length, "stages - provider:", provider);
    }

    await closeDb();
}

main();
