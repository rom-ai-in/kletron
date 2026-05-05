import { ObjectId } from "mongodb";
import type { DocumentContext } from "@kletron/shared/documentContext";
import type { AgentGraphDefinition } from "./agentGraphTypes";
import { getProfileByUserId } from "./userProfileService";
import { getOrganizationPayloadForUser } from "./organizationService";
import { agentMemoryService } from "./agentMemoryService";
import {
    resolveSafeConnectorPromptDefaults,
    type SafeConnectorPromptDefault,
} from "./connectorPromptDefaultsService";

export type RuntimeProfileContext = {
    userDisplayName?: string;
    workspaceName: string;
    companyOrOrg?: string;
    preferredLanguage?: string;
    graphName: string;
    graphCategory?: string;
    workMode: "code" | "work";
    connectorDefaults: SafeConnectorPromptDefault[];
};

const PROFILE_LANGUAGE_RE = /^- Preferred language:\s*(.+)$/im;

function cleanValue(value?: string | null): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

async function readPreferredLanguageFromMemory(workspaceId: string): Promise<string | undefined> {
    if (!ObjectId.isValid(workspaceId)) return undefined;
    try {
        const content = await agentMemoryService.read("/memories/profile.md", new ObjectId(workspaceId));
        const match = content.match(PROFILE_LANGUAGE_RE);
        return cleanValue(match?.[1]);
    } catch {
        return undefined;
    }
}

function pickCompanyOrOrg(payload: Awaited<ReturnType<typeof getOrganizationPayloadForUser>>): string | undefined {
    if (!payload) return undefined;
    const firstNonDefaultCompany = payload.companies.find(
        (company) => company.name.trim().toLowerCase() !== "default",
    );
    return cleanValue(firstNonDefaultCompany?.name) ?? cleanValue(payload.tenant.name);
}

export async function resolveRuntimeProfileContext(input: {
    workspaceId: string;
    workspaceName: string;
    userId?: string | null;
    graph: Pick<AgentGraphDefinition, "name" | "category">;
    workMode: "code" | "work";
    documentContext?: DocumentContext | null;
    enabledIntegrationProviderIds?: string[];
}): Promise<RuntimeProfileContext> {
    const {
        workspaceId,
        workspaceName,
        userId,
        graph,
        workMode,
        documentContext,
        enabledIntegrationProviderIds = [],
    } = input;

    const [profile, organization, memoryLanguage, connectorDefaults] = await Promise.all([
        userId ? getProfileByUserId(userId) : Promise.resolve(null),
        userId ? getOrganizationPayloadForUser(userId) : Promise.resolve(null),
        readPreferredLanguageFromMemory(workspaceId),
        resolveSafeConnectorPromptDefaults(workspaceId, enabledIntegrationProviderIds),
    ]);

    const preferredLanguage =
        cleanValue(documentContext?.languages?.[0]) ??
        cleanValue(memoryLanguage);

    return {
        userDisplayName: cleanValue(profile?.fullName),
        workspaceName,
        companyOrOrg: pickCompanyOrOrg(organization),
        preferredLanguage,
        graphName: graph.name,
        graphCategory: cleanValue(graph.category),
        workMode,
        connectorDefaults,
    };
}

export function formatRunContextPrompt(context: RuntimeProfileContext): string {
    const lines = ["RUN CONTEXT:"];
    if (context.userDisplayName) {
        lines.push(`- User name: ${context.userDisplayName}`);
    }
    lines.push(`- Workspace name: ${context.workspaceName}`);
    if (context.companyOrOrg) {
        lines.push(`- Company / org: ${context.companyOrOrg}`);
    }
    if (context.preferredLanguage) {
        lines.push(`- Preferred language: ${context.preferredLanguage}`);
    }
    lines.push(`- Graph: ${context.graphName}`);
    if (context.graphCategory) {
        lines.push(`- Graph category: ${context.graphCategory}`);
    }
    lines.push(`- Work mode: ${context.workMode}`);
    if (context.connectorDefaults.length > 0) {
        lines.push("- Connector defaults:");
        for (const item of context.connectorDefaults) {
            const detailPairs = Object.entries(item.details)
                .filter(([key, value]) => key !== "displayName" && value.trim().length > 0)
                .map(([key, value]) => `${key}=${value}`);
            const label = item.displayName
                ? `${item.providerId} (${item.displayName})`
                : item.providerId;
            if (detailPairs.length > 0) {
                lines.push(`  - ${label}: ${detailPairs.join("; ")}`);
            } else {
                lines.push(`  - ${label}`);
            }
        }
    }
    return lines.join("\n");
}
