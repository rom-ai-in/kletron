import type { AutomationDefinition, AutomationStageConfig, AutomationTriggerType } from "./automationTypes";
import { LLM_PROVIDERS } from "./schemas/llmConfig.schema";

/**
 * AutomationConfigBuilder - Pre-configured automation templates and validation utilities
 */
export class AutomationConfigBuilder {
    /**
     * Pre-configured automation presets
     */
    static readonly PRESETS: Record<string, Partial<AutomationDefinition>> = {
        /**
         * Default full-stack logic audit
         * Duration: ~6 hours
         */
        FULL_STACK_LOGIC_AUDIT: {
            name: "Full Stack Logic Audit (Default)",
            description: "End-to-end audit of API, backend logic, frontend, design system, security, performance, and delivery pipelines.",
            stages: [
                {
                    id: "fs-api",
                    name: "API Contracts & Validation",
                    prompt:
                        "Audit the API layer for contract correctness. Check request/response validation, auth guards, error codes, pagination, idempotency, and versioning. Flag mismatches between handlers, schemas, and clients. Output findings with file paths/line numbers and severity (BLOQUANT/WARNING/INFO) plus fixes.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-backend-logic",
                    name: "Backend Domain Logic",
                    prompt:
                        "Audit core business/domain logic. Look for invalid state transitions, missing invariants, unsafe side effects, race conditions, and inconsistent workflows. Identify functions/services that violate domain rules. Provide concrete fixes with file/line references.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-data",
                    name: "Data Layer & Migrations",
                    prompt:
                        "Audit the data layer: schemas/models, migrations, queries, indexes, and transactions. Flag N+1 patterns, missing indexes, unsafe updates, migration risks, and data consistency gaps. Provide file/line evidence and remediation steps.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-security",
                    name: "Security & Access Control",
                    prompt:
                        "Audit authentication/authorization, secret handling, input sanitization, and common vulnerabilities (injection, SSRF, path traversal, deserialization). Verify least-privilege and data exposure. Provide high-confidence security findings with fixes.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-observability",
                    name: "Observability & Error Handling",
                    prompt:
                        "Audit logging, tracing, metrics, and error handling. Find swallowed errors, missing alerts, or low-signal logs. Ensure user-facing errors are actionable and internal errors are captured. Provide fixes with file/line references.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-performance",
                    name: "Performance & Scalability",
                    prompt:
                        "Audit performance hotspots: expensive loops, heavy queries, lack of caching, unbounded concurrency, and slow I/O. Identify bottlenecks and scalability risks with concrete fixes and configuration recommendations.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-frontend-arch",
                    name: "Frontend Architecture",
                    prompt:
                        "Audit frontend architecture: routing, component boundaries, SSR/CSR strategy, data loading, error boundaries, and code-splitting. Flag fragile patterns and opportunities to simplify or harden flows. Provide actionable fixes.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-ux",
                    name: "UX/UI & Accessibility",
                    prompt:
                        "Audit UI/UX and accessibility: focus management, keyboard navigation, ARIA roles, contrast, empty/loading/error states. Identify inconsistent UX flows and missing user feedback. Provide improvements with file references.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-design-system",
                    name: "Design System Consistency",
                    prompt:
                        "Audit design system usage across the app. Find duplicated styles, token misuse, inconsistent component variants, and missing design primitives. Recommend consolidations and fixes with file/line references.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-state",
                    name: "State Management & Data Fetching",
                    prompt:
                        "Audit state management and data fetching: cache invalidation, stale data, over-fetching, and inconsistent local state. Check for misuse of global state or effects. Provide precise fixes with file references.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-testing",
                    name: "Testing Strategy & Coverage",
                    prompt:
                        "Audit test coverage and quality: missing unit/integration/E2E tests, flaky tests, brittle mocks, and untested critical paths. Provide a prioritized list of test gaps with suggested test cases.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "fs-infra",
                    name: "Infrastructure & CI/CD",
                    prompt:
                        "Audit build, deployment, CI/CD, and runtime configuration. Look for unsafe defaults, missing environment validation, brittle pipelines, or drift between environments. Provide fixes and hardening recommendations.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
            ],
        },

        /**
         * Full monorepo audit - All 16 audit suites
         * Duration: ~8 hours
         */
        FULL_AUDIT: {
            name: "Complete Monorepo Audit",
            description: "Runs all 16 audit suites sequentially for comprehensive codebase analysis",
            stages: [
                { id: "a1-api", name: "API Audit", graphId: "audit", llmProvider: "azure" },
                { id: "a2-general", name: "General Code Quality", graphId: "audit", llmProvider: "azure" },
                { id: "a3-i18n", name: "I18n Compliance", graphId: "audit", llmProvider: "azure" },
                { id: "a4-portals", name: "Portal Architecture", graphId: "audit", llmProvider: "azure" },
                { id: "a5-tests", name: "Test Coverage", graphId: "audit", llmProvider: "azure" },
                { id: "a6-security", name: "Security Audit", graphId: "audit", llmProvider: "azure" },
                { id: "a7-ux", name: "UX/UI Audit", graphId: "audit", llmProvider: "azure" },
                { id: "a8-quality", name: "Scripts & Quality", graphId: "audit", llmProvider: "azure" },
                { id: "a9-infra", name: "Infrastructure", graphId: "audit", llmProvider: "azure" },
                { id: "a10-nav", name: "Navigation", graphId: "audit", llmProvider: "azure" },
                { id: "a11-modules", name: "Modules", graphId: "audit", llmProvider: "azure" },
                { id: "a12-errors", name: "Error Handling", graphId: "audit", llmProvider: "azure" },
                { id: "a13-alerts", name: "Alerts & Feedback", graphId: "audit", llmProvider: "azure" },
                { id: "a14-files", name: "File Organization", graphId: "audit", llmProvider: "azure" },
                { id: "a15-workers", name: "Workers", graphId: "audit", llmProvider: "azure" },
                { id: "a16-perf", name: "Performance", graphId: "audit", llmProvider: "azure" },
            ],
        },

        /**
         * Security deep dive - 3-pass security audit with different LLMs
         * Duration: ~3 hours
         */
        SECURITY_DEEP_DIVE: {
            name: "Security Deep Dive",
            description:
                "Multi-pass security audit with different LLMs for comprehensive vulnerability detection",
            stages: [
                { id: "security-azure", name: "Security Audit (Azure)", graphId: "audit", llmProvider: "azure" },
                {
                    id: "security-lmstudio",
                    name: "Security Audit (LM Studio)",
                    graphId: "audit",
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["security-azure.findings"],
                },
                {
                    id: "security-consolidation",
                    name: "Security Consolidation",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["security-azure.findings", "security-lmstudio.findings"],
                },
            ],
        },

        /**
         * I18n quality automation - Progressive validation
         * Duration: ~2 hours
         */
        I18N_QUALITY: {
            name: "I18n Quality Assurance",
            description: "Comprehensive i18n audit with progressive validation stages",
            stages: [
                { id: "i18n-structure", name: "I18n Structure Analysis", graphId: "audit", llmProvider: "azure" },
                {
                    id: "i18n-completeness",
                    name: "I18n Completeness Check",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["i18n-structure.findings"],
                },
                {
                    id: "i18n-usage",
                    name: "I18n Usage Verification",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["i18n-structure.findings"],
                    skipIf: "i18n-completeness.findings.filter(f => f.type === 'BLOQUANT').length > 10",
                },
            ],
        },

        /**
         * API quality gate - Pre-merge validation
         * Duration: ~1 hour
         */
        API_QUALITY_GATE: {
            name: "API Quality Gate",
            description: "Fast pre-merge validation for API changes",
            stages: [
                { id: "api-audit", name: "API Audit", graphId: "audit", llmProvider: "azure" },
                {
                    id: "security-check",
                    name: "Security Check",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["api-audit.findings"],
                },
                {
                    id: "test-verification",
                    name: "Test Verification",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["api-audit.findings", "security-check.findings"],
                    skipIf: "api-audit.findings.length === 0 && security-check.findings.length === 0",
                },
            ],
        },

        /**
         * Full Backend Audit
         * Duration: ~4 hours
         */
        FULL_BACKEND_AUDIT: {
            name: "Full Backend Audit",
            description: "Comprehensive analysis of API patterns, Workers, Infrastructure, and Error handling",
            stages: [
                { id: "be-api", name: "API Audit", graphId: "audit", llmProvider: "azure" },
                { id: "be-workers", name: "Worker Architecture", graphId: "audit", llmProvider: "azure" },
                { id: "be-modules", name: "Module Consistency", graphId: "audit", llmProvider: "azure" },
                { id: "be-infra", name: "Infrastructure Review", graphId: "audit", llmProvider: "azure" },
                { id: "be-errors", name: "Error Logic", graphId: "audit", llmProvider: "azure" },
                { id: "be-security", name: "Backend Security", graphId: "audit", llmProvider: "azure" },
                { id: "be-perf", name: "Performance & Scaling", graphId: "audit", llmProvider: "azure" },
            ],
        },

        /**
         * Full Frontend & UX Audit
         * Duration: ~4 hours
         */
        FULL_FRONTEND_AUDIT: {
            name: "Full UX/UI & Frontend Audit",
            description: "Deep dive into Portal Architecture, UX patterns, Navigation, and I18n compliance",
            stages: [
                { id: "fe-portals", name: "Portal Architecture", graphId: "audit", llmProvider: "azure" },
                { id: "fe-ux", name: "UX/UI Standards", graphId: "audit", llmProvider: "azure" },
                { id: "fe-nav", name: "Navigation Registry", graphId: "audit", llmProvider: "azure" },
                { id: "fe-alerts", name: "Alerts & Feedback", graphId: "audit", llmProvider: "azure" },
                { id: "fe-i18n", name: "I18n Compliance", graphId: "audit", llmProvider: "azure" },
                { id: "fe-perf", name: "Frontend Performance", graphId: "audit", llmProvider: "azure" },
            ],
        },

        /**
         * MongoDB Index & Performance Audit
         * Duration: ~1 hour
         */
        MONGO_INDEX_AUDIT: {
            name: "MongoDB Index & Performance",
            description: "Deep analysis of MongoDB indexes, text search limits, and query performance",
            stages: [
                { id: "mongo-index", name: "Index Strategy", graphId: "audit", llmProvider: "azure" },
                {
                    id: "mongo-patterns",
                    name: "Schema Patterns",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["mongo-index.findings"],
                },
                {
                    id: "mongo-perf",
                    name: "Performance Impact",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["mongo-index.findings"],
                },
            ],
        },

        /**
         * Documentation Quality Audit
         * Duration: ~30 mins
         */
        DOC_QUALITY_AUDIT: {
            name: "Documentation Quality Audit",
            description: "Verify documentation consistency, freshness, and completeness",
            stages: [
                { id: "doc-freshness", name: "Documentation Freshness", graphId: "audit", llmProvider: "azure" },
                {
                    id: "doc-consistency",
                    name: "Knowledge Consistency",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["doc-freshness.findings"],
                },
            ],
        },

        /**
         * Continuous Improvement - Daily automated scan
         * Duration: ~2 hours
         */
        CONTINUOUS_IMPROVEMENT: {
            name: "Continuous Improvement (Daily)",
            description:
                "Daily automated scan for bugs, features, UX/perf/security improvements with auto-fix and PR creation. Designed to run on a cron schedule.",
            triggerType: "schedule" as AutomationTriggerType,
            schedule: {
                enabled: true,
                cron: "0 2 * * 1-5",
                timezone: "Europe/Zurich",
            },
            stages: [
                {
                    id: "ci-discovery",
                    name: "Codebase Discovery & Health Scan",
                    prompt:
                        "Scan the entire repository for improvement opportunities across all dimensions: code health (TODOs, complexity, churn, duplication, dead code), security vulnerabilities (injection, auth, secrets, input validation), UX quality (missing states, accessibility, design system consistency), and dependency health (outdated packages, CVEs, deprecated APIs). Use repo_metrics, describe_structure, git_log, search_code, semantic_code_search, dependency_info extensively. Output structured findings with file paths, evidence, severity, and auto-fixability assessment. Focus on the 40 most impactful findings.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "ci-github",
                    name: "GitHub Issues & PR Sync",
                    prompt:
                        "Fetch open GitHub issues and recent pull requests using github_api. Correlate GitHub issues with the codebase findings from the previous stage. Identify issues that match or relate to discovered findings. Flag stale PRs (open > 14 days). Output a correlation map linking findings to issue numbers.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ci-discovery.findings"],
                },
                {
                    id: "ci-triage",
                    name: "Triage & Prioritize",
                    prompt:
                        "Categorize and prioritize all findings into structured improvement suggestions. For each finding, assign: category (feature/bug/ux/perf/security/refactor/deps/docs/testing), priority (CRITICAL/HIGH/MEDIUM/LOW) based on impact, effort estimate (XS/S/M/L/XL), confidence score (0-100, filter < 50), and auto-fixability. Deduplicate overlapping findings. Correlate with GitHub issues. Sort by priority then confidence. Maximum 50 suggestions.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ci-discovery.findings", "ci-github.findings"],
                },
                {
                    id: "ci-autofix",
                    name: "Auto-Implement Safe Fixes",
                    prompt:
                        "Implement the highest-priority auto-fixable improvements (max 5 per run). Only make clearly correct, low-risk changes. Never modify core business logic, database schemas, or reduce test coverage. For each fix: read the file, implement the change using write_file/str_replace_editor, then verify with lint/typecheck. Skip and mark as needs_human_review if unsure. Record all changes made.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ci-triage.tasks"],
                    skipIf: "ci-triage.findings.length === 0",
                },
                {
                    id: "ci-report",
                    name: "Generate Improvement Report",
                    prompt:
                        "Generate a comprehensive daily improvement report in markdown format. Include: Executive Summary, Auto-Fixed Items (if any), Suggestions Requiring Human Review (grouped by priority), and Statistics. Create a GitHub issue with the report using github_api (resource='create_issue', labels=['continuous-improvement', 'automated']). Send a notification using the notify tool.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: [
                        "ci-discovery.findings",
                        "ci-triage.findings",
                        "ci-autofix.findings",
                    ],
                },
            ],
        },

        /**
         * Business Analysis (Full) — Complete BA pipeline
         * Duration: ~1 hour
         */
        BUSINESS_ANALYSIS_FULL: {
            name: "Business Analysis (Full)",
            description:
                "Complete business analysis: context review, market scanning, competitive analysis, feature discovery, requirements drafting, prioritization, innovation scan, gap analysis, and final report.",
            stages: [
                {
                    id: "ba-context",
                    name: "Context & Strategy Review",
                    prompt:
                        "Load and analyze the product's business context and repository structure. Summarize the product vision, target personas, competitors, tech stack, existing features, and strategic positioning. Use describe_structure, list_files, read_file, and search_code to understand the codebase.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "ba-market",
                    name: "Market Scanning",
                    prompt:
                        "Analyze current market trends, emerging technologies, and industry movements relevant to this product's domain. Use web_search to research market size, growth trends, opportunities, and threats. Identify key trends that could impact the product.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-context.findings"],
                },
                {
                    id: "ba-competitive",
                    name: "Competitive Analysis",
                    prompt:
                        "Deep-dive into each competitor defined in the business context. Build a feature-by-feature competitive matrix scoring each area (absent/basic/good/excellent). Identify competitive gaps, advantages, and market gaps. Use web_search to research competitors and their features.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-context.findings", "ba-market.findings"],
                },
                {
                    id: "ba-features",
                    name: "Feature Discovery & Generation",
                    prompt:
                        "Generate 15-25 comprehensive feature proposals based on the context, market analysis, competitive gaps, and persona needs. Include new features, improvements, innovations, competitive catch-ups, and technical debt items. For each feature provide: title, type (new_feature/improvement/fix/optimization/innovation/competitive/technical_debt/compliance), summary, detailed description, user story, business value (CRITICAL/HIGH/MEDIUM/LOW), effort (XS/S/M/L/XL), priority (0-100), confidence score (0-100), innovation score (0-100), competitive context, impact areas, and risks.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-context.findings", "ba-market.findings", "ba-competitive.findings"],
                },
                {
                    id: "ba-requirements",
                    name: "Requirements Drafting",
                    prompt:
                        "For each feature proposal, draft detailed requirements: refine user stories, write 3-5 acceptance criteria, identify dependencies, explore the codebase to find affected files, and suggest implementation approaches. Focus on making requirements specific and testable.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-features.findings"],
                },
                {
                    id: "ba-scoring",
                    name: "Prioritization & Scoring",
                    prompt:
                        "Final scoring pass. Re-score each feature on business value (40%), effort efficiency (20%), innovation (20%), and competitive advantage (20%). Deduplicate overlapping features. Sort by final priority score descending. Identify quick wins (high value, low effort).",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-features.findings", "ba-requirements.findings"],
                },
                {
                    id: "ba-innovation",
                    name: "Innovation Opportunities",
                    prompt:
                        "Identify innovative, differentiating features that could set this product apart from competitors. Consider emerging technologies, novel user experiences, and unique value propositions. Focus on features that are hard for competitors to replicate.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-competitive.findings", "ba-features.findings"],
                },
                {
                    id: "ba-gaps",
                    name: "Gap Analysis",
                    prompt:
                        "Perform a comprehensive gap analysis: identify what's missing from the product vs. market expectations, competitor offerings, and user needs. Prioritize gaps by business impact and feasibility.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["ba-competitive.findings", "ba-features.findings"],
                },
                {
                    id: "ba-report",
                    name: "Final BA Report",
                    prompt:
                        "Generate a comprehensive Business Analysis report in markdown format. Include: Executive Summary, Market Overview, Competitive Landscape (with matrix), Feature Proposals (grouped by type and sorted by priority), Quick Wins, Strategic Recommendations, Innovation Opportunities, and Statistics.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: [
                        "ba-features.findings",
                        "ba-scoring.findings",
                        "ba-innovation.findings",
                        "ba-gaps.findings",
                    ],
                },
            ],
        },

        /**
         * Quick Feature Brainstorm — Fast ideation
         * Duration: ~15 minutes
         */
        QUICK_FEATURE_BRAINSTORM: {
            name: "Quick Feature Brainstorm",
            description:
                "Fast feature ideation pipeline: context review, feature generation, and quick scoring.",
            stages: [
                {
                    id: "qb-context",
                    name: "Context Review",
                    prompt:
                        "Quickly analyze the repository structure, tech stack, and existing features. Summarize the product's current state, strengths, and areas for improvement.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "qb-features",
                    name: "Feature Generation",
                    prompt:
                        "Generate 10-15 feature proposals based on the product context. Mix of new features, improvements, and innovations. For each: title, type, summary, description, business value, effort, priority (0-100), and innovation score (0-100).",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["qb-context.findings"],
                },
                {
                    id: "qb-scoring",
                    name: "Quick Scoring",
                    prompt:
                        "Score and prioritize all feature proposals. Sort by priority. Identify top 3 quick wins and top 3 strategic features. Generate a brief summary report.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["qb-features.findings"],
                },
            ],
        },

        /**
         * Competitive Deep Dive — In-depth competitive analysis
         * Duration: ~30 minutes
         */
        COMPETITIVE_DEEP_DIVE: {
            name: "Competitive Deep Dive",
            description:
                "In-depth competitive analysis with feature matrix, gap analysis, and strategic recommendations.",
            stages: [
                {
                    id: "cd-context",
                    name: "Context & Competitors",
                    prompt:
                        "Analyze the product's current features and defined competitors. Summarize our strengths and each competitor's positioning.",
                    graphId: "audit",
                    llmProvider: "azure",
                },
                {
                    id: "cd-research",
                    name: "Competitor Research",
                    prompt:
                        "Research each competitor in depth using web_search. Analyze their product features, pricing, user reviews, recent updates, and market positioning. Identify their innovations and strategies.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["cd-context.findings"],
                },
                {
                    id: "cd-matrix",
                    name: "Feature Matrix Builder",
                    prompt:
                        "Build a comprehensive feature-by-feature competitive matrix. For each feature area, score all players (us and each competitor) as: absent, basic, good, or excellent. Identify at least 15-20 feature areas for comparison.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["cd-context.findings", "cd-research.findings"],
                },
                {
                    id: "cd-gaps",
                    name: "Gap & Opportunity Analysis",
                    prompt:
                        "Based on the competitive matrix, identify all gaps (features competitors have that we lack), all advantages (features we excel at), and market opportunities (features no one does well). Prioritize by business impact.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["cd-matrix.findings"],
                },
                {
                    id: "cd-strategy",
                    name: "Strategic Recommendations",
                    prompt:
                        "Generate strategic recommendations: which competitive gaps to close first, which advantages to double down on, which market opportunities to pursue. Include quick wins (< 1 sprint) and long-term plays (multi-quarter). Produce a comprehensive competitive intelligence report.",
                    graphId: "audit",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["cd-matrix.findings", "cd-gaps.findings"],
                },
            ],
        },
    };

    /**
     * Build an automation from a preset or custom configuration
     */
    static buildAutomation(preset: string): Partial<AutomationDefinition>;
    static buildAutomation(config: Partial<AutomationDefinition>): Partial<AutomationDefinition>;
    static buildAutomation(input: string | Partial<AutomationDefinition>): Partial<AutomationDefinition> {
        if (typeof input === "string") {
            const preset = this.PRESETS[input];
            if (!preset) {
                throw new Error(`Unknown preset: ${input}`);
            }
            return this.ensurePresetPrompts(preset);
        }
        return input;
    }

    /** @deprecated Use buildAutomation instead */
    static buildChain(input: string | Partial<AutomationDefinition>): Partial<AutomationDefinition> {
        return this.buildAutomation(input as any);
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

    /** @deprecated Use validateAutomationConfig instead */
    static validateChainConfig(chain: Partial<AutomationDefinition>): { valid: boolean; errors: string[] } {
        return this.validateAutomationConfig(chain);
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
        const preset = this.PRESETS[presetName];
        if (!preset) return null;

        const durations: Record<string, string> = {
            FULL_STACK_LOGIC_AUDIT: "~6 hours",
            FULL_AUDIT: "~8 hours",
            SECURITY_DEEP_DIVE: "~3 hours",
            I18N_QUALITY: "~2 hours",
            API_QUALITY_GATE: "~1 hour",
            FULL_BACKEND_AUDIT: "~4 hours",
            FULL_FRONTEND_AUDIT: "~4 hours",
            MONGO_INDEX_AUDIT: "~1 hour",
            DOC_QUALITY_AUDIT: "~30 mins",
            CONTINUOUS_IMPROVEMENT: "~2 hours",
        };

        return {
            name: preset.name || presetName,
            description: preset.description || "",
            stageCount: preset.stages?.length || 0,
            estimatedDuration: durations[presetName] || "Unknown",
        };
    }
}

/** @deprecated Use AutomationConfigBuilder instead */
export const ChainConfigBuilder = AutomationConfigBuilder;
