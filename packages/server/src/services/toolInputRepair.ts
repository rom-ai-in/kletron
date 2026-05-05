import { z, ZodError } from "zod";

const TOOL_INPUT_WRAPPER_KEYS = ["arguments", "args", "parameters", "input", "payload", "json"] as const;
const GENERIC_TOOL_INPUT_ALIASES: Record<string, readonly string[]> = {
    filePath: ["path", "file", "filename", "fileName", "file_name", "file_path"],
    repoPath: ["repo", "repo_path", "workspacePath", "workspace_path", "rootDir", "root_dir"],
    content: ["text", "body", "contents", "file_text"],
    command: ["cmd", "bash", "script", "shellCommand", "shell_command"],
    query: ["q", "search", "searchQuery", "search_query"],
    pattern: ["glob", "filePattern", "file_pattern"],
    cwd: ["directory", "dir", "folder", "workdir", "workingDirectory", "working_directory", "root"],
    path: ["cwd", "workdir", "workingDirectory", "working_directory", "directory", "dir", "folder"],
    startLine: ["start", "start_line", "from", "lineStart", "line_start"],
    endLine: ["end", "end_line", "to", "lineEnd", "line_end"],
    pageToken: ["token", "nextPageToken", "next_page_token"],
    fileId: ["id", "file_id"],
    eventId: ["id", "event_id"],
    messageId: ["id", "message_id"],
    threadId: ["id", "thread_id"],
    calendarId: ["id", "calendar_id"],
};

function coerceBoolean(value: unknown): unknown {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return value;
}

function coerceNumber(value: unknown): unknown {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
}

function coerceString(value: unknown): unknown {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return value;
    if (typeof value === "object") {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function coerceStringArray(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
        // fall through
    }
    if (trimmed.includes(",")) {
        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [trimmed];
}

function coerceObject(value: unknown): unknown {
    if (!value || typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }
    return value;
}

function coerceEnumValue(options: string[], value: unknown): unknown {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    const exact = options.find((option) => option === trimmed);
    if (exact) return exact;
    const caseInsensitive = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
    if (caseInsensitive) return caseInsensitive;
    return value;
}

function safeShape(schema: z.ZodObject<any>): Record<string, z.ZodTypeAny> {
    return typeof schema.shape === "function" ? schema.shape() : schema.shape;
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return unwrapSchema(schema.unwrap());
    }
    if (schema instanceof z.ZodDefault) {
        const inner = (schema as any)._def?.innerType as z.ZodTypeAny | undefined;
        return inner ? unwrapSchema(inner) : schema;
    }
    if (schema instanceof z.ZodEffects) {
        const inner = (schema as any)._def?.schema as z.ZodTypeAny | undefined;
        return inner ? unwrapSchema(inner) : schema;
    }
    return schema;
}

function extractObjectShapeKeys(schema: z.ZodTypeAny): string[] {
    const unwrapped = unwrapSchema(schema);
    if (!(unwrapped instanceof z.ZodObject)) return [];
    return Object.keys(safeShape(unwrapped));
}

function toObjectRecord(value: unknown): Record<string, unknown> | null {
    const objectValue = coerceObject(value);
    if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) return null;
    return { ...(objectValue as Record<string, unknown>) };
}

