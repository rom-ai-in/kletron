import { z, ZodError } from "zod";

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
        const discriminator = schema.discriminator;
        const selected = (objectValue as Record<string, unknown>)[discriminator];
        const option = Array.from((schema as any).options.values()).find((candidate: z.ZodTypeAny) => {
            try {
                return candidate.shape?.[discriminator]?.safeParse(selected).success;
            } catch {
                return false;
            }
        });
        return option ? repairToolInputValue(option, objectValue) : objectValue;
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
    const repaired = repairToolInputValue(schema, input);
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
