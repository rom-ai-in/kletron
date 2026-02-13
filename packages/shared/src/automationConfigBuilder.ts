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
