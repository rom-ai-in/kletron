import type { AuditChain, AuditStageConfig, AuditMode } from "./chainTypes.js";

/**
 * ChainConfigBuilder - Pre-configured chain templates and validation utilities
 */
export class ChainConfigBuilder {
    /**
     * Pre-configured chain presets
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
                    auditMode: "A1",
                    llmProvider: "azure",
                    userPromptTemplate: "Audit API routes, endpoints, and request handling logic",
                },
                {
                    id: "a2-general",
                    name: "General Code Quality",
                    auditMode: "A2",
                    llmProvider: "azure",
                    userPromptTemplate: "General code quality, patterns, and best practices audit",
                },
                {
                    id: "a3-i18n",
                    name: "I18n Compliance",
                    auditMode: "A3",
                    llmProvider: "azure",
                    userPromptTemplate: "Check i18n structure, completeness, and usage patterns",
                },
                {
                    id: "a4-portals",
                    name: "Portal Architecture",
                    auditMode: "A4",
                    llmProvider: "azure",
                    userPromptTemplate: "Audit portal isolation, routing, and access control",
                },
                {
                    id: "a5-tests",
                    name: "Test Coverage",
                    auditMode: "A5",
                    llmProvider: "azure",
                    userPromptTemplate: "Audit test coverage, quality, and patterns",
                },
                {
                    id: "a6-security",
                    name: "Security Audit",
                    auditMode: "A6",
                    llmProvider: "azure",
                    userPromptTemplate: "Security vulnerabilities, authentication, and authorization audit",
                },
                {
                    id: "a7-ux",
                    name: "UX/UI Audit",
                    auditMode: "A7",
                    llmProvider: "azure",
                    userPromptTemplate: "UI/UX consistency, accessibility, and user experience audit",
                },
                {
                    id: "a8-quality",
                    name: "Scripts & Quality",
                    auditMode: "A8",
                    llmProvider: "azure",
                    userPromptTemplate: "Quality scripts, linting, and automation audit",
                },
                {
                    id: "a9-infra",
                    name: "Infrastructure",
                    auditMode: "A9",
                    llmProvider: "azure",
                    userPromptTemplate: "Infrastructure, deployment, and DevOps audit",
                },
                {
                    id: "a10-nav",
                    name: "Navigation",
                    auditMode: "A10",
                    llmProvider: "azure",
                    userPromptTemplate: "Navigation structure and routing audit",
                },
                {
                    id: "a11-modules",
                    name: "Modules",
                    auditMode: "A11",
                    llmProvider: "azure",
                    userPromptTemplate: "Module organization and dependencies audit",
                },
                {
                    id: "a12-errors",
                    name: "Error Handling",
                    auditMode: "A12",
                    llmProvider: "azure",
                    userPromptTemplate: "Error handling and logging patterns audit",
                },
                {
                    id: "a13-alerts",
                    name: "Alerts & Feedback",
                    auditMode: "A13",
                    llmProvider: "azure",
                    userPromptTemplate: "User feedback, alerts, and notification audit",
                },
                {
                    id: "a14-files",
                    name: "File Organization",
                    auditMode: "A14",
                    llmProvider: "azure",
                    userPromptTemplate: "File structure and organization audit",
                },
                {
                    id: "a15-workers",
                    name: "Workers",
                    auditMode: "A15",
                    llmProvider: "azure",
                    userPromptTemplate: "Background workers and job processing audit",
                },
                {
                    id: "a16-perf",
                    name: "Performance",
                    auditMode: "A16",
                    llmProvider: "azure",
                    userPromptTemplate: "Performance optimization opportunities audit",
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
                    auditMode: "A6",
                    llmProvider: "azure",
                    userPromptTemplate:
                        "Focus on authentication, authorization, and input validation vulnerabilities",
                },
                {
                    id: "security-lmstudio",
                    name: "Security Audit (LM Studio)",
                    auditMode: "A6",
                    llmProvider: "lmstudio",
                    userPromptTemplate:
                        "Cross-check with different LLM: focus on injection attacks, CSRF, XSS, and data exposure",
                    contextFromPreviousStages: ["security-azure.findings"],
                },
                {
                    id: "security-consolidation",
                    name: "Security Consolidation",
                    auditMode: "A6",
                    llmProvider: "azure",
                    userPromptTemplate:
                        "Consolidate findings from both passes, identify consensus, and prioritize remediation",
                    contextFromPreviousStages: [
                        "security-azure.findings",
                        "security-lmstudio.findings",
                    ],
                },
            ],
        },

        /**
         * I18n quality chain - Progressive validation
         * Duration: ~2 hours
         */
        I18N_QUALITY_CHAIN: {
            name: "I18n Quality Assurance",
            description: "Comprehensive i18n audit with progressive validation stages",
            stages: [
                {
                    id: "i18n-structure",
                    name: "I18n Structure Analysis",
                    auditMode: "A3",
                    llmProvider: "azure",
                    userPromptTemplate:
                        "Analyze i18n file structure, naming conventions, and organization",
                },
                {
                    id: "i18n-completeness",
                    name: "I18n Completeness Check",
                    auditMode: "A3",
                    llmProvider: "azure",
                    userPromptTemplate:
                        "Check for missing keys, locale parity, and translation completeness",
                    contextFromPreviousStages: ["i18n-structure.findings"],
                },
                {
                    id: "i18n-usage",
                    name: "I18n Usage Verification",
                    auditMode: "A3",
                    llmProvider: "azure",
                    userPromptTemplate:
                        "Verify proper usage in components, routes, and ensure no hardcoded strings",
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
                    auditMode: "A1",
                    llmProvider: "azure",
                    userPromptTemplate: "Quick API audit focusing on recent changes",
                },
                {
                    id: "security-check",
                    name: "Security Check",
                    auditMode: "A6",
                    llmProvider: "azure",
                    userPromptTemplate: "Security audit for API endpoints",
                    contextFromPreviousStages: ["api-audit.findings"],
                },
                {
                    id: "test-verification",
                    name: "Test Verification",
                    auditMode: "A5",
                    llmProvider: "azure",
                    userPromptTemplate: "Verify tests exist for flagged files",
                    contextFromPreviousStages: ["api-audit.findings", "security-check.findings"],
                    skipIf: "api-audit.findings.length === 0 && security-check.findings.length === 0",
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

        const validAuditModes: AuditMode[] = [
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6",
            "A7",
            "A8",
            "A9",
            "A10",
            "A11",
            "A12",
            "A13",
            "A14",
            "A15",
            "A16",
        ];

        if (!validAuditModes.includes(stage.auditMode)) {
            errors.push(`Invalid audit mode: ${stage.auditMode}`);
        }

        if (!["azure", "lmstudio"].includes(stage.llmProvider)) {
            errors.push(`Invalid LLM provider: ${stage.llmProvider}`);
        }

        if (!stage.userPromptTemplate || stage.userPromptTemplate.trim() === "") {
            errors.push("User prompt template is required");
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
            I18N_QUALITY_CHAIN: "~2 hours",
            API_QUALITY_GATE: "~1 hour",
        };

        return {
            name: preset.name || presetName,
            description: preset.description || "",
            stageCount: preset.stages?.length || 0,
            estimatedDuration: durations[presetName] || "Unknown",
        };
    }
}