function hasMeaningfulValue(value: unknown): boolean {
    return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

function fillAlias(target: Record<string, unknown>, canonicalKey: string, aliases: readonly string[]) {
    if (hasMeaningfulValue(target[canonicalKey])) return;
    for (const alias of aliases) {
        if (!hasMeaningfulValue(target[alias])) continue;
        target[canonicalKey] = target[alias];
        return;
    }
}

function unwrapNestedToolInput(schema: z.ZodTypeAny, input: Record<string, unknown>): Record<string, unknown> {
    const shapeKeys = extractObjectShapeKeys(schema);
    if (shapeKeys.length === 0) return input;
    if (shapeKeys.some((key) => hasMeaningfulValue(input[key]))) return input;
    for (const wrapperKey of TOOL_INPUT_WRAPPER_KEYS) {
        const nested = toObjectRecord(input[wrapperKey]);
        if (!nested) continue;
        const merged: Record<string, unknown> = { ...input, ...nested };
        for (const key of TOOL_INPUT_WRAPPER_KEYS) {
            delete merged[key];
        }
        return merged;
    }
    return input;
}

function applyGenericToolAliases(schema: z.ZodTypeAny, input: Record<string, unknown>, toolName: string): Record<string, unknown> {
    const shapeKeys = new Set(extractObjectShapeKeys(schema));
    const normalized = { ...input };

    for (const [canonicalKey, aliases] of Object.entries(GENERIC_TOOL_INPUT_ALIASES)) {
        if (!shapeKeys.has(canonicalKey)) continue;
        fillAlias(normalized, canonicalKey, aliases);
    }

    if (toolName === "glob_files") {
        if (!hasMeaningfulValue(normalized.pattern) && typeof normalized.path === "string") {
            if (/[*?[\]{}]/.test(normalized.path)) {
                normalized.pattern = normalized.path;
            } else if (!hasMeaningfulValue(normalized.cwd)) {
                normalized.cwd = normalized.path;
            }
        }
        if (!hasMeaningfulValue(normalized.pattern) && typeof normalized.query === "string") {
            normalized.pattern = normalized.query;
        }
    }

    return normalized;
}

function normalizeToolInput(schema: z.ZodTypeAny, input: unknown, toolName: string): unknown {
    const objectInput = toObjectRecord(input);
    if (!objectInput) return input;
    const unwrapped = unwrapNestedToolInput(schema, objectInput);
    return applyGenericToolAliases(schema, unwrapped, toolName);
}

export function repairToolInputValue(schema: z.ZodTypeAny, value: unknown): unknown {
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        if (value === undefined || value === null) return value;
        return repairToolInputValue(schema.unwrap(), value);
    }

    if (schema instanceof z.ZodDefault) {
        const inner = (schema as any)._def?.innerType as z.ZodTypeAny | undefined;
        return inner ? repairToolInputValue(inner, value) : value;
    }

    if (schema instanceof z.ZodEffects) {
        const inner = (schema as any)._def?.schema as z.ZodTypeAny | undefined;
        return inner ? repairToolInputValue(inner, value) : value;
    }

    if (schema instanceof z.ZodBoolean) {
        return coerceBoolean(value);
    }

    if (schema instanceof z.ZodNumber) {
        return coerceNumber(value);
    }

    if (schema instanceof z.ZodString) {
        return coerceString(value);
    }

    if (schema instanceof z.ZodEnum) {
        return coerceEnumValue(schema.options, value);
    }

    if (schema instanceof z.ZodNativeEnum) {
        return coerceEnumValue(Object.values(schema.enum).map((item) => String(item)), value);
    }

    if (schema instanceof z.ZodLiteral) {
        const expected = (schema as any)._def?.value;
        if (typeof expected === "boolean") return coerceBoolean(value);
        if (typeof expected === "number") return coerceNumber(value);
        if (typeof expected === "string") return coerceEnumValue([expected], value);
        return value;
    }

    if (schema instanceof z.ZodArray) {
        const elementSchema = schema.element;
        if (Array.isArray(value)) {
            return value.map((item) => repairToolInputValue(elementSchema, item));
        }
        if (typeof value === "string") {
            return coerceStringArray(value).map((item) => repairToolInputValue(elementSchema, item));
        }
        if (value === undefined || value === null) return value;
        return [repairToolInputValue(elementSchema, value)];
    }

    if (schema instanceof z.ZodRecord) {
        const objectValue = coerceObject(value);
        if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) return objectValue;
        const valSchema = schema.valueSchema;
        return Object.fromEntries(
            Object.entries(objectValue).map(([key, item]) => [key, repairToolInputValue(valSchema, item)])
        );
    }

    if (schema instanceof z.ZodObject) {
        const objectValue = coerceObject(value);
        if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) return objectValue;
        const shape = safeShape(schema);
        const repaired: Record<string, unknown> = { ...(objectValue as Record<string, unknown>) };
        for (const [key, childSchema] of Object.entries(shape)) {
            if (!(key in repaired)) continue;
            repaired[key] = repairToolInputValue(childSchema, repaired[key]);
        }
        return repaired;
    }

    if (schema instanceof z.ZodUnion) {
        for (const option of (schema as any)._def?.options ?? []) {
            const repaired = repairToolInputValue(option, value);
            if (option.safeParse(repaired).success) return repaired;
        }
        return value;
    }

    if (schema instanceof z.ZodDiscriminatedUnion) {
        const objectValue = coerceObject(value);
        if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) return objectValue;
        for (const option of Array.from((schema as any).options.values()) as z.ZodTypeAny[]) {
            const repaired = repairToolInputValue(option, objectValue);
            if (option.safeParse(repaired).success) return repaired;
        }
        return objectValue;
    }

    return value;
}

function formatZodError(error: ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
            return `${path}: ${issue.message}`;
        })
        .join("; ");
}

export function parseToolInputWithRepair<T extends Record<string, unknown>>(
    schema: z.ZodTypeAny,
    input: unknown,
    toolName: string
): T {
    const normalized = normalizeToolInput(schema, input, toolName);
    const repaired = repairToolInputValue(schema, normalized);
    const parsed = schema.safeParse(repaired);
    if (parsed.success) return parsed.data as T;

    const original = schema.safeParse(input);
    const detail = parsed.error instanceof ZodError ? formatZodError(parsed.error) : "Unknown validation error";
    if (!original.success && parsed.error instanceof ZodError) {
        throw new Error(
            `Tool input validation failed for ${toolName}: ${detail}. ` +
            "Retry the tool call with corrected JSON arguments."
        );
    }
    throw new Error(`Tool input validation failed for ${toolName}: ${detail}.`);
}
