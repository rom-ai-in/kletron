import { z } from "zod";

// ---------------------------------------------------------------------------
// User Personas
// ---------------------------------------------------------------------------

export interface UserPersona {
    /** Unique identifier */
    id: string;
    /** Display name (e.g. "Marie, Senior PM") */
    name: string;
    /** Role or job title */
    role: string;
    /** What this persona wants to accomplish */
    goals: string[];
    /** Current frustrations / pain points */
    painPoints: string[];
    /** Technical proficiency */
    techSavviness: "low" | "medium" | "high";
    /** How often the persona uses the product */
    frequency: "daily" | "weekly" | "monthly" | "occasional";
    /** Optional demographics description */
    demographics?: string;
    /** A representative quote */
    quote?: string;
}

export const UserPersonaSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    goals: z.array(z.string().min(1)).min(1),
    painPoints: z.array(z.string().min(1)).default([]),
    techSavviness: z.enum(["low", "medium", "high"]),
    frequency: z.enum(["daily", "weekly", "monthly", "occasional"]),
    demographics: z.string().max(500).optional(),
    quote: z.string().max(500).optional(),
});

export const UserPersonaCreateSchema = UserPersonaSchema.omit({ id: true });

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export interface Competitor {
    /** Unique identifier */
    id: string;
    /** Company / product name */
    name: string;
    /** Website URL */
    url?: string;
    /** Short description */
    description: string;
    /** Known strengths */
    strengths: string[];
    /** Known weaknesses */
    weaknesses: string[];
    /** Pricing info */
    pricing?: string;
    /** Target market description */
    targetMarket?: string;
    /** Key differentiators */
    differentiators?: string[];
}

export const CompetitorSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(200),
    url: z.string().url().optional(),
    description: z.string().min(1).max(2000),
    strengths: z.array(z.string().min(1)).default([]),
    weaknesses: z.array(z.string().min(1)).default([]),
    pricing: z.string().max(500).optional(),
    targetMarket: z.string().max(500).optional(),
    differentiators: z.array(z.string().min(1)).optional(),
});

export const CompetitorCreateSchema = CompetitorSchema.omit({ id: true });

// ---------------------------------------------------------------------------
// Business Context (one per workspace)
// ---------------------------------------------------------------------------

export interface BusinessContext {
    /** Workspace this context belongs to */
    workspaceId?: string;
    /** Long-term product vision */
    productVision?: string;
    /** Unique value proposition */
    valueProposition?: string;
    /** Market positioning statement */
    marketPositioning?: string;
    /** Target market segments */
    targetMarketSegments?: string[];
    /** User personas */
    personas: UserPersona[];
    /** Competitors */
    competitors: Competitor[];
    /** Revenue model (SaaS, freemium, etc.) */
    revenueModel?: string;
    /** Pricing strategy */
    pricingStrategy?: string;
    /** Priority innovation axes */
    innovationAxes?: string[];
    /** Technical differentiators */
    techDifferentiators?: string[];
    /** Last update timestamp */
    lastUpdatedAt?: Date;
    /** Last AI analysis timestamp */
    lastAnalysisAt?: Date;
}

export const BusinessContextUpdateSchema = z.object({
    productVision: z.string().max(5000).optional(),
    valueProposition: z.string().max(2000).optional(),
    marketPositioning: z.string().max(2000).optional(),
    targetMarketSegments: z.array(z.string().min(1)).optional(),
    revenueModel: z.string().max(500).optional(),
    pricingStrategy: z.string().max(500).optional(),
    innovationAxes: z.array(z.string().min(1)).optional(),
    techDifferentiators: z.array(z.string().min(1)).optional(),
});

// ---------------------------------------------------------------------------
// Normalization & Formatting Utilities
// ---------------------------------------------------------------------------

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

