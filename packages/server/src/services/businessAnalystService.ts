import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type {
    BusinessContext,
    UserPersona,
    Competitor,
} from "@kletron/shared/businessContext";
import type {
    FeatureProposal,
    FeatureFilter,
    MarketAnalysis,
    BADashboardSummary,
    FeatureType,
    FeatureStatus,
} from "@kletron/shared/businessAnalystTypes";

// ---------------------------------------------------------------------------
// Collection Names
// ---------------------------------------------------------------------------

const CONTEXT_COLLECTION = "business_contexts";
const FEATURES_COLLECTION = "feature_proposals";
const MARKET_COLLECTION = "market_analyses";

// ---------------------------------------------------------------------------
// Fallback In-Memory Store
// ---------------------------------------------------------------------------

let fallbackEnabled = false;
let fallbackWarned = false;
const fallbackContexts = new Map<string, BusinessContext>();
const fallbackFeatures = new Map<string, FeatureProposal>();
const fallbackMarketAnalyses = new Map<string, MarketAnalysis>();

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[BusinessAnalyst] Falling back to in-memory store:", (error as Error)?.message ?? error);
}

async function getCollectionSafe(name: string) {
    if (fallbackEnabled) return null;
    try {
        const db = await getDb();
        return db.collection(name);
    } catch (error) {
        fallbackEnabled = true;
        warnFallback(error);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BusinessAnalystService {
    // -----------------------------------------------------------------------
    // Business Context (one per workspace)
    // -----------------------------------------------------------------------

    async getBusinessContext(workspaceId: string): Promise<BusinessContext | null> {
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);
        if (!collection) {
            return fallbackContexts.get(workspaceId) ?? null;
        }
        const doc = await collection.findOne({ workspaceId });
        return (doc as unknown as BusinessContext) || null;
    }

    async updateBusinessContext(workspaceId: string, updates: Partial<BusinessContext>): Promise<void> {
        const now = new Date();
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const existing = fallbackContexts.get(workspaceId) ?? {
                workspaceId,
                personas: [],
                competitors: [],
            };
            fallbackContexts.set(workspaceId, {
                ...existing,
                ...updates,
                workspaceId,
                lastUpdatedAt: now,
            });
            return;
        }

        await collection.updateOne(
            { workspaceId },
            {
                $set: {
                    ...updates,
                    workspaceId,
                    lastUpdatedAt: now,
                },
                $setOnInsert: {
                    personas: [],
                    competitors: [],
                },
            },
            { upsert: true }
        );
    }

    // -----------------------------------------------------------------------
    // Personas (sub-documents of BusinessContext)
    // -----------------------------------------------------------------------

    async addPersona(workspaceId: string, persona: Omit<UserPersona, "id">): Promise<string> {
        const id = new ObjectId().toString();
        const fullPersona: UserPersona = { ...persona, id };
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId) ?? {
                workspaceId,
                personas: [],
                competitors: [],
            };
            ctx.personas.push(fullPersona);
            ctx.lastUpdatedAt = new Date();
            fallbackContexts.set(workspaceId, ctx);
            return id;
        }

        await collection.updateOne(
            { workspaceId },
            {
                $push: { personas: fullPersona as any },
                $set: { lastUpdatedAt: new Date() },
                $setOnInsert: { workspaceId, competitors: [] },
            },
            { upsert: true }
        );
        return id;
    }

    async updatePersona(workspaceId: string, personaId: string, updates: Partial<UserPersona>): Promise<void> {
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId);
            if (!ctx) return;
            const idx = ctx.personas.findIndex((p) => p.id === personaId);
            if (idx === -1) return;
            ctx.personas[idx] = { ...ctx.personas[idx], ...updates, id: personaId };
            ctx.lastUpdatedAt = new Date();
            return;
        }

        const setFields: Record<string, any> = { lastUpdatedAt: new Date() };
        for (const [key, value] of Object.entries(updates)) {
            if (key !== "id") {
                setFields[`personas.$.${key}`] = value;
            }
        }

        await collection.updateOne(
            { workspaceId, "personas.id": personaId },
            { $set: setFields }
        );
    }

    async deletePersona(workspaceId: string, personaId: string): Promise<void> {
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId);
            if (!ctx) return;
            ctx.personas = ctx.personas.filter((p) => p.id !== personaId);
            ctx.lastUpdatedAt = new Date();
            return;
        }

        await collection.updateOne(
            { workspaceId },
            {
                $pull: { personas: { id: personaId } as any },
                $set: { lastUpdatedAt: new Date() },
            }
        );
    }

    // -----------------------------------------------------------------------
    // Competitors (sub-documents of BusinessContext)
    // -----------------------------------------------------------------------

    async addCompetitor(workspaceId: string, competitor: Omit<Competitor, "id">): Promise<string> {
        const id = new ObjectId().toString();
        const fullCompetitor: Competitor = { ...competitor, id };
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId) ?? {
                workspaceId,
                personas: [],
                competitors: [],
            };
            ctx.competitors.push(fullCompetitor);
            ctx.lastUpdatedAt = new Date();
            fallbackContexts.set(workspaceId, ctx);
            return id;
        }

        await collection.updateOne(
            { workspaceId },
            {
                $push: { competitors: fullCompetitor as any },
                $set: { lastUpdatedAt: new Date() },
                $setOnInsert: { workspaceId, personas: [] },
            },
            { upsert: true }
        );
        return id;
    }

    async updateCompetitor(workspaceId: string, competitorId: string, updates: Partial<Competitor>): Promise<void> {
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId);
            if (!ctx) return;
            const idx = ctx.competitors.findIndex((c) => c.id === competitorId);
            if (idx === -1) return;
            ctx.competitors[idx] = { ...ctx.competitors[idx], ...updates, id: competitorId };
            ctx.lastUpdatedAt = new Date();
            return;
        }

        const setFields: Record<string, any> = { lastUpdatedAt: new Date() };
        for (const [key, value] of Object.entries(updates)) {
            if (key !== "id") {
                setFields[`competitors.$.${key}`] = value;
            }
        }

        await collection.updateOne(
            { workspaceId, "competitors.id": competitorId },
            { $set: setFields }
        );
    }

    async deleteCompetitor(workspaceId: string, competitorId: string): Promise<void> {
        const collection = await getCollectionSafe(CONTEXT_COLLECTION);

        if (!collection) {
            const ctx = fallbackContexts.get(workspaceId);
            if (!ctx) return;
            ctx.competitors = ctx.competitors.filter((c) => c.id !== competitorId);
            ctx.lastUpdatedAt = new Date();
            return;
        }

        await collection.updateOne(
            { workspaceId },
            {
                $pull: { competitors: { id: competitorId } as any },
                $set: { lastUpdatedAt: new Date() },
            }
        );
    }

    // -----------------------------------------------------------------------
    // Feature Proposals
    // -----------------------------------------------------------------------

    async listFeatures(workspaceId: string, filter?: FeatureFilter): Promise<FeatureProposal[]> {
        const collection = await getCollectionSafe(FEATURES_COLLECTION);

        if (!collection) {
            let features = Array.from(fallbackFeatures.values()).filter(
                (f) => f.workspaceId === workspaceId
            );
            if (filter?.type) features = features.filter((f) => f.type === filter.type);
            if (filter?.status) features = features.filter((f) => f.status === filter.status);
            if (filter?.source) features = features.filter((f) => f.source === filter.source);
            if (filter?.minPriority != null) features = features.filter((f) => f.priority >= filter.minPriority!);
            if (filter?.personaId) features = features.filter((f) => f.targetPersonas?.includes(filter.personaId!));
            if (filter?.search) {
                const needle = filter.search.toLowerCase();
                features = features.filter(
                    (f) =>
                        f.title.toLowerCase().includes(needle) ||
                        f.summary.toLowerCase().includes(needle) ||
                        f.description.toLowerCase().includes(needle)
                );
            }
            return features.sort((a, b) => b.priority - a.priority);
        }

        const query: any = { workspaceId };
        if (filter?.type) query.type = filter.type;
        if (filter?.status) query.status = filter.status;
        if (filter?.source) query.source = filter.source;
        if (filter?.minPriority != null) query.priority = { $gte: filter.minPriority };
        if (filter?.personaId) query.targetPersonas = filter.personaId;
        if (filter?.search) {
            const escaped = filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { title: { $regex: escaped, $options: "i" } },
                { summary: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } },
            ];
        }

        const docs = await collection.find(query).sort({ priority: -1 }).toArray();
        return docs.map((doc) => ({
            ...doc,
            id: doc._id.toString(),
        })) as unknown as FeatureProposal[];
    }

    async getFeature(workspaceId: string, featureId: string): Promise<FeatureProposal | null> {
        if (!ObjectId.isValid(featureId)) return null;
        const collection = await getCollectionSafe(FEATURES_COLLECTION);

        if (!collection) {
            const f = fallbackFeatures.get(featureId);
            return f && f.workspaceId === workspaceId ? f : null;
        }

        const doc = await collection.findOne({ _id: new ObjectId(featureId), workspaceId });
        if (!doc) return null;
        return { ...doc, id: doc._id.toString() } as unknown as FeatureProposal;
    }

    async createFeature(
        workspaceId: string,
        data: Omit<FeatureProposal, "id" | "createdAt" | "updatedAt">
    ): Promise<string> {
        const now = new Date();
        const collection = await getCollectionSafe(FEATURES_COLLECTION);

        if (!collection) {
            const id = new ObjectId().toString();
            const feature: FeatureProposal = {
                ...data,
                id,
                workspaceId,
                createdAt: now,
                updatedAt: now,
            };
            fallbackFeatures.set(id, feature);
            return id;
        }

        const result = await collection.insertOne({
            ...data,
            workspaceId,
            createdAt: now,
            updatedAt: now,
        } as any);
        return result.insertedId.toString();
    }

    async updateFeature(workspaceId: string, featureId: string, updates: Partial<FeatureProposal>): Promise<void> {
        if (!ObjectId.isValid(featureId)) {
            throw new Error("Invalid feature ID format");
        }
        const collection = await getCollectionSafe(FEATURES_COLLECTION);
        const { id: _id, ...updateData } = updates as any;
        updateData.updatedAt = new Date();

        if (!collection) {
            const existing = fallbackFeatures.get(featureId);
            if (!existing || existing.workspaceId !== workspaceId) return;
            fallbackFeatures.set(featureId, { ...existing, ...updateData, id: featureId });
            return;
        }

        await collection.updateOne(
            { _id: new ObjectId(featureId), workspaceId },
            { $set: updateData }
        );
    }

    async deleteFeature(workspaceId: string, featureId: string): Promise<void> {
        if (!ObjectId.isValid(featureId)) {
            throw new Error("Invalid feature ID format");
        }
        const collection = await getCollectionSafe(FEATURES_COLLECTION);

        if (!collection) {
            const existing = fallbackFeatures.get(featureId);
            if (existing?.workspaceId === workspaceId) {
                fallbackFeatures.delete(featureId);
            }
            return;
        }

        await collection.deleteOne({ _id: new ObjectId(featureId), workspaceId });
    }

    async bulkImportFeatures(
        workspaceId: string,
        features: Omit<FeatureProposal, "id" | "createdAt" | "updatedAt">[]
    ): Promise<number> {
        if (!features.length) return 0;
        const now = new Date();
        const collection = await getCollectionSafe(FEATURES_COLLECTION);

        if (!collection) {
            for (const feature of features) {
                const id = new ObjectId().toString();
                fallbackFeatures.set(id, {
                    ...feature,
                    id,
                    workspaceId,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            return features.length;
        }

        const docs = features.map((f) => ({
            ...f,
            workspaceId,
            createdAt: now,
            updatedAt: now,
        }));
        const result = await collection.insertMany(docs as any[]);
        return result.insertedCount;
    }

    // -----------------------------------------------------------------------
    // Market Analysis
    // -----------------------------------------------------------------------

    async getLatestMarketAnalysis(workspaceId: string): Promise<MarketAnalysis | null> {
        const collection = await getCollectionSafe(MARKET_COLLECTION);

        if (!collection) {
            const analyses = Array.from(fallbackMarketAnalyses.values()).filter(
                (a) => a.workspaceId === workspaceId
            );
            if (!analyses.length) return null;
            return analyses.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];
        }

        const doc = await collection
            .find({ workspaceId })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();
        if (!doc.length) return null;
        return { ...doc[0], id: doc[0]._id.toString() } as unknown as MarketAnalysis;
    }

    async saveMarketAnalysis(
        workspaceId: string,
        analysis: Omit<MarketAnalysis, "id" | "createdAt">
    ): Promise<string> {
        const now = new Date();
        const collection = await getCollectionSafe(MARKET_COLLECTION);

        if (!collection) {
            const id = new ObjectId().toString();
            fallbackMarketAnalyses.set(id, {
                ...analysis,
                id,
                workspaceId,
                createdAt: now,
            });
            return id;
        }

        const result = await collection.insertOne({
            ...analysis,
            workspaceId,
            createdAt: now,
        } as any);
        return result.insertedId.toString();
    }

    // -----------------------------------------------------------------------
    // Dashboard Aggregation
    // -----------------------------------------------------------------------

    async getDashboardSummary(workspaceId: string): Promise<BADashboardSummary> {
        const features = await this.listFeatures(workspaceId);
        const latestAnalysis = await this.getLatestMarketAnalysis(workspaceId);

        const byType: Record<FeatureType, number> = {
            new_feature: 0, improvement: 0, fix: 0, optimization: 0,
            innovation: 0, competitive: 0, technical_debt: 0, compliance: 0,
        };
        const byStatus: Record<FeatureStatus, number> = {
            draft: 0, analyzed: 0, validated: 0, rejected: 0,
            planned: 0, in_progress: 0, shipped: 0,
        };
        const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };

        let totalInnovation = 0;
        let innovationCount = 0;

        for (const f of features) {
            byType[f.type] = (byType[f.type] ?? 0) + 1;
            byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
            switch (f.businessValue) {
                case "CRITICAL": byPriority.critical++; break;
                case "HIGH": byPriority.high++; break;
                case "MEDIUM": byPriority.medium++; break;
                case "LOW": byPriority.low++; break;
            }
            if (f.innovationScore != null) {
                totalInnovation += f.innovationScore;
                innovationCount++;
            }
        }

        const topPriorityFeatures = features
            .filter((f) => f.status !== "rejected" && f.status !== "shipped")
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 5);

        return {
            totalFeatures: features.length,
            byType,
            byStatus,
            byPriority,
            topPriorityFeatures,
            lastAnalysis: latestAnalysis?.createdAt,
            innovationScore: innovationCount > 0 ? Math.round(totalInnovation / innovationCount) : undefined,
        };
    }
}

export const businessAnalystService = new BusinessAnalystService();
