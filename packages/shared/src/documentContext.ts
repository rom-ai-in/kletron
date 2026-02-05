export type DocumentContext = {
    documentType?: string;
    mission?: string;
    primaryGoal?: string;
    keyObjectives?: string[];
    nonGoals?: string[];
    timeHorizon?: string;
    targetAudience?: string;
    qualityLevel?: "draft" | "standard" | "polished";
    constraints?: string[];
    languages?: string[];
    frameworks?: string[];
    hotspots?: string[];
    // Legacy fields for backwards compatibility
    startupPhase?: string;
    targetUsers?: string;
    riskTolerance?: "low" | "medium" | "high";
};

// Legacy alias for backwards compatibility during transition
export type AuditContext = DocumentContext;


const cleanText = (value?: string) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

const cleanList = (values?: string[]) => {
    if (!values) return undefined;
    const cleaned = values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
};

export const normalizeDocumentContext = (
    context?: DocumentContext | null
): DocumentContext | null => {
    if (!context || typeof context !== "object") return null;
    const normalized: DocumentContext = {
        documentType: cleanText(context.documentType),
        mission: cleanText(context.mission),
        primaryGoal: cleanText(context.primaryGoal),
        keyObjectives: cleanList(context.keyObjectives),
        nonGoals: cleanList(context.nonGoals),
        timeHorizon: cleanText(context.timeHorizon),
        targetAudience: cleanText(context.targetAudience),
        qualityLevel: cleanText(context.qualityLevel) as DocumentContext["qualityLevel"],
        constraints: cleanList(context.constraints),
    };

    const hasAny = Object.values(normalized).some((value) => {
        if (Array.isArray(value)) return value.length > 0;
        return Boolean(value);
    });

    return hasAny ? normalized : null;
};

// Legacy alias
export const normalizeAuditContext = normalizeDocumentContext;


const limitList = (values: string[], limit = 3) => {
    if (values.length <= limit) return values;
    return [...values.slice(0, limit), "…"];
};

export const formatDocumentContextSummary = (
    context?: DocumentContext | null
): string | null => {
    const normalized = normalizeDocumentContext(context);
    if (!normalized) return null;

    const parts: string[] = [];
    if (normalized.documentType) {
        parts.push(`Type: ${normalized.documentType}`);
    }
    const goal = normalized.primaryGoal || normalized.mission;
    if (goal) {
        parts.push(`Goal: ${goal}`);
    }
    if (normalized.timeHorizon) {
        parts.push(`Horizon: ${normalized.timeHorizon}`);
    }
    if (normalized.keyObjectives?.length) {
        parts.push(`Objectives: ${limitList(normalized.keyObjectives).join("; ")}`);
    }
    if (normalized.nonGoals?.length) {
        parts.push(`De-prioritize: ${limitList(normalized.nonGoals).join("; ")}`);
    }
    return parts.join(" · ");
};

// Legacy alias
export const formatAuditContextSummary = formatDocumentContextSummary;


export const formatDocumentContextPrompt = (
    context?: DocumentContext | null
): string | null => {
    const normalized = normalizeDocumentContext(context);
    if (!normalized) return null;

    const lines: string[] = [
        "DOCUMENT CONTEXT (must guide content & style):",
    ];
    if (normalized.documentType) {
        lines.push(`- Document type: ${normalized.documentType}`);
    }
    if (normalized.mission) {
        lines.push(`- Mission: ${normalized.mission}`);
    }
    if (normalized.primaryGoal) {
        lines.push(`- Primary goal: ${normalized.primaryGoal}`);
    }
    if (normalized.timeHorizon) {
        lines.push(`- Time horizon: ${normalized.timeHorizon}`);
    }
    if (normalized.targetAudience) {
        lines.push(`- Target audience: ${normalized.targetAudience}`);
    }
    if (normalized.qualityLevel) {
        lines.push(`- Quality level: ${normalized.qualityLevel}`);
    }
    if (normalized.keyObjectives?.length) {
        lines.push("- Key objectives:");
        for (const item of normalized.keyObjectives) {
            lines.push(`  - ${item}`);
        }
    }
    if (normalized.nonGoals?.length) {
        lines.push("- De-prioritize:");
        for (const item of normalized.nonGoals) {
            lines.push(`  - ${item}`);
        }
    }
    if (normalized.constraints?.length) {
        lines.push("- Constraints:");
        for (const item of normalized.constraints) {
            lines.push(`  - ${item}`);
        }
    }

    lines.push("Instructions:");
    lines.push("- Prioritize content that achieves the primary goal.");
    lines.push(
        "- Match the quality level and target audience expectations."
    );
    lines.push("- Align scope with the time horizon and constraints.");

    return lines.join("\n");
};

// Legacy alias
export const formatAuditContextPrompt = formatDocumentContextPrompt;
