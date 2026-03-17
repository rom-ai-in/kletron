/**
 * E2E Test: Creates a 3-feature batch automation using simple_react graph,
 * starts a run, and executes it end-to-end.
 * 
 * Uses simple_react graph to avoid MCP server dependency.
 * Picks 3 features from different domains.
 * 
 * Run with: npx tsx scripts/test-feature-audit-e2e.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { AutomationConfigBuilder } from "@kletron/shared/automationConfigBuilder";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { getDb, closeDb } from "@kletron/server/lib/db";

const TEST_FEATURES = [
    "foundation/contacts",     // Small, well-bounded feature (foundation domain)
    "sales/sales-config",      // Config feature (sales domain)
    "notifications/channels",  // System feature (system domain)
];

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  A43 FEATURE AUDIT — E2E TEST (3 features)");
    console.log("═══════════════════════════════════════════════════════════\n");

    // ── Step 1: Build the batch automation config ──
    console.log("1️⃣  Building batch automation config...\n");
    const config = AutomationConfigBuilder.buildFeatureAuditBatch(
        TEST_FEATURES,
        { name: "E2E Test — 3 Feature Audit" }
    );

    // Override graphId to simple_react (works without MCP server)
    if (config.stages) {
        for (const stage of config.stages) {
            stage.graphId = "simple_react";
        }
    }

    console.log(`   Name:        ${config.name}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Stages:      ${config.stages?.length}`);
    config.stages?.forEach((s: any, i: number) => {
        console.log(`     [${i}] ${s.name} (graph: ${s.graphId}, model: ${s.llmModel})`);
        console.log(`         prompt: ${s.prompt.substring(0, 80)}...`);
    });
    console.log("");

    // ── Step 2: Create the automation in DB ──
    console.log("2️⃣  Creating automation in DB...\n");
    const automationId = await automationExecutor.createAutomation({
        ...config,
        name: config.name!,
        description: config.description ?? "",
        stages: config.stages!,
        triggerType: "manual",
    } as any);
    console.log(`   Automation ID: ${automationId}\n`);

    // Verify creation
    const automation = await automationExecutor.getAutomation(automationId);
    if (!automation) {
        console.log("   ❌ Automation not found after creation!");
        await closeDb();
        process.exit(1);
    }
    console.log(`   ✅ Automation created: ${automation.name}`);
    console.log(`   Status: ${automation.status}`);
    console.log(`   Stages: ${automation.stages.length}\n`);

    // ── Step 3: Start a new run ──
    console.log("3️⃣  Starting new run...\n");
    const runId = await automationExecutor.startNewRun(automationId);
    console.log(`   Run ID: ${runId}\n`);

    const run = await automationExecutor.getRun(runId);
    if (!run) {
        console.log("   ❌ Run not found after creation!");
        await closeDb();
        process.exit(1);
    }
    console.log(`   ✅ Run created`);
    console.log(`   Status:    ${run.status}`);
    console.log(`   ChainId:   ${run.chainId}`);
    console.log(`   StageIdx:  ${run.currentStageIndex}\n`);

    // ── Step 4: Execute the run ──
    console.log("4️⃣  Executing run (this will call the LLM for each stage)...\n");
    console.log("   ⏳ This may take several minutes. Each stage = 1 fresh LLM session.\n");

    const startTime = Date.now();
    try {
        const result = await automationExecutor.executeRun(runId, (progress) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            console.log(`   [${elapsed}s] Stage ${progress.stageIndex}: ${progress.status}`);
            if (progress.findings?.length) {
                console.log(`           → ${progress.findings.length} finding(s)`);
            }
        });

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

        // ── Step 5: Report results ──
        console.log("\n5️⃣  Results:\n");
        console.log(`   Success:  ${result.success}`);
        console.log(`   Duration: ${totalDuration}s`);
        console.log(`   Stages:   ${result.stages.length}`);
        console.log("");

        for (const stage of result.stages) {
            console.log(`   ── ${stage.stageName} ──────────────────────────────`);
            console.log(`   Session: ${stage.sessionId}`);
            console.log(`   Success: ${stage.success}`);
            console.log(`   Findings: ${stage.findings.length}`);
            console.log(`   Claims: ${stage.claims.length}`);
            if (stage.error) console.log(`   Error: ${stage.error}`);
            if (stage.rawOutput) {
                console.log(`   Report (first 300 chars):\n${stage.rawOutput.substring(0, 300)}`);
            }
            console.log("");
        }

        if (result.aggregation) {
            console.log("   ── Aggregation ───────────────────────────────");
            console.log(`   Total findings: ${result.aggregation.stats.totalFindings}`);
            console.log(`   Critical:       ${result.aggregation.stats.criticalCount}`);
            console.log(`   Warnings:       ${result.aggregation.stats.warningCount}`);
            if (result.aggregation.report) {
                console.log(`   Report (first 300 chars):\n${result.aggregation.report.substring(0, 300)}`);
            }
        }

        // ── Step 6: Verify final DB state ──
        console.log("\n6️⃣  Verifying final DB state...\n");
        const finalRun = await automationExecutor.getRun(runId);
        console.log(`   Run status:     ${finalRun?.status}`);
        console.log(`   Stage index:    ${finalRun?.currentStageIndex}`);
        console.log(`   Sessions:       ${finalRun?.sessionIds?.length}`);
        console.log(`   Agg. findings:  ${finalRun?.aggregatedFindings?.length}`);
        console.log(`   Has report:     ${!!finalRun?.finalReport}`);

        const finalAuto = await automationExecutor.getAutomation(automationId);
        console.log(`   Automation status: ${finalAuto?.status}`);

        console.log("\n═══════════════════════════════════════════════════════════");
        console.log(result.success
            ? "  ✅ E2E TEST PASSED — All 3 features audited successfully"
            : "  ⚠️  E2E TEST COMPLETED WITH ISSUES — Check results above");
        console.log(`  Total time: ${totalDuration}s`);
        console.log("═══════════════════════════════════════════════════════════\n");

    } catch (error) {
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`\n   ❌ Execution failed after ${totalDuration}s:`, error);

        // Check run state after failure
        const failedRun = await automationExecutor.getRun(runId);
        console.log(`\n   Run status after failure: ${failedRun?.status}`);
        console.log(`   Reached stage:           ${failedRun?.currentStageIndex}`);
        console.log(`   Sessions created:        ${failedRun?.sessionIds?.length}`);
    }

    // ── Cleanup: remove test automation ──
    console.log("\n🧹 Cleaning up test automation...");
    const db = await getDb();
    await db.collection("audit_chains").deleteOne({ _id: automation._id });
    await db.collection("automation_runs").deleteMany({ chainId: automation._id });
    console.log("   Done.\n");

    await closeDb();
}

main();
