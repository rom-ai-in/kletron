import type { AutomationDefinition, AutomationStageConfig, AutomationTriggerType } from "./automationTypes";
import { LLM_PROVIDERS } from "./schemas/llmConfig.schema";
import { CANONICAL_AGENT_GRAPH_IDS as GX } from "./canonicalStageGraphs";

/**
 * AutomationConfigBuilder - Pre-configured automation templates and validation utilities
 */
export class AutomationConfigBuilder {
    /**
     * Old preset keys accepted by buildAutomation / API for backward compatibility.
     * Prefer canonical keys from PRESETS in new code.
     */
    private static readonly LEGACY_PRESET_ALIASES: Record<string, string> = {
        FULL_STACK_LOGIC_AUDIT: "CODE_FULL_REVIEW",
        FULL_AUDIT: "CODE_FULL_REVIEW",
        SECURITY_DEEP_DIVE: "CODE_SECURITY_WEBHOOK",
        I18N_QUALITY: "CODE_FULL_REVIEW",
        API_QUALITY_GATE: "CODE_PR_GATE",
        FULL_BACKEND_AUDIT: "CODE_FULL_REVIEW",
        FULL_FRONTEND_AUDIT: "CODE_FULL_REVIEW",
        MONGO_INDEX_AUDIT: "CODE_FULL_REVIEW",
        DOC_QUALITY_AUDIT: "CODE_WEEKLY_HEALTH",
        CONTINUOUS_IMPROVEMENT: "CODE_WEEKLY_HEALTH",
        BUSINESS_ANALYSIS_FULL: "BUSINESS_STRATEGY_PIPELINE",
        QUICK_FEATURE_BRAINSTORM: "BUSINESS_IDEATION",
        COMPETITIVE_DEEP_DIVE: "BUSINESS_COMPETITIVE_SCAN",
        FEATURE_AUDIT: "PRODUCT_AREA_DEEP_DIVE",
    };

