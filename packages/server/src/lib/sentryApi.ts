/** Sentry REST API helpers (saas + self-hosted). Used by sentry_api tool and connector Verify. */

const DEFAULT_TIMEOUT_MS = 20_000;

export function resolveSentryApiBase(host?: string): string {
    const raw = (host ?? "").trim();
    if (!raw || raw.toLowerCase() === "sentry.io") {
        return "https://sentry.io/api/0";
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = raw.replace(/\/$/, "");
        return u.endsWith("/api/0") ? u : `${u}/api/0`;
    }
    return `https://${raw.replace(/\/$/, "")}/api/0`;
}

export async function probeSentryCredentials(creds: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const token = creds.accessToken?.trim();
    if (!token) {
        return { ok: false, message: "Missing User Auth Token — use the accessToken field." };
    }
    const base = resolveSentryApiBase(creds.host);
    try {
        const res = await fetch(`${base}/organizations/`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
            const snippet = (await res.text()).slice(0, 280);
            return { ok: false, message: `Sentry returned HTTP ${res.status}. ${snippet}` };
        }
        return { ok: true, message: "Sentry API accepted this token." };
    } catch (e) {
        return { ok: false, message: (e as Error).message ?? String(e) };
    }
}

export async function sentryFetchJson(
    base: string,
    token: string,
    path: string,
    init?: { query?: Record<string, string | number | undefined>; timeoutMs?: number }
): Promise<unknown> {
    const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const root = base.endsWith("/") ? base : `${base}/`;
    const relative = path.replace(/^\//, "");
    const url = new URL(relative, root);
    if (init?.query) {
        for (const [k, v] of Object.entries(init.query)) {
            if (v === undefined || v === "") continue;
            url.searchParams.set(k, String(v));
        }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            signal: controller.signal,
        });
        const text = await res.text();
        let parsed: unknown = text;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            /* keep raw text */
        }
        if (!res.ok) {
            const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed).slice(0, 600);
            throw new Error(`Sentry API ${res.status}: ${detail}`);
        }
        return parsed;
    } finally {
        clearTimeout(timer);
    }
}
