import { describe, expect, it } from "vitest";
import { resolveGraphSelectionForNewSession } from "../src/services/graphRoutingService";
import type { AgentGraphDefinition } from "../src/services/agentGraphTypes";

const now = new Date();

function makeGraph(input: Partial<AgentGraphDefinition> & Pick<AgentGraphDefinition, "name">): AgentGraphDefinition {
    return {
        name: input.name,
        description: input.description,
        category: "graph",
        createdAt: now,
        updatedAt: now,
        nodes: [],
        edges: [],
        routing: input.routing,
        _id: (input._id ?? `${input.name}-id`) as any,
    };
}

describe("graphRoutingService", () => {
    it("keeps the explicitly requested graph even when the message looks like Sentry", async () => {
        const manualGraph = makeGraph({ name: "Manual Graph" });
        const sentryGraph = makeGraph({
            name: "Operations & Incident Response (work graph)",
            routing: {
                intents: ["sentry", "incident"],
                keywords: ["sentry", "error"],
                requiredConnectors: ["sentry"],
                preferredWorkModes: ["work"],
            },
        });
        const graphs = [manualGraph, sentryGraph];

        const result = await resolveGraphSelectionForNewSession({
            graphSelectionMode: "manual",
            message: "use sentry and tell me where we stand",
            workMode: "work",
            requestedGraphId: String(manualGraph._id),
            activeConnectorProviderIds: ["sentry"],
            listGraphs: async () => graphs,
            resolveGraphById: async (graphId) =>
                graphs.find((graph) => String(graph._id) === graphId) ?? graphs[0],
        });

        expect(result.graph.name).toBe("Manual Graph");
        expect(result.route.source).toBe("explicit_graph");
    });

    it("auto-routes a vague Sentry request to the ops graph when Sentry is active", async () => {
        const defaultGraph = makeGraph({
            name: "Company Growth & GTM (work graph)",
            routing: {
                keywords: ["gtm", "pipeline"],
                preferredWorkModes: ["work"],
            },
        });
        const sentryGraph = makeGraph({
            name: "Operations & Incident Response (work graph)",
            routing: {
                intents: ["sentry", "incident"],
                keywords: ["sentry", "error", "incident"],
                requiredConnectors: ["sentry"],
                preferredWorkModes: ["work"],
            },
        });
        const graphs = [defaultGraph, sentryGraph];

        const result = await resolveGraphSelectionForNewSession({
            graphSelectionMode: "auto",
            message: "utilise sentry et dis moi ou on en est avec les erreurs",
            workMode: "work",
            activeConnectorProviderIds: ["sentry"],
            listGraphs: async () => graphs,
            resolveGraphById: async (graphId) =>
                graphs.find((graph) => String(graph._id) === graphId) ?? defaultGraph,
        });

        expect(result.graph.name).toBe("Operations & Incident Response (work graph)");
        expect(result.route.source).toBe("auto_router");
        expect(result.route.reason.toLowerCase()).toContain("keywords");
    });
});