    /**
     * Pre-configured automation presets
     */
    static readonly PRESETS: Record<string, Partial<AutomationDefinition>> = {
        /**
         * Coding — broad repository review (manual)
         */
        CODE_FULL_REVIEW: {
            name: "Code — full repository review",
            description:
                "Four-stage pass: map the codebase, review backend/APIs, review client/UI, then security and synthesis. Suggested trigger: Manual when you want a periodic health snapshot.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "cr-map",
                    name: "Map architecture & hotspots",
                    prompt:
                        "Explore the repository structure. Summarize languages, frameworks, main packages, entry points, and how requests/data flow. Call out ambiguous or overly coupled areas. Output a short map and a list of hotspots to audit next.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "cr-backend",
                    name: "Backend, APIs & data",
                    prompt:
                        "Review server-side code: HTTP/API contracts, validation, auth and authorization, errors, persistence, and background jobs. Flag correctness risks, inconsistent patterns, and missing guards. Use file paths and severities (blocker/warning/info).",
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["cr-map.findings"],
                },
                {
                    id: "cr-frontend",
                    name: "Client, UX & delivery",
                    prompt:
                        "Review apps clients consume: UI architecture, routing, loading/error/empty states, accessibility basics, i18n if applicable, and performance footguns. Tie findings to concrete files.",
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["cr-map.findings"],
                },
                {
                    id: "cr-security-synth",
                    name: "Security check & consolidated report",
                    prompt:
                        "Focus on security: secrets, injection, authz gaps, unsafe deserialization, SSRF, uploads, dependency/config risk. Then merge with themes from prior stages into one prioritized report: executive summary, top risks, quick wins, deeper follow-ups.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["cr-backend.findings", "cr-frontend.findings"],
                },
            ],
        },

        /**
         * Coding — PR-oriented review (git webhook)
         */
        CODE_PR_GATE: {
            name: "Code — pull request gate",
            description:
                "Short review for integration flow: assess the change itself, then rollout/tests/docs risks. Suggested trigger: Git event on pull_request (adjust branches in step 3).",
            triggerType: "git_event" as AutomationTriggerType,
            gitEventConfig: {
                events: ["pull_request"],
                branches: ["main", "master", "develop"],
            },
            stages: [
                {
                    id: "pr-change",
                    name: "Change-focused review",
                    prompt:
                        "Review the current change context (diff, touched paths, PR description if present). Identify regressions, API compatibility breaks, missing validation, auth gaps, and risky shortcuts. Stay scoped to what changed plus its direct dependencies.",
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "pr-ship",
                    name: "Ship checklist",
                    prompt:
                        "From the change review, produce a concise ship checklist: required tests, docs/migration notes, feature flags, monitoring, and rollback. Flag anything that should block merge.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["pr-change.findings"],
                },
            ],
        },

        /**
         * Coding — security pass triggered by HTTP webhook
         */
        CODE_SECURITY_WEBHOOK: {
            name: "Code — security review (webhook)",
            description:
                "Two-stage security pass suitable for CI or an external orchestrator posting to your automation webhook. Suggested trigger: Webhook (configure secret in step 3).",
            triggerType: "webhook" as AutomationTriggerType,
            stages: [
                {
                    id: "sec-pass",
                    name: "Threat-oriented review",
                    prompt:
                        "Perform a security-oriented review of the repository: authentication and authorization, secret handling, input validation, data exposure, dependency and configuration risk, and common web/API vulnerabilities. Output findings with severity and remediation.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "sec-report",
                    name: "Security summary",
                    prompt:
                        "Consolidate findings into a short report: critical path, grouped themes, recommended order of fixes, and items needing human verification.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["sec-pass.findings"],
                },
            ],
        },

        /**
         * Coding — scheduled lightweight scan
         */
        CODE_WEEKLY_HEALTH: {
            name: "Code — weekly health scan",
            description:
                "Recurring hygiene: dependency and complexity signals, test/doc drift, then a brief summary. Suggested trigger: Schedule (Sundays 04:00 UTC by default; change in step 3).",
            triggerType: "schedule" as AutomationTriggerType,
            schedule: {
                enabled: true,
                cron: "0 4 * * 0",
                timezone: "UTC",
            },
            stages: [
                {
                    id: "wh-scan",
                    name: "Hygiene & risk scan",
                    prompt:
                        "Scan for hygiene issues: outdated or vulnerable dependencies (if tools allow), noisy TODO/FIXME clusters, obvious complexity or duplication hotspots, and flaky-test smells. Cap at the highest-impact items.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "wh-drift",
                    name: "Tests & docs drift",
                    prompt:
                        "Check whether critical paths appear tested and whether public APIs or user-facing flows are reflected in docs or changelogs. Note gaps without boiling the ocean.",
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["wh-scan.findings"],
                },
                {
                    id: "wh-summary",
                    name: "Weekly summary",
                    prompt:
                        "Write a brief weekly engineering summary from prior findings: top 5 actions, owners if inferable, and suggested ordering.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["wh-scan.findings", "wh-drift.findings"],
                },
            ],
        },

        /**
         * Coding — deep dive on one slice (edit placeholder)
         */
        PRODUCT_AREA_DEEP_DIVE: {
            name: "Code — product area deep dive",
            description:
                "Single-stage focused review. Replace [AREA] in the stage name and prompt with your target (module path, feature name, or bounded scope). Suggested trigger: Manual.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "pad-area",
                    name: "Deep dive: [AREA]",
                    prompt:
                        "Review one product area only. Replace [AREA] with the concrete scope (e.g. module, route prefix, or capability).\n\n1) Map entry points: APIs/services, UI routes, config, and data touched.\n2) Audit correctness, edge cases, authorization, and data integrity.\n3) Note UX states (loading/error/empty) where relevant.\n4) List findings with severity and file references; finish with verdict and next steps.\n\nStay within [AREA]; avoid unrelated code.",
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                },
            ],
        },

        /**
         * Business — strategy & market pipeline (manual)
         */
        BUSINESS_STRATEGY_PIPELINE: {
            name: "Business — strategy & market",
            description:
                "From context to market signals, competition, opportunities, and an executive summary. Suggested trigger: Manual (workshops, planning). Use web_search where helpful.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "bs-context",
                    name: "Context & goals",
                    prompt:
                        "Clarify product, users, problem, current offerings, and business goals using repository/docs context where available. List explicit assumptions and unknowns.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "bs-market",
                    name: "Market & trends",
                    prompt:
                        "Identify market structure, demand drivers, and macro trends relevant to this product. Use web_search. Highlight opportunities and threats.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bs-context.findings"],
                },
                {
                    id: "bs-compete",
                    name: "Competitive landscape",
                    prompt:
                        "Summarize key alternatives and competitors, positioning, and typical buyer criteria. Note where the product can win or must catch up.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bs-context.findings", "bs-market.findings"],
                },
                {
                    id: "bs-opps",
                    name: "Opportunities & priorities",
                    prompt:
                        "Propose prioritized initiatives (features, partnerships, pricing/packaging, geos) with rationale, rough effort, and dependencies. Separate quick wins from strategic bets.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bs-compete.findings"],
                },
                {
                    id: "bs-report",
                    name: "Executive summary",
                    prompt:
                        "Produce a concise markdown brief: thesis, market, competition, recommended bets, risks, and metrics to track.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bs-context.findings", "bs-market.findings", "bs-compete.findings", "bs-opps.findings"],
                },
            ],
        },

        /**
         * Business — competitive scan
         */
        BUSINESS_COMPETITIVE_SCAN: {
            name: "Business — competitive scan",
            description:
                "Focused competitor research and positioning. Suggested trigger: Manual before launches or pricing moves.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "bc-frame",
                    name: "Category & rivals",
                    prompt:
                        "Define the category, buyer, and shortlist of competitors or substitutes. Summarize our differentiation hypothesis.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "bc-research",
                    name: "Desk research",
                    prompt:
                        "Use web_search to capture each rival's positioning, packaging/pricing signals, strengths/weaknesses, and recent moves.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bc-frame.findings"],
                },
                {
                    id: "bc-out",
                    name: "Matrix & plays",
                    prompt:
                        "Build a simple capability matrix and list strategic plays: what to emphasize, what to build, and what to ignore.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bc-frame.findings", "bc-research.findings"],
                },
            ],
        },

        /**
         * Business — fast ideation
         */
        BUSINESS_IDEATION: {
            name: "Business — ideation sprint",
            description:
                "Short loop: context, ideas, prioritization. Suggested trigger: Manual for brainstorms.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "bi-context",
                    name: "Snapshot context",
                    prompt:
                        "Capture user segments, Jobs-to-be-done, and current product footprint from available context. Keep it brief.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "bi-ideas",
                    name: "Generate options",
                    prompt:
                        "Produce a diverse set of initiatives (product, GTM, ops). For each: title, hypothesis, impact, effort (S/M/L), and risks.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bi-context.findings"],
                },
                {
                    id: "bi-pick",
                    name: "Prioritize",
                    prompt:
                        "Rank ideas, call out top 3 quick wins and top 3 strategic bets, and list experiments to validate uncertainty.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["bi-ideas.findings"],
                },
            ],
        },

        /**
         * Business — GTM & sales narrative
         */
        BUSINESS_GTM_SALES: {
            name: "Business — GTM & sales",
            description:
                "ICP, messaging, funnel, and objection handling. Suggested trigger: Manual before campaigns or pipeline reviews.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "gtm-icp",
                    name: "ICP & segments",
                    prompt:
                        "Define ideal customer profiles, segments to avoid, and buying triggers. Tie to concrete pains and outcomes.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "gtm-msg",
                    name: "Messaging & proof",
                    prompt:
                        "Draft core narrative: one-liner, value pillars, proof points, and comparative claims (honest).",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["gtm-icp.findings"],
                },
                {
                    id: "gtm-funnel",
                    name: "Funnel & motions",
                    prompt:
                        "Outline funnel stages, channels, assets needed, and handoffs (marketing → sales → success).",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["gtm-msg.findings"],
                },
                {
                    id: "gtm-objections",
                    name: "Objections & FAQs",
                    prompt:
                        "List top objections with concise responses; add a short discovery question cheat sheet for reps.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["gtm-funnel.findings"],
                },
            ],
        },

        /**
         * Business — fundraising prep
         */
        BUSINESS_FUNDRAISING: {
            name: "Business — fundraising prep",
            description:
                "Narrative, investor Q&A, and diligence checklist. Suggested trigger: Manual before outreach or data room updates.",
            triggerType: "manual" as AutomationTriggerType,
            stages: [
                {
                    id: "fr-story",
                    name: "Story & milestones",
                    prompt:
                        "Articulate problem, solution, why now, traction, business model, and near-term milestones. Flag gaps in evidence.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "fr-market",
                    name: "Market & ambition",
                    prompt:
                        "Frame TAM/SAM logic cautiously, expansion paths, and long-term vision without overclaiming.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["fr-story.findings"],
                },
                {
                    id: "fr-qa",
                    name: "Investor Q&A",
                    prompt:
                        "Prepare answers for standard investor questions: competition, moat, churn/risk, unit economics placeholders, team, and capital efficiency.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["fr-story.findings", "fr-market.findings"],
                },
                {
                    id: "fr-diligence",
                    name: "Diligence checklist",
                    prompt:
                        "Produce a practical diligence checklist (product, legal/IP, finance, security, people) mapped to typical documents or artifacts.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["fr-qa.findings"],
                },
            ],
        },

        /**
         * Daily focus — ingest tasks, mail, calendar, memory; prioritize urgent vs important
         */
        DAILY_FOCUS_PRIORITIES: {
            name: "Daily focus — prioritize today",
            description:
                "Pulls together workspace context (bootstrap_context), Gmail threads needing attention, calendar constraints, and repo todo markers (todo_search). Then separates urgent vs important and proposes a realistic \"do now\" plan. Suggested trigger: Schedule (weekday mornings); switch to Manual if you prefer on-demand.",
            triggerType: "schedule" as AutomationTriggerType,
            schedule: {
                enabled: true,
                cron: "0 8 * * 1-5",
                timezone: "UTC",
            },
            stages: [
                {
                    id: "df-ingest",
                    name: "Gather inbox, calendar & open loops",
                    prompt:
                        "Create a structured snapshot of what is competing for attention today.\n\n1) Call bootstrap_context to load relevant workspace/session memory, notes, and continuity context.\n2) Gmail: use gmail_list_labels then gmail_search_messages for unread or needs-reply in the last 48–72h (adjust query if empty). Read only what you must with gmail_read_message—stay concise.\n3) Calendar: calendar_list_calendars then calendar_list_events for today and tomorrow; note hard commitments and prep needed.\n4) Optional: todo_search for high-signal TODO/FIXME/HACK clusters in the active codebase if engineering work is in scope.\n5) Optional: github_api only if it helps surface assigned PRs/issues.\n\nOutput sections: **Inputs seen**, **Explicit deadlines**, **People waiting on you**, **Risks if slipped**.",
                    graphId: GX.EXPLORER,
                    llmProvider: "lmstudio",
                },
                {
                    id: "df-matrix",
                    name: "Urgent vs important & tradeoffs",
                    prompt:
                        "Using the prior snapshot, classify every significant item into an Eisenhower-style grid:\n\n- **Q1** urgent & important (do first)\n- **Q2** important, not urgent (schedule deep work)\n- **Q3** urgent, not important (delegate, shorten, or batch)\n- **Q4** neither (defer or drop)\n\nFlag confusion between \"loud\" (notifications) vs \"valuable\" (outcomes). Note dependencies, smallest next actions, and anything that should be a calendar block vs a 15-minute reply.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["df-ingest.findings"],
                },
                {
                    id: "df-plan",
                    name: "Today's plan & next actions",
                    prompt:
                        "Produce a single-page brief for TODAY:\n\n1) **Top 3 outcomes** (not tasks)\n2) **Do now** (ordered, time-boxed; include rough duration)\n3) **Schedule / calendar moves** (concrete slots)\n4) **Inbox zero tactics** (which threads get a reply, which get snoozed)\n5) **Protect focus**: what to ignore until afternoon\n6) **End-of-day check**: one metric or proof each outcome moved\n\nKeep tone actionable; avoid generic advice—tie bullets to items discovered earlier.",
                    graphId: GX.PLANNER,
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["df-ingest.findings", "df-matrix.findings"],
                },
            ],
        },

    };

    /**
     * All auditable features extracted from the A43 canonical inventory.
     * Only includes features with status = implemented_and_auditable.
     */
    static readonly AUDITABLE_FEATURES: { focus: string; label: string; domain: string }[] = [
        // ─── Foundation ─────────────────────────────────────────
        { focus: "foundation/contacts", label: "Contacts", domain: "foundation" },

        // ─── Sales (core + subfeatures from §2 + §4) ───────────
        { focus: "sales/invoices", label: "Sales Invoices", domain: "sales" },
        { focus: "sales/orders", label: "Sales Orders", domain: "sales" },
        { focus: "sales/quotes", label: "Sales Quotes", domain: "sales" },
        { focus: "sales/credit-notes", label: "Sales Credit Notes", domain: "sales" },
        { focus: "sales/sales-config", label: "Sales Config", domain: "sales" },
        { focus: "sales/approval-workflows", label: "Sales Approval Workflows", domain: "sales" },
        { focus: "sales/pricelists", label: "Sales Pricelists", domain: "sales" },
        { focus: "sales/communications", label: "Sales Communications", domain: "sales" },
        { focus: "sales/invoice-reminder-rules", label: "Invoice Reminder Rules", domain: "sales" },
        { focus: "sales/payment-terms", label: "Sales Payment Terms", domain: "sales" },
        { focus: "sales/delivery-terms", label: "Sales Delivery Terms", domain: "sales" },
        { focus: "sales/documents", label: "Sales Documents", domain: "sales" },
        { focus: "sales/integration", label: "Sales Integration", domain: "sales" },
        { focus: "sales/reporting", label: "Sales Reporting", domain: "sales" },

        // ─── Purchases (core + subfeatures from §2 + §4) ───────
        { focus: "purchases/expenses", label: "Expenses", domain: "purchases" },
        { focus: "purchases/bills", label: "Supplier Bills", domain: "purchases" },
        { focus: "purchases/purchase-orders", label: "Purchase Orders", domain: "purchases" },
        { focus: "purchases/expense-reports", label: "Expense Reports", domain: "purchases" },
        { focus: "purchases/budgets", label: "Purchase Budgets", domain: "purchases" },
        { focus: "purchases/credit-notes", label: "Purchase Credit Notes", domain: "purchases" },
        { focus: "purchases/vendor-management", label: "Vendor Management", domain: "purchases" },
        { focus: "purchases/purchase-config", label: "Purchase Config", domain: "purchases" },
        { focus: "purchases/purchase-ocr", label: "Purchase OCR", domain: "purchases" },
        { focus: "purchases/approval-workflows", label: "Purchase Approval Workflows", domain: "purchases" },
        { focus: "purchases/bill-reminder-rules", label: "Bill Reminder Rules", domain: "purchases" },
        { focus: "purchases/expense-categories", label: "Expense Categories", domain: "purchases" },
        { focus: "purchases/payment-terms", label: "Purchase Payment Terms", domain: "purchases" },
        { focus: "purchases/delivery-terms", label: "Purchase Delivery Terms", domain: "purchases" },
        { focus: "purchases/documents", label: "Purchase Documents", domain: "purchases" },
        { focus: "purchases/integration", label: "Purchase Integration", domain: "purchases" },
        { focus: "purchases/reporting", label: "Purchase Reporting", domain: "purchases" },

        // ─── Accounting (core + subfeatures from §2 + §4) ──────
        { focus: "accounting/banking", label: "Banking & Reconciliation", domain: "accounting" },
        { focus: "accounting/ledger", label: "Ledger & Accounting Core", domain: "accounting" },
        { focus: "accounting/fixed-assets", label: "Fixed Assets", domain: "accounting" },
        { focus: "accounting/compliance", label: "Fiscal Compliance", domain: "accounting" },
        { focus: "accounting/closing", label: "Closing Operations", domain: "accounting" },
        { focus: "accounting/accounting-config", label: "Accounting Config", domain: "accounting" },
        { focus: "accounting/currency", label: "Currency & Exchange Rates", domain: "accounting" },
        { focus: "accounting/governance", label: "Accounting Governance", domain: "accounting" },
        { focus: "accounting/default-account-mappings", label: "Default Account Mappings", domain: "accounting" },
        { focus: "accounting/closing-policies", label: "Closing Policies", domain: "accounting" },
        { focus: "accounting/approval-workflows", label: "Accounting Approval Workflows", domain: "accounting" },
        { focus: "accounting/reminder-rules", label: "Accounting Reminder Rules", domain: "accounting" },
        { focus: "accounting/integration", label: "Accounting Integration", domain: "accounting" },

        // ─── Projects (core + subfeatures from §2 + §4) ────────
        { focus: "projects/projects", label: "Projects Core", domain: "projects" },
        { focus: "projects/project-tasks", label: "Project Tasks", domain: "projects" },
        { focus: "projects/project-expenses", label: "Project Expenses", domain: "projects" },
        { focus: "projects/time-entries", label: "Time Entries", domain: "projects" },
        { focus: "projects/budget", label: "Project Budget", domain: "projects" },
        { focus: "projects/portfolio", label: "Project Portfolio", domain: "projects" },
        { focus: "projects/projects-config", label: "Projects Config", domain: "projects" },
        { focus: "projects/invoicing", label: "Project Invoicing", domain: "projects" },
        { focus: "projects/approvals", label: "Project Approvals", domain: "projects" },
        { focus: "projects/reporting", label: "Project Reporting", domain: "projects" },

        // ─── HR (core + subfeatures from §2 + §4) ──────────────
        { focus: "hr/employees", label: "HR Employees", domain: "hr" },
        { focus: "hr/payroll", label: "Payroll", domain: "hr" },
        { focus: "hr/leave-management", label: "Leave Management", domain: "hr" },
        { focus: "hr/hr-config", label: "HR Config", domain: "hr" },
        { focus: "hr/payroll-declarations", label: "Payroll Declarations", domain: "hr" },
        { focus: "hr/payroll-config", label: "Payroll Config", domain: "hr" },
        { focus: "hr/catalogs", label: "HR Catalogs", domain: "hr" },
        { focus: "hr/time-tracking", label: "HR Time Tracking", domain: "hr" },
        { focus: "hr/payroll-ch", label: "Payroll CH (Switzerland)", domain: "hr" },
        { focus: "hr/integration", label: "HR Integration", domain: "hr" },
        { focus: "hr/reporting", label: "HR Reporting", domain: "hr" },
        { focus: "hr/documents", label: "HR Documents", domain: "hr" },

        // ─── Inventory (core + subfeatures from §2 + §4) ───────
        { focus: "inventory/products", label: "Products", domain: "inventory" },
        { focus: "inventory/stock", label: "Stock Overview", domain: "inventory" },
        { focus: "inventory/warehouses", label: "Warehouses", domain: "inventory" },
        { focus: "inventory/transfers", label: "Inventory Transfers", domain: "inventory" },
        { focus: "inventory/adjustments", label: "Inventory Adjustments", domain: "inventory" },
        { focus: "inventory/returns", label: "Inventory Returns", domain: "inventory" },
        { focus: "inventory/costing", label: "Inventory Costing", domain: "inventory" },
        { focus: "inventory/stocktake", label: "Stocktake", domain: "inventory" },
        { focus: "inventory/replenishment", label: "Replenishment", domain: "inventory" },
        { focus: "inventory/inventory-config", label: "Inventory Config", domain: "inventory" },
        { focus: "inventory/categories", label: "Product Categories", domain: "inventory" },
        { focus: "inventory/tracking", label: "Tracking & Traceability", domain: "inventory" },
        { focus: "inventory/valuation", label: "Inventory Valuation", domain: "inventory" },
        { focus: "inventory/reporting", label: "Inventory Reporting", domain: "inventory" },
        { focus: "inventory/integration", label: "Inventory Integration", domain: "inventory" },

        // ─── Communication (core + subfeatures from §2 + §4) ───
        { focus: "communication/approvals", label: "Approval Workflows", domain: "communication" },
        { focus: "communication/tasks", label: "Tasks", domain: "communication" },
        { focus: "communication/documents", label: "Document Management", domain: "communication" },
        { focus: "communication/communication-config", label: "Communication Config", domain: "communication" },
        { focus: "communication/comments", label: "Comments", domain: "communication" },
        { focus: "communication/pitch-deck", label: "Pitch Deck", domain: "communication" },
        { focus: "communication/documents-config", label: "Documents Config", domain: "communication" },
        { focus: "communication/inbound-email", label: "Inbound Email", domain: "communication" },

        // ─── AI (§2 + §3 + §4) ─────────────────────────────────
        { focus: "ai/agents", label: "Unified Agents", domain: "ai" },
        { focus: "ai/ai-config", label: "AI Config", domain: "ai" },
        { focus: "ai/ai-governance", label: "AI Governance (Models/Runs/Stats)", domain: "ai" },
        { focus: "ai/ai-models", label: "AI Models Catalog", domain: "ai" },
        { focus: "ai/ai-model-usage", label: "AI Model Usage", domain: "ai" },

        // ─── System ─────────────────────────────────────────────
        { focus: "notifications/notifications", label: "Notifications", domain: "system" },
        { focus: "notifications/channels", label: "Notification Channels", domain: "system" },

        // ─── Management (§3 — repo extension inventory) ────────
        { focus: "management/company-access", label: "Company Access (Users/Groups/Permissions)", domain: "management" },
        { focus: "management/tenant-access", label: "Tenant Access", domain: "management" },
        { focus: "management/partner-access", label: "Partner Access", domain: "management" },
        { focus: "management/superadmin-access", label: "Superadmin Access", domain: "management" },
        { focus: "management/partner-management", label: "Partner Management", domain: "management" },
        { focus: "management/companies", label: "Company Management", domain: "management" },
        { focus: "management/modules", label: "Module Authorization", domain: "management" },
        { focus: "management/billing", label: "Billing Settings", domain: "management" },
        { focus: "management/settings", label: "General Settings", domain: "management" },
        { focus: "management/profile", label: "Profile & Account", domain: "management" },

        // ─── Transversal (§3 — cross-cutting features) ─────────
        { focus: "transversal/portal-shell", label: "Portal Shell", domain: "transversal" },
        { focus: "transversal/communication-inbox", label: "Communication Inbox", domain: "transversal" },
        { focus: "transversal/approval-policies", label: "Approval Policies", domain: "transversal" },
        { focus: "transversal/reporting", label: "Shared Reporting", domain: "transversal" },
        { focus: "transversal/documents-engine", label: "Documents Engine", domain: "transversal" },
        { focus: "transversal/compliance-calendar", label: "Compliance Calendar", domain: "transversal" },
        { focus: "transversal/delivery-payment-terms", label: "Delivery/Payment Terms & Reminders", domain: "transversal" },

        // ─── Governance (§3 — superadmin/ops features) ──────────
        { focus: "governance/countries", label: "Countries Hub", domain: "governance" },
        { focus: "governance/compliance-knowledge", label: "Compliance Knowledge", domain: "governance" },
        { focus: "governance/i18n-ops", label: "i18n Ops", domain: "governance" },
        { focus: "governance/ops-errors-cron", label: "Ops/Errors/Cron", domain: "governance" },
        { focus: "governance/documents-observability", label: "Documents Observability", domain: "governance" },
        { focus: "governance/rbac-analytics", label: "RBAC Analytics", domain: "governance" },
        { focus: "governance/seeding-reconciliation", label: "Seeding & Reconciliation", domain: "governance" },
        { focus: "governance/partner-client-links", label: "Partner-Client Links & Impersonation", domain: "governance" },

        // ─── Internal (§3 — internal workspace features) ────────
        { focus: "internal/marketing-blog", label: "Marketing Blog", domain: "internal" },
        { focus: "internal/social-media", label: "Social Media", domain: "internal" },
        { focus: "internal/crm-prospecting", label: "CRM & Prospecting", domain: "internal" },
        { focus: "internal/zefix", label: "Zefix Operations", domain: "internal" },

        // ─── Auth (§3 — session/identity flows) ─────────────────
        { focus: "auth/auth-flows", label: "Auth Flows (Login/MFA/SSO)", domain: "auth" },
    ];

    /**
     * Build an automation from a preset or custom configuration
     */
    static buildAutomation(preset: string): Partial<AutomationDefinition>;
    static buildAutomation(config: Partial<AutomationDefinition>): Partial<AutomationDefinition>;
    static buildAutomation(input: string | Partial<AutomationDefinition>): Partial<AutomationDefinition> {
        if (typeof input === "string") {
            const key = this.LEGACY_PRESET_ALIASES[input] ?? input;
            const preset = this.PRESETS[key];
            if (!preset) {
                throw new Error(`Unknown preset: ${input}`);
            }
            return this.ensurePresetPrompts(preset);
        }
        return input;
    }

    /**
     * Build a self-contained A43 feature audit prompt for a given focus.
     * The prompt includes all rules, axes, and output format so that each
     * stage can run with a completely fresh LLM context.
     */
    static buildFeatureAuditPrompt(focus: string): string {
        return [
            `# A43 Feature Audit — Focus: ${focus}`,
            "",
            "You are performing a comprehensive A43 domain/feature audit.",
            `Your FOCUS is: **${focus}**`,
            "",
            "## Phase 1: Inventory Reconstruction",
            "",
            "Before any code review, reconstruct the expected scope for this focus:",
            "1. Read \`packages/shared-ts/src/modules.ts\` to find the matching ModuleKey(s)",
            "2. Read the relevant API domain folder: \`apps/api/src/domain/${focus.split('/')[0]}/${focus.split('/').slice(1).join('/')}\`",
            "3. Check the navigation registry: \`apps/api/src/services/navigation.registry.ts\` and \`apps/api/src/services/navigation-registry/*.ts\`",
            "4. Check frontend routes: \`apps/web/app/**/*\` for \`page.tsx\`, \`route.ts\`, \`layout.tsx\`",
            "5. Produce a Focus Inventory Map with:",
            "   - All API endpoints/services for this feature",
            "   - All frontend routes",
            "   - Navigation registry entries",
            "   - Forms and schemas",
            "   - Related config/policies",
            "",
            "Classify each surface as: implemented_and_auditable | implemented_partial | api_only | ui_only | doc_only_or_planned | infrastructure_or_config",
            "",
            "Detect drifts: registry_without_ui, ui_without_registry, api_without_ui, doc_without_code, code_without_doc, module_registry_mismatch",
            "",
            "## Phase 2: Deep Audit (13 Mandatory Axes)",
            "",
            "For each axis, read the actual source files and produce findings:",
            "",
            "1. **Architecture** — Domain structure, service boundaries, dependency direction",
            "2. **Backend** — Business logic, invariants, state transitions, race conditions",
            "3. **API** — Contracts, validation, auth guards, error codes, pagination, idempotency",
            "4. **Frontend** — Component architecture, routing, SSR/CSR, error boundaries",
            "5. **TypeScript/ESM** — Type safety, branded types, schema strictness, exports",
            "6. **Forms** — Form governance, validation, schema alignment, field coverage",
            "7. **Lifecycles** — State machines, transitions, approval flows, status tracking",
            "8. **User Intent** — Does the feature deliver what a user expects?",
            "9. **Journey** — End-to-end flow from creation to completion",
            "10. **UX/UI** — Accessibility, empty/loading/error states, feedback, consistency",
            "11. **i18n** — Translation coverage, key consistency, missing keys, hardcoded strings",
            "12. **Security** — Auth, authorization, input validation, data exposure, least privilege",
            "13. **Tests** — Coverage gaps, missing unit/integration tests, critical untested paths",
            "",
            "## Phase 3: Verdict & Report",
            "",
            "Produce a structured report with:",
            "",
            "### Verdict: PASS or BLOCK",
            "BLOCK if any P0 finding exists (security vulnerability, data loss risk, broken critical flow).",
            "",
            "### Scoreboard",
            "Rate each of the 13 axes: ✅ PASS | ⚠️ WARNING | ❌ FAIL",
            "",
            "### Findings (numbered, prioritized)",
            "For each finding:",
            "- **ID**: F1, F2, ...",
            "- **Severity**: P0 (BLOQUANT) | P1 (HIGH) | P2 (MEDIUM) | P3 (LOW)",
            "- **Axis**: which of the 13 axes",
            "- **File**: exact file path",
            "- **Lines**: line range",
            "- **Description**: what is wrong",
            "- **Evidence**: code snippet or proof",
            "- **Fix**: concrete remediation",
            "",
            "### Gaps Matrix",
            "List any inventory drifts or missing surfaces detected in Phase 1.",
            "",
            "### Remediation Plan",
            "Group fixes into:",
            "- **Sprint 0** (immediate): P0 blockers",
            "- **Sprint 1** (next): P1 high-priority",
            "- **Sprint 2** (planned): P2-P3 improvements",
            "",
            "## Scope Rules",
            "",
            "- Source precedence: modules.ts > API domain > navigation registry > FE routes > docs",
            "- Exclude: node_modules, .next, dist, build, .git, __test__/demo-module",
            "- Do NOT audit features outside the focus scope",
            "- Use read_file, search_code, list_files, describe_structure extensively",
            "- Read at minimum 10+ source files before concluding",
        ].join("\n");
    }

    // ── Multi-Stage A43 Prompt Builders ──────────────────────────────────────
    // Each stage is self-contained with focused instructions so local LLMs
    // (like Nemotron 3 Nano) don't saturate their reasoning capacity.
    // Context passes between stages only via structured findings (contextFromPreviousStages).

    /**
     * Stage 1: Inventory Reconstruction
     * Small, deterministic task — reads modules.ts, API domain, nav registry, FE routes.
     * Outputs a structured inventory map.
     */
    static buildInventoryPrompt(focus: string): string {
        return [
            `# A43 Inventory Reconstruction — Focus: ${focus}`,
            "",
            `Your ONLY task is to reconstruct the complete inventory for: **${focus}**`,
            "",
            "## Steps",
            "",
            "1. Read \`packages/shared-ts/src/modules.ts\` to find the matching ModuleKey(s)",
            `2. Read the relevant API domain folder: \`apps/api/src/domain/${focus.split('/')[0]}/${focus.split('/').slice(1).join('/')}\``,
            "3. List all files in that domain folder using list_files",
            "4. Check the navigation registry: \`apps/api/src/services/navigation.registry.ts\` and \`apps/api/src/services/navigation-registry/*.ts\`",
            "5. Check frontend routes: search for relevant \`page.tsx\`, \`route.ts\`, \`layout.tsx\` files",
            "",
            "## Required Output",
            "",
            "Produce a structured report with:",
            "",
            "### Focus Inventory Map",
            "For each discovered surface, list:",
            "- **File path** (exact path)",
            "- **Type**: api_endpoint | api_service | api_schema | frontend_route | frontend_component | navigation_entry | config | policy",
            "- **Status**: implemented_and_auditable | implemented_partial | api_only | ui_only | doc_only_or_planned | infrastructure_or_config",
            "",
            "### Drift Detection",
            "Flag any: registry_without_ui, ui_without_registry, api_without_ui, doc_without_code, code_without_doc, module_registry_mismatch",
            "",
            "### Summary Statistics",
            "- Total API files found",
            "- Total frontend files found",
            "- Total navigation entries",
            "- Total schemas/forms",
            "",
            "## Scope Rules",
            "- Exclude: node_modules, .next, dist, build, .git, __test__/demo-module",
            "- Use read_file, list_files, search_code, describe_structure",
            `- ONLY inventory files related to ${focus} — do NOT audit other features`,
            "- Read at minimum 5 source files to confirm inventory",
        ].join("\n");
    }

    /**
     * Stage 2: Deep Audit — Structural Axes (1-6)
     * Receives inventory from Stage 1 as context.
     */
    static buildStructuralAuditPrompt(focus: string): string {
        return [
            `# A43 Structural Audit — Focus: ${focus}`,
            "",
            `You are auditing the STRUCTURAL aspects of: **${focus}**`,
            "",
            "## Context",
            "You have been provided with an inventory map from the previous stage.",
            "Use the file paths listed in the inventory to read and audit the actual source code.",
            "",
            "## Audit Axes (6 Structural Axes)",
            "",
            "For each axis, read the relevant source files and produce findings:",
            "",
            "1. **Architecture** — Domain structure, service boundaries, dependency direction, separation of concerns",
            "2. **Backend** — Business logic correctness, invariants, state transitions, race conditions, error handling",
            "3. **API** — Contracts, validation schemas, auth guards, error codes, pagination, idempotency",
            "4. **Frontend** — Component architecture, routing, SSR/CSR, error boundaries, state management",
            "5. **TypeScript/ESM** — Type safety, branded types, schema strictness, exports, module boundaries",
            "6. **Forms** — Form governance, validation rules, schema alignment, field coverage, Zod schemas",
            "",
            "## Required Output Format",
            "",
            "For each finding:",
            "- **ID**: SF1, SF2, ... (Structural Finding)",
            "- **Severity**: P0 (BLOQUANT) | P1 (HIGH) | P2 (MEDIUM) | P3 (LOW)",
            "- **Axis**: which of the 6 axes",
            "- **File**: exact file path",
            "- **Lines**: line range",
            "- **Description**: what is wrong",
            "- **Evidence**: code snippet or proof",
            "- **Fix**: concrete remediation",
            "",
            "## Scope Rules",
            "- Read the files identified in the inventory context",
            "- Read at minimum 8 source files before concluding",
            `- ONLY audit files related to ${focus}`,
            "- Exclude: node_modules, .next, dist, build, .git",
        ].join("\n");
    }

    /**
     * Stage 3: Deep Audit — Behavioral Axes (7-13)
     * Receives inventory from Stage 1 as context.
     */
    static buildBehavioralAuditPrompt(focus: string): string {
        return [
            `# A43 Behavioral Audit — Focus: ${focus}`,
            "",
            `You are auditing the BEHAVIORAL and UX aspects of: **${focus}**`,
            "",
            "## Context",
            "You have been provided with an inventory map from the previous stage.",
            "Use the file paths listed in the inventory to read and audit the actual source code.",
            "",
            "## Audit Axes (7 Behavioral Axes)",
            "",
            "For each axis, read the relevant source files and produce findings:",
            "",
            "7. **Lifecycles** — State machines, transitions, approval flows, status tracking, workflow completeness",
            "8. **User Intent** — Does the feature deliver what a user expects? Missing capabilities?",
            "9. **Journey** — End-to-end flow from creation to completion, happy path and error paths",
            "10. **UX/UI** — Accessibility, empty/loading/error states, user feedback, design consistency",
            "11. **i18n** — Translation coverage, key consistency, missing keys, hardcoded strings",
            "12. **Security** — Auth, authorization, input validation, data exposure, least privilege",
            "13. **Tests** — Coverage gaps, missing unit/integration tests, critical untested paths",
            "",
            "## Required Output Format",
            "",
            "For each finding:",
            "- **ID**: BF1, BF2, ... (Behavioral Finding)",
            "- **Severity**: P0 (BLOQUANT) | P1 (HIGH) | P2 (MEDIUM) | P3 (LOW)",
            "- **Axis**: which of the 7 axes",
            "- **File**: exact file path",
            "- **Lines**: line range",
            "- **Description**: what is wrong",
            "- **Evidence**: code snippet or proof",
            "- **Fix**: concrete remediation",
            "",
            "## Scope Rules",
            "- Read the files identified in the inventory context",
            "- Read at minimum 8 source files before concluding",
            `- ONLY audit files related to ${focus}`,
            "- Exclude: node_modules, .next, dist, build, .git",
        ].join("\n");
    }

    /**
     * Stage 4: Verdict & Report
     * Receives findings from Stage 2 and Stage 3 as context.
     * Pure synthesis — no file reading needed.
     */
    static buildVerdictPrompt(focus: string): string {
        return [
            `# A43 Verdict & Report — Focus: ${focus}`,
            "",
            `Generate the final A43 audit verdict for: **${focus}**`,
            "",
            "## Context",
            "You have been provided with:",
            "- Structural findings (axes 1-6) from a previous audit stage",
            "- Behavioral findings (axes 7-13) from a previous audit stage",
            "",
            "Synthesize these findings into the final report. Do NOT re-read source files — all evidence is in the provided findings.",
            "",
            "## Required Output",
            "",
            "### Verdict: PASS or BLOCK",
            "BLOCK if any P0 finding exists (security vulnerability, data loss risk, broken critical flow).",
            "",
            "### Scoreboard",
            "Rate each of the 13 axes: ✅ PASS | ⚠️ WARNING | ❌ FAIL",
            "1. Architecture, 2. Backend, 3. API, 4. Frontend, 5. TypeScript/ESM, 6. Forms,",
            "7. Lifecycles, 8. User Intent, 9. Journey, 10. UX/UI, 11. i18n, 12. Security, 13. Tests",
            "",
            "### All Findings (consolidated, prioritized)",
            "Merge structural and behavioral findings into a single numbered list, sorted by severity.",
            "Re-number as F1, F2, F3, ... preserving the original details.",
            "",
            "### Gaps Matrix",
            "List any inventory drifts or missing surfaces detected.",
            "",
            "### Remediation Plan",
            "Group fixes into:",
            "- **Sprint 0** (immediate): P0 blockers",
            "- **Sprint 1** (next): P1 high-priority",
            "- **Sprint 2** (planned): P2-P3 improvements",
            "",
            "### Statistics",
            "- Total findings by severity",
            "- Axes with most issues",
            "- Estimated remediation effort",
        ].join("\n");
    }

    /**
     * Build a multi-stage automation config for a single feature audit.
     * Decomposes the monolithic A43 audit into 4 context-isolated stages
     * optimized for local LLMs (Nemotron, etc.) that degrade with long ReAct loops.
     *
     * Stage 1: Inventory Reconstruction (~5 tool calls)
     * Stage 2: Structural Audit, axes 1-6 (~10 tool calls)
     * Stage 3: Behavioral Audit, axes 7-13 (~10 tool calls)
     * Stage 4: Verdict & Report (~0 tool calls, pure synthesis)
     */
    static buildFeatureAuditMultiStage(focus: string): AutomationStageConfig[] {
        const slug = focus.replace(/\//g, "-");
        return [
            {
                id: `fa-${slug}-inventory`,
                name: `Inventory: ${focus}`,
                prompt: this.buildInventoryPrompt(focus),
                graphId: GX.EXPLORER,
                llmProvider: "lmstudio" as const,
                // Fresh context — no dependencies
            },
            {
                id: `fa-${slug}-structural`,
                name: `Structural Audit: ${focus}`,
                prompt: this.buildStructuralAuditPrompt(focus),
                graphId: GX.CODER,
                llmProvider: "lmstudio" as const,
                contextFromPreviousStages: [`fa-${slug}-inventory.findings`],
            },
            {
                id: `fa-${slug}-behavioral`,
                name: `Behavioral Audit: ${focus}`,
                prompt: this.buildBehavioralAuditPrompt(focus),
                graphId: GX.CODER,
                llmProvider: "lmstudio" as const,
                contextFromPreviousStages: [`fa-${slug}-inventory.findings`],
            },
            {
                id: `fa-${slug}-verdict`,
                name: `Verdict: ${focus}`,
                prompt: this.buildVerdictPrompt(focus),
                graphId: GX.PLANNER,
                llmProvider: "lmstudio" as const,
                contextFromPreviousStages: [
                    `fa-${slug}-structural.findings`,
                    `fa-${slug}-behavioral.findings`,
                ],
            },
        ];
    }

    /**
     * Build a complete automation config for auditing a single feature.
     * One stage = one full audit. Context resets between stages in batch mode.
     */
    static buildFeatureAuditForFocus(focus: string): Partial<AutomationDefinition> {
        const label = this.AUDITABLE_FEATURES.find(f => f.focus === focus)?.label ?? focus;
        return {
            name: `A43 Feature Audit — ${label}`,
            description: `Complete A43 audit for ${focus}: inventory reconstruction, 13-axis deep audit, verdict, and remediation plan.`,
            stages: [
                {
                    id: `fa-${focus.replace(/\//g, "-")}`,
                    name: `Feature Audit: ${label}`,
                    prompt: this.buildFeatureAuditPrompt(focus),
                    graphId: GX.CODER,
                    llmProvider: "lmstudio",
                    // NO contextFromPreviousStages → fresh LLM context per feature
                },
            ],
        };
    }

    /**
     * Build a batch automation config that audits multiple features sequentially.
     * Each feature is a single self-contained stage with a fresh LLM context.
     * No contextFromPreviousStages between stages — context isolation guaranteed.
     *
     * @param focuses - Array of feature focus strings (e.g. ["sales/invoices", "purchases/bills"])
     * @param options - Optional domain filter or custom name
     */
    static buildFeatureAuditBatch(
        focuses: string[],
        options?: { name?: string; domain?: string }
    ): Partial<AutomationDefinition> {
        const filteredFocuses = options?.domain
            ? focuses.filter(f => {
                const entry = this.AUDITABLE_FEATURES.find(af => af.focus === f);
                return entry?.domain === options.domain;
            })
            : focuses;

        const domainLabel = options?.domain ? ` (${options.domain})` : "";
        const name = options?.name ?? `A43 Feature Audit Batch${domainLabel} — ${filteredFocuses.length} features`;

        return {
            name,
            description: `Complete A43 audit for ${filteredFocuses.length} features: ${filteredFocuses.join(", ")}. Each feature runs with a fresh LLM context.`,
            stages: filteredFocuses.map((focus) => {
                const label = this.AUDITABLE_FEATURES.find(f => f.focus === focus)?.label ?? focus;
                return {
                    id: `fa-${focus.replace(/\//g, "-")}`,
                    name: `Feature Audit: ${label}`,
                    prompt: this.buildFeatureAuditPrompt(focus),
                    graphId: GX.CODER,
                    llmProvider: "lmstudio" as const,
                    // NO contextFromPreviousStages → fresh LLM context per feature
                };
            }),
        };
    }

    /**
     * Build a batch automation for all auditable features in a given domain.
     */
    static buildFeatureAuditByDomain(domain: string): Partial<AutomationDefinition> {
        const domainFeatures = this.AUDITABLE_FEATURES.filter(f => f.domain === domain);
        if (domainFeatures.length === 0) {
            throw new Error(`No auditable features found for domain: ${domain}`);
        }
        return this.buildFeatureAuditBatch(
            domainFeatures.map(f => f.focus),
            { domain }
        );
    }

    /**
     * Build a batch automation for ALL auditable features.
     */
    static buildFullFeatureAudit(): Partial<AutomationDefinition> {
        return this.buildFeatureAuditBatch(
            this.AUDITABLE_FEATURES.map(f => f.focus),
            { name: `A43 Full Feature Audit — ${this.AUDITABLE_FEATURES.length} features` }
        );
    }

    private static ensurePresetPrompts(preset: Partial<AutomationDefinition>): Partial<AutomationDefinition> {
        if (!preset.stages) return preset;

        const stages = preset.stages.map((stage) => ({
            ...stage,
            prompt: stage.prompt ?? stage.name ?? "",
        }));

        return {
            ...preset,
            stages,
        };
    }

    /**
     * Validate stage configuration
     */
    static validateStageConfig(stage: AutomationStageConfig): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!stage.id || stage.id.trim() === "") {
            errors.push("Stage ID is required");
        }

        if (!stage.name || stage.name.trim() === "") {
            errors.push("Stage name is required");
        }

        if (!stage.prompt || stage.prompt.trim() === "") {
            errors.push("Stage prompt is required");
        }

        if (!stage.graphId || stage.graphId.trim() === "") {
            errors.push("Graph ID is required for each stage");
        }

        if (!(LLM_PROVIDERS as readonly string[]).includes(stage.llmProvider)) {
            errors.push(`Invalid LLM provider: ${stage.llmProvider}`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate full automation configuration
     */
    static validateAutomationConfig(automation: Partial<AutomationDefinition>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!automation.name || automation.name.trim() === "") {
            errors.push("Automation name is required");
        }

        if (!automation.stages || automation.stages.length === 0) {
            errors.push("Automation must have at least one stage");
        }

        if (automation.stages) {
            // Validate each stage
            automation.stages.forEach((stage, index) => {
                const stageValidation = this.validateStageConfig(stage);
                if (!stageValidation.valid) {
                    errors.push(`Stage ${index + 1} (${stage.id}): ${stageValidation.errors.join(", ")}`);
                }
            });

            // Check for duplicate stage IDs
            const stageIds = automation.stages.map((s) => s.id);
            const duplicates = stageIds.filter((id, index) => stageIds.indexOf(id) !== index);
            if (duplicates.length > 0) {
                errors.push(`Duplicate stage IDs: ${duplicates.join(", ")}`);
            }

            // Validate context references
            automation.stages.forEach((stage) => {
                if (stage.contextFromPreviousStages) {
                    stage.contextFromPreviousStages.forEach((ref) => {
                        const [stageId] = ref.split(".");
                        if (!stageIds.includes(stageId)) {
                            errors.push(
                                `Stage ${stage.id} references unknown stage: ${stageId}`
                            );
                        }
                    });
                }
            });
        }

        // Validate cron schedule if present
        if (automation.schedule?.enabled) {
            if (!automation.schedule.cron || automation.schedule.cron.trim() === "") {
                errors.push("Cron expression is required when scheduling is enabled");
            }

            if (!automation.schedule.timezone || automation.schedule.timezone.trim() === "") {
                errors.push("Timezone is required when scheduling is enabled");
            }

            // Basic cron validation (5 parts: minute hour day month weekday)
            if (automation.schedule.cron) {
                const cronParts = automation.schedule.cron.trim().split(/\s+/);
                if (cronParts.length !== 5) {
                    errors.push("Invalid cron expression format (expected 5 parts)");
                }
            }
        }

        // Validate trigger-specific configuration
        const triggerType: AutomationTriggerType = automation.triggerType || "manual";

        if (triggerType === "schedule") {
            if (!automation.schedule?.enabled) {
                errors.push("Schedule must be enabled when trigger type is 'schedule'");
            }
        }

        if (triggerType === "webhook") {
            // webhookConfig.secret can be auto-generated on creation, so we only warn if provided but empty
            if (automation.webhookConfig && (!automation.webhookConfig.secret || automation.webhookConfig.secret.trim() === "")) {
                errors.push("Webhook secret must not be empty when provided");
            }
        }

        if (triggerType === "git_event") {
            if (!automation.gitEventConfig) {
                errors.push("Git event configuration is required when trigger type is 'git_event'");
            } else {
                if (!automation.gitEventConfig.events || automation.gitEventConfig.events.length === 0) {
                    errors.push("At least one git event type is required (push, pull_request, or tag)");
                }
                const validEvents = ["push", "pull_request", "tag"];
                if (automation.gitEventConfig.events) {
                    for (const event of automation.gitEventConfig.events) {
                        if (!validEvents.includes(event)) {
                            errors.push(`Invalid git event type: ${event}`);
                        }
                    }
                }
                // gitEventConfig.secret can be auto-generated on creation, so we only warn if provided but empty
                if (automation.gitEventConfig.secret !== undefined && automation.gitEventConfig.secret.trim() === "") {
                    errors.push("Git event webhook secret must not be empty when provided");
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Get list of available presets
     */
    static getPresetNames(): string[] {
        return Object.keys(this.PRESETS);
    }

    /**
     * Get preset metadata
     */
    static getPresetMetadata(presetName: string): {
        name: string;
        description: string;
        stageCount: number;
        estimatedDuration: string;
    } | null {
        const key = this.LEGACY_PRESET_ALIASES[presetName] ?? presetName;
        const preset = this.PRESETS[key];
        if (!preset) return null;

        const durations: Record<string, string> = {
            CODE_FULL_REVIEW: "~2–4 hours",
            CODE_PR_GATE: "~20–40 mins",
            CODE_SECURITY_WEBHOOK: "~30–60 mins",
            CODE_WEEKLY_HEALTH: "~45–90 mins",
            PRODUCT_AREA_DEEP_DIVE: "~30–90 mins",
            BUSINESS_STRATEGY_PIPELINE: "~45–75 mins",
            BUSINESS_COMPETITIVE_SCAN: "~25–45 mins",
            BUSINESS_IDEATION: "~15–30 mins",
            BUSINESS_GTM_SALES: "~30–50 mins",
            BUSINESS_FUNDRAISING: "~35–55 mins",
            DAILY_FOCUS_PRIORITIES: "~20–40 mins",
        };

        return {
            name: preset.name || presetName,
            description: preset.description || "",
            stageCount: preset.stages?.length || 0,
            estimatedDuration: durations[key] || "Unknown",
        };
    }
}
