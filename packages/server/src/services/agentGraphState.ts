export function setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
    opts?: { merge?: boolean }
) {
    let cleanPath = path.startsWith("state.") ? path.slice("state.".length) : path;
    if (cleanPath === "state") {
        cleanPath = "";
    }
    const parts = cleanPath.split(".").filter(Boolean);
    if (parts.length === 0) {
        if (opts?.merge && typeof value === "object" && value && typeof obj === "object") {
            Object.assign(obj, value as Record<string, unknown>);
            return;
        }
        if (typeof value === "object" && value && typeof obj === "object") {
            for (const key of Object.keys(obj)) {
                delete obj[key];
            }
            Object.assign(obj, value as Record<string, unknown>);
        }
        return;
    }

    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        const next = current[key];
        if (!next || typeof next !== "object") {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1];
    if (opts?.merge && typeof value === "object" && value && typeof current[last] === "object" && current[last]) {
        current[last] = { ...(current[last] as Record<string, unknown>), ...(value as Record<string, unknown>) };
        return;
    }
    current[last] = value as any;
}
