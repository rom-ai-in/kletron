import type { DocumentContext } from "@kletron/shared/documentContext";
import type { GraphRouteInfo, GraphSelectionMode } from "@kletron/shared/chatTypes";
import type { AgentGraphDefinition } from "./agentGraphTypes";

type AutoRouteCandidate = {
    graph: AgentGraphDefinition;
    score: number;
    reasonParts: string[];
};

function normalizeText(value: string): string {
    return value.toLowerCase();
}

function unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function graphIdOf(graph: AgentGraphDefinition): string | undefined {
    return graph._id ? String(graph._id) : undefined;
}

function buildPersistentContextText(documentContext?: DocumentContext | null): string {
    if (!documentContext) return "";
    const values: string[] = [];
    if (documentContext.mission) values.push(documentContext.mission);
    if (documentContext.primaryGoal) values.push(documentContext.primaryGoal);
    if (documentContext.targetAudience) values.push(documentContext.targetAudience);
    if (documentContext.timeHorizon) values.push(documentContext.timeHorizon);
    if (documentContext.tone) values.push(documentContext.tone);
    values.push(...(documentContext.keyObjectives ?? []));
    values.push(...(documentContext.constraints ?? []));
    values.push(...(documentContext.frameworks ?? []));
    values.push(...(documentContext.hotspots ?? []));
    return normalizeText(values.join(" \n "));
}

function scoreGraphCandidate(input: {
    graph: AgentGraphDefinition;
    message: string;
    workMode: "code" | "work";
    activeConnectorProviderIds: string[];
    persistentContextText: string;
}): AutoRouteCandidate {
    const { graph, message, workMode, activeConnectorProviderIds, persistentContextText } = input;
    const routing = graph.routing;
    const reasonParts: string[] = [];
    if (!routing) {
        return { graph, score: Number.NEGATIVE_INFINITY, reasonParts };
    }

    let score = 0;
    const lowerMessage = normalizeText(message);

    if (routing.preferredWorkModes?.includes(workMode)) {
        score += 2;
        reasonParts.push(`workMode=${workMode}`);
    }

    const requiredConnectors = unique(routing.requiredConnectors ?? []);
    if (requiredConnectors.length > 0) {
        const matchedConnectors = requiredConnectors.filter((providerId) =>
            activeConnectorProviderIds.includes(providerId),
        );
        if (matchedConnectors.length === 0) {
            return {
                graph,
                score: Number.NEGATIVE_INFINITY,
                reasonParts: ["missing required connectors"],
            };
        }
        score += matchedConnectors.length * 2;
        reasonParts.push(`connectors=${matchedConnectors.join(",")}`);
    }

    const matchedKeywords = unique((routing.keywords ?? []).filter((keyword) => lowerMessage.includes(normalizeText(keyword))));
    if (matchedKeywords.length > 0) {
        score += matchedKeywords.length * 3;
        reasonParts.push(`keywords=${matchedKeywords.join(",")}`);
    }

    const matchedIntents = unique((routing.intents ?? []).filter((intent) => lowerMessage.includes(normalizeText(intent))));
    if (matchedIntents.length > 0) {
        score += matchedIntents.length * 4;
        reasonParts.push(`intents=${matchedIntents.join(",")}`);
    }

    const matchedDomains = unique((routing.domains ?? []).filter((domain) => persistentContextText.includes(normalizeText(domain))));
    if (matchedDomains.length > 0) {
        score += matchedDomains.length;
        reasonParts.push(`domains=${matchedDomains.join(",")}`);
    }

    return { graph, score, reasonParts };
}

export async function resolveGraphSelectionForNewSession(input: {
    graphSelectionMode: GraphSelectionMode;
    message: string;
    workMode: "code" | "work";
    requestedGraphId?: string;
    overrideGraphId?: string;
    channelDefaultGraphId?: string | null;
    documentContext?: DocumentContext | null;
    activeConnectorProviderIds?: string[];
    listGraphs: () => Promise<AgentGraphDefinition[]>;
    resolveGraphById: (graphId?: string) => Promise<AgentGraphDefinition | null>;
}): Promise<{ graph: AgentGraphDefinition; route: GraphRouteInfo }> {
    const {
        graphSelectionMode,
        message,
        workMode,
        requestedGraphId,
        overrideGraphId,
        channelDefaultGraphId,
        documentContext,
        activeConnectorProviderIds = [],
        listGraphs,
        resolveGraphById,
    } = input;

    if (requestedGraphId) {
        const explicitGraph = await resolveGraphById(requestedGraphId);
        if (!explicitGraph) {
            throw new Error(`Graph ${requestedGraphId} not found`);
        }
        return {
            graph: explicitGraph,
            route: {
                source: "explicit_graph",
                reason: "Client requested an explicit graph.",
                confidence: 1,
                resolvedGraphId: graphIdOf(explicitGraph),
                resolvedGraphName: explicitGraph.name,
                graphSelectionMode,
            },
        };
    }

    if (overrideGraphId) {
        const overrideGraph = await resolveGraphById(overrideGraphId);
        if (!overrideGraph) {
            throw new Error(`Override graph ${overrideGraphId} not found`);
        }
        return {
            graph: overrideGraph,
            route: {
                source: "channel_override",
                reason: "A higher-priority channel override selected this graph.",
                confidence: 1,
                resolvedGraphId: graphIdOf(overrideGraph),
                resolvedGraphName: overrideGraph.name,
                graphSelectionMode,
            },
        };
    }

    if (graphSelectionMode === "auto") {
        const graphs = await listGraphs();
        const persistentContextText = buildPersistentContextText(documentContext);
        const ranked = graphs
            .map((graph) =>
                scoreGraphCandidate({
                    graph,
                    message,
                    workMode,
                    activeConnectorProviderIds,
                    persistentContextText,
                }),
            )
            .filter((candidate) => Number.isFinite(candidate.score))
            .sort((a, b) => b.score - a.score);

        const best = ranked[0];
        if (best && best.score >= 4) {
            const confidence = Math.max(0, Math.min(1, best.score / 12));
            return {
                graph: best.graph,
                route: {
                    source: "auto_router",
                    reason:
                        best.reasonParts.length > 0
                            ? `Auto-router matched ${best.reasonParts.join("; ")}.`
                            : "Auto-router selected the best matching graph.",
                    confidence,
                    resolvedGraphId: graphIdOf(best.graph),
                    resolvedGraphName: best.graph.name,
                    graphSelectionMode,
                },
            };
        }
    }

    if (channelDefaultGraphId) {
        const defaultGraph = await resolveGraphById(channelDefaultGraphId);
        if (defaultGraph) {
            return {
                graph: defaultGraph,
                route: {
                    source: "workspace_channel_default",
                    reason: "No explicit graph or confident auto-route; using the workspace channel default.",
                    confidence: 0.5,
                    resolvedGraphId: graphIdOf(defaultGraph),
                    resolvedGraphName: defaultGraph.name,
                    graphSelectionMode,
                },
            };
        }
    }

    const fallbackGraph = await resolveGraphById(undefined);
    if (!fallbackGraph) {
        throw new Error("No agent graphs available. Please seed graphs first.");
    }
    return {
        graph: fallbackGraph,
        route: {
            source: "fallback_default",
            reason: "No explicit graph or confident route; using the canonical fallback graph.",
            confidence: 0.25,
            resolvedGraphId: graphIdOf(fallbackGraph),
            resolvedGraphName: fallbackGraph.name,
            graphSelectionMode,
        },
    };
}
