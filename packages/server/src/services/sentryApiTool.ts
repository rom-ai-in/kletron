import { resolveSentryApiBase, sentryFetchJson } from "../lib/sentryApi";
import { findActiveIntegration, getIntegrationCredentials } from "./connectorsService";

/**
 * Workspace-scoped Sentry REST helper for the agent. Credentials come from the
 * Sentry SaaS connector (encrypted account integration + workspace binding).
 */
export async function runSentryApiTool(
    workspaceId: string | undefined,
    args: Record<string, unknown>
): Promise<string> {
    const ws = workspaceId?.trim();
    if (!ws) {
        throw new Error("sentry_api requires a workspace context.");
    }

    const integration = await findActiveIntegration(ws, "sentry");
    if (!integration) {
        throw new Error(
            "No active Sentry connector for this workspace. Add it under App → Configuration → Connectors."
        );
    }

    const creds = await getIntegrationCredentials(ws, integration.id);
    if (!creds?.accessToken?.trim()) {
        throw new Error("Sentry connector is missing accessToken (User Auth Token).");
    }

    const token = creds.accessToken.trim();
    const base = resolveSentryApiBase(typeof creds.host === "string" ? creds.host : undefined);
    const defaultOrg =
        typeof creds.organizationSlug === "string" ? creds.organizationSlug.trim() : "";

    const resource = String(args.resource ?? "digest");
    const organizationSlug =
        typeof args.organizationSlug === "string" && args.organizationSlug.trim()
            ? args.organizationSlug.trim()
            : defaultOrg;
    const issueId = typeof args.issueId === "string" ? args.issueId.trim() : "";
    const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : undefined;
    const limitRaw = args.limit;
    const limit =
        typeof limitRaw === "number" && Number.isFinite(limitRaw)
            ? Math.min(100, Math.max(1, Math.trunc(limitRaw)))
            : 25;

    /**
     * One-shot summary for vague prompts ("où on en est sur Sentry"): resolve org from
     * connector default, else first org from /organizations/, then unresolved issues.
     */
    if (resource === "digest" || resource === "status") {
        let org = organizationSlug;
        if (!org) {
            const orgsJson = await sentryFetchJson(base, token, "organizations/");
            const orgs = Array.isArray(orgsJson) ? orgsJson : [];
            const first = orgs.find(
                (o): o is { slug: string } =>
                    Boolean(o && typeof o === "object" && typeof (o as { slug?: string }).slug === "string")
            );
            if (!first?.slug) {
                throw new Error(
                    "No Sentry organization found for this token. Set **Default organization slug** on Connectors → Sentry."
                );
            }
            org = first.slug;
        }
        const issueQuery = query ?? "is:unresolved";
        const issuesJson = await sentryFetchJson(
            base,
            token,
            `organizations/${encodeURIComponent(org)}/issues/`,
            {
                query: {
                    limit,
                    query: issueQuery,
                },
            }
        );
        return JSON.stringify(
            {
                organizationSlug: org,
                query: issueQuery,
                issues: issuesJson,
            },
            null,
            2
        );
    }

    if (resource === "organizations") {
        const json = await sentryFetchJson(base, token, "organizations/");
        return JSON.stringify(json, null, 2);
    }

    if (resource === "projects") {
        if (!organizationSlug) {
            throw new Error(
                "projects requires organizationSlug — set Default organization slug on the connector or pass organizationSlug."
            );
        }
        const json = await sentryFetchJson(
            base,
            token,
            `organizations/${encodeURIComponent(organizationSlug)}/projects/`
        );
        return JSON.stringify(json, null, 2);
    }

    if (resource === "list_issues") {
        if (!organizationSlug) {
            throw new Error(
                "list_issues requires organizationSlug — set Default organization slug on the connector or pass organizationSlug."
            );
        }
        const json = await sentryFetchJson(
            base,
            token,
            `organizations/${encodeURIComponent(organizationSlug)}/issues/`,
            {
                query: {
                    limit,
                    ...(query ? { query } : {}),
                },
            }
        );
        return JSON.stringify(json, null, 2);
    }

    if (resource === "issue_detail") {
        if (!issueId) {
            throw new Error("issue_detail requires issueId (numeric issue ID from Sentry).");
        }
        const json = await sentryFetchJson(base, token, `issues/${encodeURIComponent(issueId)}/`);
        return JSON.stringify(json, null, 2);
    }

    throw new Error(
        "resource must be one of: digest, status, organizations, projects, list_issues, issue_detail."
    );
}
