import type { AuditChain, AuditStageConfig, GraphId } from "./chainTypes";

/**
 * ChainConfigBuilder - Pre-configured campaign templates and validation utilities
 */
export class ChainConfigBuilder {
    /**
     * Pre-configured campaign presets
     */
    static readonly PRESETS: Record<string, Partial<AuditChain>> = {
        /**
         * Full monorepo audit - All 16 audit suites
         * Duration: ~8 hours
         */
        FULL_AUDIT: {
            name: "Complete Monorepo Audit",
            description: "Runs all 16 audit suites sequentially for comprehensive codebase analysis",
            stages: [
                {
                    id: "a1-api",
                    name: "API Audit",
                    graphId: "audit",
                    promptPath: "A-audit/A1-api/general-api-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a2-general",
                    name: "General Code Quality",
                    graphId: "audit",
                    promptPath: "A-audit/A2-general/daily-repository-check.md",
                    llmProvider: "azure",
                },
                {
                    id: "a3-i18n",
                    name: "I18n Compliance",
                    graphId: "audit",
                    promptPath: "A-audit/A3-i18n/i18n-master-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a4-portals",
                    name: "Portal Architecture",
                    graphId: "audit",
                    promptPath: "A-audit/A4-portals/portal-architecture-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a5-tests",
                    name: "Test Coverage",
                    graphId: "audit",
                    promptPath: "A-audit/A5-tests/tests-completeness.md",
                    llmProvider: "azure",
                },
                {
                    id: "a6-security",
                    name: "Security Audit",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "azure",
                },
                {
                    id: "a7-ux",
                    name: "UX/UI Audit",
                    graphId: "audit",
                    promptPath: "A-audit/A7-ux-ui/portal-ux.md",
                    llmProvider: "azure",
                },
                {
                    id: "a8-quality",
                    name: "Scripts & Quality",
                    graphId: "audit",
                    promptPath: "A-audit/A8-scripts-quality/quality-scripts-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a9-infra",
                    name: "Infrastructure",
                    graphId: "audit",
                    promptPath: "A-audit/A9-infrastructure/infrastructure-production-readiness.md",
                    llmProvider: "azure",
                },
                {
                    id: "a10-nav",
                    name: "Navigation",
                    graphId: "audit",
                    promptPath: "A-audit/A10-navigation/navigation-permissions-registry-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a11-modules",
                    name: "Modules",
                    graphId: "audit",
                    promptPath: "A-audit/A11-modules/inter-module-consistency.md",
                    llmProvider: "azure",
                },
                {
                    id: "a12-errors",
                    name: "Error Handling",
                    graphId: "audit",
                    promptPath: "A-audit/A12-error-logic/error-logic-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a13-alerts",
                    name: "Alerts & Feedback",
                    graphId: "audit",
                    promptPath: "A-audit/A13-alert-snackbar-feedback-audit/alert-snackbar-feedback-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a14-files",
                    name: "File Organization",
                    graphId: "audit",
                    promptPath: "A-audit/A14-file-organization/file-hygiene-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a15-workers",
                    name: "Workers",
                    graphId: "audit",
                    promptPath: "A-audit/A15-workers/worker-architecture-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "a16-perf",
                    name: "Performance",
                    graphId: "audit",
                    promptPath: "A-audit/A16-performance/full-stack-performance-audit.md",
                    llmProvider: "azure",
                },
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
                {
                    id: "security-azure",
                    name: "Security Audit (Azure)",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "azure",
                },
                {
                    id: "security-lmstudio",
                    name: "Security Audit (LM Studio)",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "lmstudio",
                    contextFromPreviousStages: ["security-azure.findings"],
                },
                {
                    id: "security-consolidation",
                    name: "Security Consolidation",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: [
                        "security-azure.findings",
                        "security-lmstudio.findings",
                    ],
                },
            ],
        },

        /**
         * I18n quality campaign - Progressive validation
         * Duration: ~2 hours
         */
        I18N_QUALITY_CAMPAIGN: {
            name: "I18n Quality Assurance",
            description: "Comprehensive i18n audit with progressive validation stages",
            stages: [
                {
                    id: "i18n-structure",
                    name: "I18n Structure Analysis",
                    graphId: "audit",
                    promptPath: "A-audit/A3-i18n/i18n-master-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "i18n-completeness",
                    name: "I18n Completeness Check",
                    graphId: "audit",
                    promptPath: "A-audit/A3-i18n/i18n-master-audit.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["i18n-structure.findings"],
                },
                {
                    id: "i18n-usage",
                    name: "I18n Usage Verification",
                    graphId: "audit",
                    promptPath: "A-audit/A3-i18n/i18n-master-audit.md",
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
                {
                    id: "api-audit",
                    name: "API Audit",
                    graphId: "audit",
                    promptPath: "A-audit/A1-api/general-api-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "security-check",
                    name: "Security Check",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["api-audit.findings"],
                },
                {
                    id: "test-verification",
                    name: "Test Verification",
                    graphId: "audit",
                    promptPath: "A-audit/A5-tests/tests-completeness.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["api-audit.findings", "security-check.findings"],
                    skipIf: "api-audit.findings.length === 0 && security-check.findings.length === 0",
                },
            ],
        },

        /**
         * Full Backend Audit - Focus on API, Workers, Infra, and Modules
         * Duration: ~4 hours
         */
        FULL_BACKEND_AUDIT: {
            name: "Full Backend Audit",
            description: "Comprehensive analysis of API patterns, Workers, Infrastructure, and Error handling",
            stages: [
                {
                    id: "be-api",
                    name: "API Audit",
                    graphId: "audit",
                    promptPath: "A-audit/A1-api/general-api-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-workers",
                    name: "Worker Architecture",
                    graphId: "audit",
                    promptPath: "A-audit/A15-workers/worker-architecture-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-modules",
                    name: "Module Consistency",
                    graphId: "audit",
                    promptPath: "A-audit/A11-modules/inter-module-consistency.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-infra",
                    name: "Infrastructure Review",
                    graphId: "audit",
                    promptPath: "A-audit/A9-infrastructure/infrastructure-production-readiness.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-errors",
                    name: "Error Logic",
                    graphId: "audit",
                    promptPath: "A-audit/A12-error-logic/error-logic-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-security",
                    name: "Backend Security",
                    graphId: "audit",
                    promptPath: "A-audit/A6-security/permission-access-control.md",
                    llmProvider: "azure",
                },
                {
                    id: "be-perf",
                    name: "Performance & Scaling",
                    graphId: "audit",
                    promptPath: "A-audit/A16-performance/full-stack-performance-audit.md",
                    llmProvider: "azure",
                },
            ],
        },

        /**
         * Full Frontend & UX Audit - Focus on Portals, Navigation, I18n, and UI
         * Duration: ~4 hours
         */
        FULL_FRONTEND_AUDIT: {
            name: "Full UX/UI & Frontend Audit",
            description: "Deep dive into Portal Architecture, UX patterns, Navigation, and I18n compliance",
            stages: [
                {
                    id: "fe-portals",
                    name: "Portal Architecture",
                    graphId: "audit",
                    promptPath: "A-audit/A4-portals/portal-architecture-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "fe-ux",
                    name: "UX/UI Standards",
                    graphId: "audit",
                    promptPath: "A-audit/A7-ux-ui/portal-ux.md",
                    llmProvider: "azure",
                },
                {
                    id: "fe-nav",
                    name: "Navigation Registry",
                    graphId: "audit",
                    promptPath: "A-audit/A10-navigation/navigation-permissions-registry-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "fe-alerts",
                    name: "Alerts & Feedback",
                    graphId: "audit",
                    promptPath: "A-audit/A13-alert-snackbar-feedback-audit/alert-snackbar-feedback-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "fe-i18n",
                    name: "I18n Compliance",
                    graphId: "audit",
                    promptPath: "A-audit/A3-i18n/i18n-master-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "fe-perf",
                    name: "Frontend Performance",
                    graphId: "audit",
                    promptPath: "A-audit/A16-performance/full-stack-performance-audit.md",
                    llmProvider: "azure",
                },
            ],
        },

        /**
         * MongoDB Index & Performance Audit - Critical Infra Check
         * Duration: ~1 hour
         */
        MONGO_INDEX_AUDIT: {
            name: "MongoDB Index & Performance",
            description: "Deep analysis of MongoDB indexes, text search limits, and query performance",
            stages: [
                {
                    id: "mongo-index",
                    name: "Index Strategy",
                    graphId: "audit",
                    promptPath: "A-audit/A22-Mongo/mongodb-index-audit.md",
                    llmProvider: "azure",
                },
                {
                    id: "mongo-patterns",
                    name: "Schema Patterns",
                    graphId: "audit",
                    promptPath: "A-audit/A22-Mongo/mongodb-pattern.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["mongo-index.findings"],
                },
                {
                    id: "mongo-perf",
                    name: "Performance Impact",
                    graphId: "audit",
                    promptPath: "A-audit/A16-performance/full-stack-performance-audit.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["mongo-index.findings"],
                },
            ],
        },

        /**
         * Documentation Quality Audit - Knowledge Base Health
         * Duration: ~30 mins
         */
        DOC_QUALITY_AUDIT: {
            name: "Documentation Quality Audit",
            description: "Verify documentation consistency, freshness, and completeness",
            stages: [
                {
                    id: "doc-freshness",
                    name: "Documentation Freshness",
                    graphId: "audit",
                    promptPath: "A-audit/A17-documentation/documentation-freshness.md",
                    llmProvider: "azure",
                },
                {
                    id: "doc-consistency",
                    name: "Knowledge Consistency",
                    graphId: "audit",
                    promptPath: "A-audit/A17-documentation/knowledge-consistency.md",
                    llmProvider: "azure",
                    contextFromPreviousStages: ["doc-freshness.findings"],
                },
            ],
        },
    };

    /**
     * Build a chain from a preset or custom configuration
     */
    static buildChain(preset: string): Partial<AuditChain>;
    static buildChain(config: Partial<AuditChain>): Partial<AuditChain>;
    static buildChain(input: string | Partial<AuditChain>): Partial<AuditChain> {
        if (typeof input === "string") {
            const preset = this.PRESETS[input];
            if (!preset) {
                throw new Error(`Unknown preset: ${input}`);
            }
            return preset;
        }
        return input;
    }

    /**
     * Validate stage configuration
     */
    static validateStageConfig(stage: AuditStageConfig): {
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

        const validGraphIds: GraphId[] = ["audit", "simple_react"];

        if (!validGraphIds.includes(stage.graphId)) {
            errors.push(`Invalid graph ID: ${stage.graphId}`);
        }

        if (!stage.promptPath || stage.promptPath.trim() === "") {
            errors.push("Prompt path is required");
        }

        if (!["azure", "lmstudio"].includes(stage.llmProvider)) {
            errors.push(`Invalid LLM provider: ${stage.llmProvider}`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate full chain configuration
     */
    static validateChainConfig(chain: Partial<AuditChain>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!chain.name || chain.name.trim() === "") {
            errors.push("Chain name is required");
        }

        if (!chain.stages || chain.stages.length === 0) {
            errors.push("Chain must have at least one stage");
        }

        if (chain.stages) {
            // Validate each stage
            chain.stages.forEach((stage, index) => {
                const stageValidation = this.validateStageConfig(stage);
                if (!stageValidation.valid) {
                    errors.push(`Stage ${index + 1} (${stage.id}): ${stageValidation.errors.join(", ")}`);
                }
            });

            // Check for duplicate stage IDs
            const stageIds = chain.stages.map((s) => s.id);
            const duplicates = stageIds.filter((id, index) => stageIds.indexOf(id) !== index);
            if (duplicates.length > 0) {
                errors.push(`Duplicate stage IDs: ${duplicates.join(", ")}`);
            }

            // Validate context references
            chain.stages.forEach((stage) => {
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
        if (chain.schedule?.enabled) {
            if (!chain.schedule.cron || chain.schedule.cron.trim() === "") {
                errors.push("Cron expression is required when scheduling is enabled");
            }

            if (!chain.schedule.timezone || chain.schedule.timezone.trim() === "") {
                errors.push("Timezone is required when scheduling is enabled");
            }

            // Basic cron validation (5 parts: minute hour day month weekday)
            const cronParts = chain.schedule.cron.trim().split(/\s+/);
            if (cronParts.length !== 5) {
                errors.push("Invalid cron expression format (expected 5 parts)");
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
        const preset = this.PRESETS[presetName];
        if (!preset) return null;

        const durations: Record<string, string> = {
            FULL_AUDIT: "~8 hours",
            SECURITY_DEEP_DIVE: "~3 hours",
            I18N_QUALITY_CAMPAIGN: "~2 hours",
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
