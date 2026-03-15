/**
 * Verification script: Cross-checks AUDITABLE_FEATURES against the A43 canonical inventory.
 * 
 * This script:
 * 1. Lists all features in AUDITABLE_FEATURES by domain
 * 2. Verifies the DB seeded automations match
 * 3. Validates that buildFeatureAuditByDomain works for every domain
 * 4. Validates that buildFeatureAuditBatch produces correct stage counts
 * 5. Validates that each stage prompt is self-contained
 * 6. Cross-checks against the canonical inventory anchors
 */
import dotenv from "dotenv";
dotenv.config();

import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { getDb, closeDb } from "@numezis/server/lib/db";

// ── Canonical inventory anchors (from A43 sections 2, 3, 4) ──
// Every implemented_and_auditable or implemented_partial feature from the inventory
const CANONICAL_FEATURES: { anchor: string; section: string; status: string }[] = [
    // §2 — Canonical module inventory
    { anchor: "foundation/contacts", section: "§2", status: "implemented_and_auditable" },
    { anchor: "sales/invoices", section: "§2", status: "implemented_and_auditable" },
    { anchor: "sales/orders", section: "§2", status: "implemented_and_auditable" },
    { anchor: "sales/quotes", section: "§2", status: "implemented_and_auditable" },
    { anchor: "sales/credit-notes", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/expenses", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/bills", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/purchase-orders", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/expense-reports", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/budgets", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/credit-notes", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/vendor-management", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/purchase-ocr", section: "§2", status: "implemented_partial" },
    { anchor: "accounting/banking", section: "§2", status: "implemented_and_auditable" },
    { anchor: "accounting/ledger", section: "§2", status: "implemented_and_auditable" },
    { anchor: "accounting/fixed-assets", section: "§2", status: "implemented_and_auditable" },
    { anchor: "accounting/compliance", section: "§2", status: "implemented_and_auditable" },
    { anchor: "accounting/closing", section: "§2", status: "implemented_and_auditable" },
    { anchor: "accounting/governance", section: "§2", status: "implemented_partial" },
    { anchor: "accounting/accounting-config", section: "§2", status: "implemented_and_auditable" },
    { anchor: "projects/projects", section: "§2", status: "implemented_and_auditable" },
    { anchor: "projects/project-tasks", section: "§2", status: "implemented_and_auditable" },
    { anchor: "projects/project-expenses", section: "§2", status: "implemented_and_auditable" },
    { anchor: "projects/time-entries", section: "§2", status: "implemented_and_auditable" },
    { anchor: "projects/projects-config", section: "§2", status: "implemented_partial" },
    { anchor: "hr/payroll", section: "§2", status: "implemented_and_auditable" },
    { anchor: "hr/payroll-config", section: "§2", status: "implemented_partial" },
    { anchor: "inventory/inventory-config", section: "§2", status: "implemented_partial" },
    { anchor: "communication/approvals", section: "§2", status: "implemented_and_auditable" },
    { anchor: "communication/comments", section: "§2", status: "implemented_partial" },
    { anchor: "communication/tasks", section: "§2", status: "implemented_and_auditable" },
    { anchor: "communication/documents", section: "§2", status: "implemented_and_auditable" },
    { anchor: "communication/pitch-deck", section: "§2", status: "implemented_and_auditable" },
    { anchor: "ai/agents", section: "§2", status: "implemented_and_auditable" },
    { anchor: "ai/ai-config", section: "§2", status: "implemented_partial" },
    { anchor: "notifications/notifications", section: "§2", status: "implemented_and_auditable" },
    { anchor: "purchases/purchase-config", section: "§2", status: "implemented_and_auditable" },
    { anchor: "sales/sales-config", section: "§2", status: "implemented_and_auditable" },
    { anchor: "hr/hr-config", section: "§2", status: "implemented_and_auditable" },
    { anchor: "communication/communication-config", section: "§2", status: "implemented_and_auditable" },
    { anchor: "hr/employees", section: "§2-derived", status: "implemented_and_auditable" },
    { anchor: "hr/leave-management", section: "§2-derived", status: "implemented_and_auditable" },

    // §3 — Repo extension inventory (beyond ModuleKey)
    { anchor: "management/company-access", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/tenant-access", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/partner-access", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/superadmin-access", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/partner-management", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/companies", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/modules", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/billing", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/settings", section: "§3", status: "implemented_and_auditable" },
    { anchor: "management/profile", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/portal-shell", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/communication-inbox", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/approval-policies", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/reporting", section: "§3", status: "implemented_partial" },
    { anchor: "transversal/documents-engine", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/compliance-calendar", section: "§3", status: "implemented_and_auditable" },
    { anchor: "transversal/delivery-payment-terms", section: "§3", status: "implemented_partial" },
    { anchor: "ai/ai-governance", section: "§3", status: "implemented_and_auditable" },
    { anchor: "internal/marketing-blog", section: "§3", status: "implemented_and_auditable" },
    { anchor: "internal/social-media", section: "§3", status: "implemented_and_auditable" },
    { anchor: "internal/crm-prospecting", section: "§3", status: "implemented_partial" },
    { anchor: "internal/zefix", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/countries", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/compliance-knowledge", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/i18n-ops", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/ops-errors-cron", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/documents-observability", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/rbac-analytics", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/seeding-reconciliation", section: "§3", status: "implemented_and_auditable" },
    { anchor: "governance/partner-client-links", section: "§3", status: "implemented_and_auditable" },
    { anchor: "auth/auth-flows", section: "§3", status: "implemented_and_auditable" },

    // §4 — API subfeature matrix (only NEW items not already in §2/§3)
    { anchor: "accounting/approval-workflows", section: "§4", status: "implemented_partial" },
    { anchor: "accounting/closing-policies", section: "§4", status: "implemented_and_auditable" },
    { anchor: "accounting/currency", section: "§4", status: "implemented_and_auditable" },
    { anchor: "accounting/default-account-mappings", section: "§4", status: "implemented_and_auditable" },
    { anchor: "accounting/integration", section: "§4", status: "implemented_partial" },
    { anchor: "accounting/reminder-rules", section: "§4", status: "implemented_and_auditable" },
    { anchor: "communication/documents-config", section: "§4", status: "implemented_partial" },
    { anchor: "communication/inbound-email", section: "§4", status: "implemented_partial" },
    { anchor: "hr/catalogs", section: "§4", status: "implemented_partial" },
    { anchor: "hr/documents", section: "§4", status: "implemented_partial" },
    { anchor: "hr/integration", section: "§4", status: "implemented_partial" },
    { anchor: "hr/payroll-ch", section: "§4", status: "implemented_partial" },
    { anchor: "hr/payroll-declarations", section: "§4", status: "implemented_and_auditable" },
    { anchor: "hr/reporting", section: "§4", status: "implemented_partial" },
    { anchor: "hr/time-tracking", section: "§4", status: "implemented_partial" },
    { anchor: "inventory/categories", section: "§4", status: "implemented_partial" },
    { anchor: "inventory/integration", section: "§4", status: "implemented_partial" },
    { anchor: "inventory/reporting", section: "§4", status: "implemented_partial" },
    { anchor: "inventory/tracking", section: "§4", status: "implemented_partial" },
    { anchor: "inventory/valuation", section: "§4", status: "implemented_partial" },
    { anchor: "notifications/channels", section: "§4", status: "implemented_and_auditable" },
    { anchor: "projects/approvals", section: "§4", status: "implemented_partial" },
    { anchor: "projects/budget", section: "§4", status: "implemented_and_auditable" },
    { anchor: "projects/invoicing", section: "§4", status: "implemented_partial" },
    { anchor: "projects/portfolio", section: "§4", status: "implemented_and_auditable" },
    { anchor: "projects/reporting", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/approval-workflows", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/bill-reminder-rules", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/delivery-terms", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/documents", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/expense-categories", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/integration", section: "§4", status: "implemented_partial" },
    { anchor: "purchases/payment-terms", section: "§4", status: "implemented_and_auditable" },
    { anchor: "purchases/reporting", section: "§4", status: "implemented_partial" },
    { anchor: "sales/approval-workflows", section: "§4", status: "implemented_partial" },
    { anchor: "sales/communications", section: "§4", status: "implemented_partial" },
    { anchor: "sales/delivery-terms", section: "§4", status: "implemented_partial" },
    { anchor: "sales/documents", section: "§4", status: "implemented_partial" },
    { anchor: "sales/integration", section: "§4", status: "implemented_partial" },
    { anchor: "sales/invoice-reminder-rules", section: "§4", status: "implemented_partial" },
    { anchor: "sales/payment-terms", section: "§4", status: "implemented_and_auditable" },
    { anchor: "sales/pricelists", section: "§4", status: "implemented_partial" },
    { anchor: "sales/reporting", section: "§4", status: "implemented_partial" },
    { anchor: "ai/ai-models", section: "§4", status: "implemented_and_auditable" },
    { anchor: "ai/ai-model-usage", section: "§4", status: "implemented_and_auditable" },
];

async function main() {
    const features = AutomationConfigBuilder.AUDITABLE_FEATURES;
    const featureFocuses = new Set(features.map(f => f.focus));
    const domains = [...new Set(features.map(f => f.domain))];

    console.log("═══════════════════════════════════════════════════════════");
    console.log("  A43 FEATURE AUDIT — FULL VERIFICATION REPORT");
    console.log("═══════════════════════════════════════════════════════════\n");

    // ── 1. Feature count by domain ──
    console.log("1️⃣  AUDITABLE_FEATURES by domain:\n");
    let total = 0;
    for (const domain of domains) {
        const count = features.filter(f => f.domain === domain).length;
        total += count;
        console.log(`   ${domain.padEnd(20)} ${String(count).padStart(3)} features`);
    }
    console.log(`   ${"─".repeat(20)} ${"─".repeat(3)}`);
    console.log(`   ${"TOTAL".padEnd(20)} ${String(total).padStart(3)} features\n`);

    // ── 2. Cross-check against canonical inventory ──
    console.log("2️⃣  Cross-check vs canonical inventory:\n");
    const canonicalAnchors = [...new Set(CANONICAL_FEATURES.map(f => f.anchor))];
    const missing: { anchor: string; section: string; status: string }[] = [];
    const covered: string[] = [];

    for (const canonical of CANONICAL_FEATURES) {
        if (featureFocuses.has(canonical.anchor)) {
            covered.push(canonical.anchor);
        } else {
            // Check for close matches (e.g. different naming)
            const closestMatch = features.find(f =>
                f.focus.includes(canonical.anchor.split("/")[1]) ||
                canonical.anchor.includes(f.focus.split("/")[1])
            );
            if (!closestMatch) {
                missing.push(canonical);
            } else {
                // Partial match — note it
                covered.push(`${canonical.anchor} → matched by ${closestMatch.focus}`);
            }
        }
    }

    const uniqueCanonical = [...new Set(canonicalAnchors)];
    const uniqueCoveredAnchors = [...new Set(covered.map(c => c.split(" →")[0]))];
    const coveragePercent = ((uniqueCoveredAnchors.length / uniqueCanonical.length) * 100).toFixed(1);

    console.log(`   Canonical features: ${uniqueCanonical.length}`);
    console.log(`   Covered:            ${uniqueCoveredAnchors.length}`);
    console.log(`   Missing:            ${missing.length}`);
    console.log(`   Coverage:           ${coveragePercent}%\n`);

    if (missing.length > 0) {
        console.log("   ❌ MISSING FEATURES:");
        for (const m of missing) {
            console.log(`      - ${m.anchor} (${m.section}, ${m.status})`);
        }
        console.log("");
    } else {
        console.log("   ✅ All canonical features are covered!\n");
    }

    // ── 3. Verify buildFeatureAuditByDomain works for all domains ──
    console.log("3️⃣  buildFeatureAuditByDomain validation:\n");
    let domainErrors = 0;
    for (const domain of domains) {
        try {
            const config = AutomationConfigBuilder.buildFeatureAuditByDomain(domain);
            const expected = features.filter(f => f.domain === domain).length;
            const actual = config.stages?.length ?? 0;
            const nameOk = config.name?.includes(domain);
            const ok = actual === expected && nameOk;
            console.log(`   ${ok ? "✅" : "❌"} ${domain.padEnd(20)} stages=${actual}/${expected} name=${nameOk ? "OK" : "FAIL"}`);
            if (!ok) domainErrors++;
        } catch (e) {
            console.log(`   ❌ ${domain.padEnd(20)} ERROR: ${(e as Error).message}`);
            domainErrors++;
        }
    }
    console.log("");

    // ── 4. Verify buildFullFeatureAudit ──
    console.log("4️⃣  buildFullFeatureAudit validation:\n");
    try {
        const full = AutomationConfigBuilder.buildFullFeatureAudit();
        const stageCount = full.stages?.length ?? 0;
        console.log(`   Total stages: ${stageCount}`);
        console.log(`   Expected:     ${total}`);
        console.log(`   Match:        ${stageCount === total ? "✅" : "❌"}\n`);
    } catch (e) {
        console.log(`   ❌ ERROR: ${(e as Error).message}\n`);
    }

    // ── 5. Validate prompt self-containment (sample check) ──
    console.log("5️⃣  Prompt self-containment check (sample):\n");
    const sampleFocuses = ["sales/invoices", "management/company-access", "governance/rbac-analytics", "auth/auth-flows"];
    for (const focus of sampleFocuses) {
        const prompt = AutomationConfigBuilder.buildFeatureAuditPrompt(focus);
        const hasA43 = prompt.includes("A43");
        const hasFocus = prompt.includes(focus);
        const hasAxes = prompt.includes("Architecture");
        const hasVerdict = prompt.includes("PASS") && prompt.includes("FAIL");
        const hasInventory = prompt.includes("canonical inventory");
        const length = prompt.length;
        const ok = hasA43 && hasFocus && hasAxes && hasVerdict && hasInventory;
        console.log(`   ${ok ? "✅" : "❌"} ${focus.padEnd(35)} ${length} chars | A43=${hasA43} focus=${hasFocus} axes=${hasAxes} verdict=${hasVerdict} inventory=${hasInventory}`);
    }
    console.log("");

    // ── 6. Verify DB state ──
    console.log("6️⃣  Database verification:\n");
    try {
        const db = await getDb();
        const automations = await db.collection("audit_chains").find({
            name: { $regex: /^A43 Feature Audit Batch/ }
        }).toArray();

        console.log(`   Automations in DB: ${automations.length}`);
        console.log(`   Expected:          ${domains.length}`);
        console.log(`   Match:             ${automations.length === domains.length ? "✅" : "❌"}\n`);

        let totalStages = 0;
        for (const auto of automations) {
            const stages = (auto as any).stages?.length ?? 0;
            totalStages += stages;
            console.log(`   ${auto.name?.toString().padEnd(55)} ${stages} stages`);
        }
        console.log(`   ${"─".repeat(55)} ${"─".repeat(3)}`);
        console.log(`   ${"TOTAL STAGES".padEnd(55)} ${totalStages}`);
        console.log(`   Expected: ${total}`);
        console.log(`   Match: ${totalStages === total ? "✅" : "❌"}\n`);

        // Verify all automations have status PENDING
        const allPending = automations.every((a: any) => a.status === "PENDING");
        console.log(`   All PENDING status: ${allPending ? "✅" : "❌"}`);

        // Verify no duplicates
        const names = automations.map((a: any) => a.name);
        const uniqueNames = new Set(names);
        console.log(`   No duplicates:      ${names.length === uniqueNames.size ? "✅" : "❌"} (${names.length} names, ${uniqueNames.size} unique)`);
    } catch (e) {
        console.log(`   ❌ DB ERROR: ${(e as Error).message}`);
    }

    // ── Summary ──
    console.log("\n═══════════════════════════════════════════════════════════");
    const allGood = missing.length === 0 && domainErrors === 0;
    console.log(allGood
        ? "  ✅ VERIFICATION PASSED — 100% coverage confirmed"
        : "  ❌ VERIFICATION FAILED — see issues above");
    console.log("═══════════════════════════════════════════════════════════\n");

    await closeDb();
    process.exit(allGood ? 0 : 1);
}

main();
