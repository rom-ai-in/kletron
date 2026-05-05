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
const PROFILE_DISPLAY_NAME_RE = /^- Display name:\s*(.+)$/im;
const COMPANY_ORG_RE = /^- Organization:\s*(.+)$/im;

function cleanValue(value?: string | null): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

async function readProfileMemory(workspaceId: string): Promise<{
    userDisplayName?: string;
    preferredLanguage?: string;
}> {
    if (!ObjectId.isValid(workspaceId)) return {};
    try {
        const content = await agentMemoryService.read("/memories/profile.md", new ObjectId(workspaceId));
        const languageMatch = content.match(PROFILE_LANGUAGE_RE);
        const displayNameMatch = content.match(PROFILE_DISPLAY_NAME_RE);
        return {
            userDisplayName: cleanValue(displayNameMatch?.[1]),
            preferredLanguage: cleanValue(languageMatch?.[1]),
        };
    } catch {
        return {};
    }
}

async function readCompanyFromMemory(workspaceId: string): Promise<string | undefined> {
    if (!ObjectId.isValid(workspaceId)) return undefined;
    try {
        const content = await agentMemoryService.read("/memories/company.md", new ObjectId(workspaceId));
        const match = content.match(COMPANY_ORG_RE);
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

async function resolveSafely<T>(label: string, loader: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await loader();
    } catch (error) {
        console.warn(`[RuntimeProfile] Failed to resolve ${label}:`, (error as Error)?.message ?? error);
        return fallback;
    }
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

    const [profile, organization, profileMemory, memoryCompany, connectorDefaults] = await Promise.all([
        userId
            ? resolveSafely("user profile", () => getProfileByUserId(userId), null)
            : Promise.resolve(null),
        userId
            ? resolveSafely("organization", () => getOrganizationPayloadForUser(userId), null)
            : Promise.resolve(null),
        resolveSafely("profile memory", () => readProfileMemory(workspaceId), {}),
        resolveSafely("company memory", () => readCompanyFromMemory(workspaceId), undefined),
        resolveSafely(
            "connector defaults",
            () => resolveSafeConnectorPromptDefaults(workspaceId, enabledIntegrationProviderIds),
            [],
        ),
    ]);

    const preferredLanguage =
        cleanValue(documentContext?.languages?.[0]) ??
        cleanValue(profileMemory.preferredLanguage);

    return {
        userDisplayName:
            cleanValue(profile?.fullName) ??
            cleanValue(profileMemory.userDisplayName),
        workspaceName,
        companyOrOrg:
            pickCompanyOrOrg(organization) ??
            cleanValue(memoryCompany),
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
