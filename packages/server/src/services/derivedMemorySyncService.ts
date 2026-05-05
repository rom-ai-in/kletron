import { ObjectId } from "mongodb";
import type { RuntimeProfileContext } from "./runtimeProfileContextService";
import { agentMemoryService } from "./agentMemoryService";

export type DerivedMemorySyncResult = {
    updatedPaths: string[];
    unchangedPaths: string[];
};

async function writeIfChanged(
    workspaceObjectId: ObjectId,
    path: string,
    nextContent: string,
    result: DerivedMemorySyncResult,
) {
    let currentContent: string | null = null;
    try {
        currentContent = await agentMemoryService.read(path, workspaceObjectId);
    } catch {
        currentContent = null;
    }
    if (currentContent === nextContent) {
        result.unchangedPaths.push(path);
        return;
    }
    await agentMemoryService.write(path, nextContent, workspaceObjectId);
    result.updatedPaths.push(path);
}

function renderProfileMemory(context: RuntimeProfileContext): string {
    const lines = ["# User Profile"];
    if (context.userDisplayName) {
        lines.push(`- Display name: ${context.userDisplayName}`);
    }
    if (context.preferredLanguage) {
        lines.push(`- Preferred language: ${context.preferredLanguage}`);
    }
    lines.push(`- Workspace name: ${context.workspaceName}`);
    return `${lines.join("\n")}\n`;
}

function renderCompanyMemory(context: RuntimeProfileContext): string {
    const lines = ["# Company"];
    lines.push(`- Workspace name: ${context.workspaceName}`);
    if (context.companyOrOrg) {
        lines.push(`- Organization: ${context.companyOrOrg}`);
    }
    lines.push(`- Work mode: ${context.workMode}`);
    return `${lines.join("\n")}\n`;
}

function renderSentryMemory(context: RuntimeProfileContext): string | null {
    const sentry = context.connectorDefaults.find((item) => item.providerId === "sentry");
    if (!sentry) return null;
    const lines = ["# Sentry Defaults"];
    if (sentry.displayName) {
        lines.push(`- Display name: ${sentry.displayName}`);
    }
    if (sentry.details.host) {
        lines.push(`- Host: ${sentry.details.host}`);
    }
    if (sentry.details.organizationSlug) {
        lines.push(`- Organization slug: ${sentry.details.organizationSlug}`);
    }
    return `${lines.join("\n")}\n`;
}

export async function syncDerivedMemories(input: {
    workspaceId: string;
    runtimeProfile: RuntimeProfileContext;
}): Promise<DerivedMemorySyncResult> {
    const { workspaceId, runtimeProfile } = input;
    const result: DerivedMemorySyncResult = {
        updatedPaths: [],
        unchangedPaths: [],
    };
    if (!ObjectId.isValid(workspaceId)) return result;

    const workspaceObjectId = new ObjectId(workspaceId);
    const writes: Promise<void>[] = [
        writeIfChanged(
            workspaceObjectId,
            "/memories/profile.md",
            renderProfileMemory(runtimeProfile),
            result,
        ),
        writeIfChanged(
            workspaceObjectId,
            "/memories/company.md",
            renderCompanyMemory(runtimeProfile),
            result,
        ),
    ];

    const sentryMemory = renderSentryMemory(runtimeProfile);
    if (sentryMemory) {
        writes.push(
            writeIfChanged(
                workspaceObjectId,
                "/memories/integrations/sentry.md",
                sentryMemory,
                result,
            )
        );
    }

    await Promise.all(writes);
    return result;
}