export const normalizeBusinessContext = (
    context?: BusinessContext | null
): BusinessContext | null => {
    if (!context || typeof context !== "object") return null;
    const normalized: BusinessContext = {
        workspaceId: context.workspaceId,
        productVision: cleanText(context.productVision),
        valueProposition: cleanText(context.valueProposition),
        marketPositioning: cleanText(context.marketPositioning),
        targetMarketSegments: cleanList(context.targetMarketSegments),
        personas: context.personas ?? [],
        competitors: context.competitors ?? [],
        revenueModel: cleanText(context.revenueModel),
        pricingStrategy: cleanText(context.pricingStrategy),
        innovationAxes: cleanList(context.innovationAxes),
        techDifferentiators: cleanList(context.techDifferentiators),
        lastUpdatedAt: context.lastUpdatedAt,
        lastAnalysisAt: context.lastAnalysisAt,
    };

    const hasContent =
        normalized.productVision ||
        normalized.valueProposition ||
        normalized.personas.length > 0 ||
        normalized.competitors.length > 0;

    return hasContent ? normalized : null;
};

const limitList = (values: string[], limit = 3) => {
    if (values.length <= limit) return values;
    return [...values.slice(0, limit), "..."];
};

export const formatBusinessContextSummary = (
    context?: BusinessContext | null
): string | null => {
    const normalized = normalizeBusinessContext(context);
    if (!normalized) return null;

    const parts: string[] = [];
    if (normalized.productVision) {
        parts.push(`Vision: ${normalized.productVision.slice(0, 80)}${normalized.productVision.length > 80 ? "..." : ""}`);
    }
    if (normalized.valueProposition) {
        parts.push(`Value: ${normalized.valueProposition.slice(0, 80)}${normalized.valueProposition.length > 80 ? "..." : ""}`);
    }
    if (normalized.personas.length) {
        parts.push(`Personas: ${normalized.personas.map((p) => p.name).join(", ")}`);
    }
    if (normalized.competitors.length) {
        parts.push(`Competitors: ${normalized.competitors.map((c) => c.name).join(", ")}`);
    }
    if (normalized.innovationAxes?.length) {
        parts.push(`Innovation: ${limitList(normalized.innovationAxes).join("; ")}`);
    }
    return parts.join(" · ");
};

export const formatBusinessContextPrompt = (
    context?: BusinessContext | null
): string | null => {
    const normalized = normalizeBusinessContext(context);
    if (!normalized) return null;

    const lines: string[] = [
        "BUSINESS CONTEXT (must guide analysis & feature generation):",
    ];

    if (normalized.productVision) {
        lines.push(`- Product vision: ${normalized.productVision}`);
    }
    if (normalized.valueProposition) {
        lines.push(`- Value proposition: ${normalized.valueProposition}`);
    }
    if (normalized.marketPositioning) {
        lines.push(`- Market positioning: ${normalized.marketPositioning}`);
    }
    if (normalized.targetMarketSegments?.length) {
        lines.push(`- Target market segments: ${normalized.targetMarketSegments.join(", ")}`);
    }
    if (normalized.revenueModel) {
        lines.push(`- Revenue model: ${normalized.revenueModel}`);
    }
    if (normalized.pricingStrategy) {
        lines.push(`- Pricing strategy: ${normalized.pricingStrategy}`);
    }

    if (normalized.personas.length) {
        lines.push("- User personas:");
        for (const persona of normalized.personas) {
            lines.push(`  - ${persona.name} (${persona.role}): Goals: ${persona.goals.join("; ")}. Pain points: ${persona.painPoints.join("; ")}`);
        }
    }

    if (normalized.competitors.length) {
        lines.push("- Competitors:");
        for (const competitor of normalized.competitors) {
            const parts = [`${competitor.name}: ${competitor.description}`];
            if (competitor.strengths.length) parts.push(`Strengths: ${competitor.strengths.join(", ")}`);
            if (competitor.weaknesses.length) parts.push(`Weaknesses: ${competitor.weaknesses.join(", ")}`);
            lines.push(`  - ${parts.join(". ")}`);
        }
    }

    if (normalized.innovationAxes?.length) {
        lines.push(`- Innovation axes: ${normalized.innovationAxes.join(", ")}`);
    }
    if (normalized.techDifferentiators?.length) {
        lines.push(`- Technical differentiators: ${normalized.techDifferentiators.join(", ")}`);
    }

    lines.push("");
    lines.push("Instructions:");
    lines.push("- Align all feature proposals with the product vision and value proposition.");
    lines.push("- Prioritize features that address persona pain points and advance innovation axes.");
    lines.push("- Compare against competitors to identify gaps and differentiation opportunities.");
    lines.push("- Consider the revenue model and pricing strategy when assessing business value.");

    return lines.join("\n");
};
