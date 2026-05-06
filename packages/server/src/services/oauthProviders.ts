// Connector OAuth provider definitions.
// Used by /api/auth/connect/[provider]/{start,callback} to drive the OAuth
// dance for SaaS integrations (separate from the user-login OAuth handled by
// NextAuth).
//
// Adding a new provider = appending to OAUTH_PROVIDERS.

export interface OauthProviderConfig {
    /** Connector providerId (matches the connector catalog). */
    providerId: string;
    authUrl: string;
    tokenUrl: string;
    /** Default scopes if the user does not request any. */
    defaultScopes: string[];
    /** Appended to the authorize URL (e.g. Google `access_type=offline`). */
    extraAuthParams?: Record<string, string>;
    /** env var holding the client id. */
    clientIdEnv: string;
    /** env var holding the client secret. */
    clientSecretEnv: string;
    /** Build the credential record stored in Mongo from the token response. */
    buildCredentials: (tokenResponse: Record<string, unknown>) => Record<string, string>;
    /** Map from token response to the scopes that were granted (best-effort). */
    extractScopes?: (tokenResponse: Record<string, unknown>) => string[];
}

function extractGoogleScopes(resp: Record<string, unknown>, fallback: string[]): string[] {
    const raw = typeof resp.scope === "string" ? resp.scope : "";
    const scopes = raw
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return scopes.length > 0 ? scopes : fallback;
}

export const OAUTH_PROVIDERS: Record<string, OauthProviderConfig> = {
    github: {
        providerId: "github",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        defaultScopes: ["read:user", "repo"],
        clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
        clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
        buildCredentials: (resp) => ({
            token: String(resp.access_token ?? ""),
            tokenType: String(resp.token_type ?? "bearer"),
        }),
        extractScopes: (resp) =>
            typeof resp.scope === "string" && resp.scope.length > 0
                ? String(resp.scope).split(",").map((s) => s.trim())
                : [],
    },
    slack: {
        providerId: "slack",
        authUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        defaultScopes: ["channels:read", "chat:write", "users:read"],
        clientIdEnv: "SLACK_OAUTH_CLIENT_ID",
        clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET",
        buildCredentials: (resp) => {
            const accessToken =
                (resp.access_token as string) ??
                ((resp.authed_user as { access_token?: string } | undefined)?.access_token ?? "");
            return {
                botToken: accessToken,
                teamId: String((resp.team as { id?: string } | undefined)?.id ?? ""),
            };
        },
        extractScopes: (resp) =>
            typeof resp.scope === "string" && resp.scope.length > 0
                ? String(resp.scope).split(",").map((s) => s.trim())
                : [],
    },
    "google-drive": {
        providerId: "google-drive",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        defaultScopes: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
        extraAuthParams: {
            access_type: "offline",
            prompt: "consent",
        },
        clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
        clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
        buildCredentials: (resp) => ({
            refreshToken: String(resp.refresh_token ?? ""),
            accessToken: String(resp.access_token ?? ""),
        }),
        extractScopes: (resp) =>
            extractGoogleScopes(resp, [
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/drive.metadata.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
            ]),
    },
    gmail: {
        providerId: "gmail",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        defaultScopes: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.metadata",
        ],
        extraAuthParams: {
            access_type: "offline",
            prompt: "consent",
        },
        clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
        clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
        buildCredentials: (resp) => ({
            refreshToken: String(resp.refresh_token ?? ""),
            accessToken: String(resp.access_token ?? ""),
        }),
        extractScopes: (resp) =>
            extractGoogleScopes(resp, [
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.metadata",
            ]),
    },
    "google-calendar": {
        providerId: "google-calendar",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        defaultScopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.freebusy",
        ],
        extraAuthParams: {
            access_type: "offline",
            prompt: "consent",
        },
        clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
        clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
        buildCredentials: (resp) => ({
            refreshToken: String(resp.refresh_token ?? ""),
            accessToken: String(resp.access_token ?? ""),
        }),
        extractScopes: (resp) =>
            extractGoogleScopes(resp, [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
                "https://www.googleapis.com/auth/calendar.events",
                "https://www.googleapis.com/auth/calendar.freebusy",
            ]),
    },
};

export function getOauthProvider(providerId: string): OauthProviderConfig | null {
    return OAUTH_PROVIDERS[providerId] ?? null;
}

export interface OauthState {
    workspaceId: string;
    userId: string;
    providerId: string;
    /** epoch ms */
    iat: number;
    /** Where to redirect the browser after success. */
    redirect?: string;
}

export function encodeState(state: OauthState): string {
    return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(raw: string): OauthState | null {
    try {
        const json = Buffer.from(raw, "base64url").toString("utf8");
        const parsed = JSON.parse(json) as OauthState;
        if (
            typeof parsed.workspaceId !== "string" ||
            typeof parsed.userId !== "string" ||
            typeof parsed.providerId !== "string" ||
            typeof parsed.iat !== "number"
        ) {
            return null;
        }
        // 30-minute window
        if (Date.now() - parsed.iat > 30 * 60 * 1000) return null;
        return parsed;
    } catch {
        return null;
    }
}
