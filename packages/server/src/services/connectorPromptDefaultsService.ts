import { findActiveIntegration, getIntegrationCredentials } from "./connectorsService";

export type SafeConnectorPromptDefault = {
    providerId: string;
    displayName?: string;
    details: Record<string, string>;
};

type ConnectorSerializer = (input: {
    displayName?: string;
    credentials: Record<string, string>;
}) => SafeConnectorPromptDefault | null;

const SERIALIZERS: Record<string, ConnectorSerializer> = {
    sentry: ({ displayName, credentials }) => {
        const host = typeof credentials.host === "string" ? credentials.host.trim() : "";
        const organizationSlug =
            typeof credentials.organizationSlug === "string"
                ? credentials.organizationSlug.trim()
                : "";
        const details: Record<string, string> = {};
        if (displayName) details.displayName = displayName;
        if (host) details.host = host;
        if (organizationSlug) details.organizationSlug = organizationSlug;
        if (Object.keys(details).length === 0) return null;
        return {
            providerId: "sentry",
            displayName,
            details,
        };
    },
};

export async function resolveSafeConnectorPromptDefaults(
    workspaceId: string,
    providerIds: string[],
): Promise<SafeConnectorPromptDefault[]> {
    const out: SafeConnectorPromptDefault[] = [];

    for (const providerId of providerIds) {
        const serializer = SERIALIZERS[providerId];
        if (!serializer) continue;
        const integration = await findActiveIntegration(workspaceId, providerId);
        if (!integration?.id) continue;
        const credentials = await getIntegrationCredentials(workspaceId, integration.id);
        if (!credentials) continue;
        const serialized = serializer({
            displayName: integration.displayName,
            credentials,
        });
        if (serialized) out.push(serialized);
    }

    return out;
}
