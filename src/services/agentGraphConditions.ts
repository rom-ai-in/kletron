type ParsedCondition =
    | { kind: "always"; invert: boolean }
    | { kind: "truthy"; invert: boolean; path: string }
    | { kind: "exists"; invert: boolean; path: string }
    | { kind: "compare"; invert: boolean; path: string; op: "==" | "!="; value: unknown }
    | { kind: "invalid"; invert: boolean; error: string };

function normalizePath(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed === "state") return "";
    if (trimmed.startsWith("state.")) return trimmed.slice("state.".length);
    return null;
}

function parseLiteral(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1);
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

function getNestedValue(obj: unknown, path: string): unknown {
    if (path === "") return obj;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function parseCondition(condition?: string): ParsedCondition {
    const raw = (condition ?? "").trim();
    if (!raw) return { kind: "always", invert: false };

    let working = raw;
    let invert = false;
    if (working.startsWith("!")) {
        invert = true;
        working = working.slice(1).trim();
    }

    if (!working || working === "always") {
        return { kind: "always", invert };
    }

    const existsMatch = working.match(/^exists\((.+)\)$/);
    if (existsMatch) {
        const path = normalizePath(existsMatch[1]);
        if (!path && path !== "") {
            return { kind: "invalid", invert, error: "exists() expects a state path like state.foo" };
        }
        return { kind: "exists", invert, path };
    }

    const truthyMatch = working.match(/^truthy\((.+)\)$/);
    if (truthyMatch) {
        const path = normalizePath(truthyMatch[1]);
        if (!path && path !== "") {
            return { kind: "invalid", invert, error: "truthy() expects a state path like state.foo" };
        }
        return { kind: "truthy", invert, path };
    }

    const compareMatch = working.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
    if (compareMatch) {
        const path = normalizePath(compareMatch[1]);
        if (!path && path !== "") {
            return { kind: "invalid", invert, error: "Comparisons must target state paths (e.g. state.nextStep)" };
        }
        const op = compareMatch[2] as "==" | "!=";
        const value = parseLiteral(compareMatch[3]);
        return { kind: "compare", invert, path, op, value };
    }

    const directPath = normalizePath(working);
    if (directPath || directPath === "") {
        return { kind: "truthy", invert, path: directPath };
    }

    return { kind: "invalid", invert, error: "Unsupported condition format" };
}

function isEqualValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === "object" && typeof b === "object" && a && b) {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }
    return false;
}

export function evaluateCondition(condition: string | undefined, state: unknown): boolean {
    const parsed = parseCondition(condition);
    if (parsed.kind === "invalid") return false;
    let result = false;
    switch (parsed.kind) {
        case "always":
            result = true;
            break;
        case "truthy":
            result = Boolean(getNestedValue(state, parsed.path));
            break;
        case "exists": {
            const value = getNestedValue(state, parsed.path);
            result = value !== undefined && value !== null;
            break;
        }
        case "compare": {
            const actual = getNestedValue(state, parsed.path);
            result = parsed.op === "==" ? isEqualValue(actual, parsed.value) : !isEqualValue(actual, parsed.value);
            break;
        }
        default:
            result = false;
    }
    return parsed.invert ? !result : result;
}

export function validateCondition(condition?: string): { valid: boolean; error?: string } {
    const parsed = parseCondition(condition);
    if (parsed.kind === "invalid") {
        return { valid: false, error: parsed.error };
    }
    return { valid: true };
}
