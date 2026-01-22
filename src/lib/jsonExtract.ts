/**
 * Strips ellipses (...) that occur outside of quoted strings.
 * Useful for cleaning up LLM outputs where they might use ... to indicate continuation.
 */
export function stripEllipsisOutsideStrings(input: string): string {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            out += ch;
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === "\"") {
                inString = false;
            }
            continue;
        }

        if (ch === "\"") {
            inString = true;
            out += ch;
            continue;
        }

        if (ch === "." && input.slice(i, i + 3) === "...") {
            i += 2;
            continue;
        }

        out += ch;
    }

    return out;
}

/**
 * Removes trailing commas in arrays and objects, which are invalid in strict JSON.
 * Operates only outside of strings.
 */
export function removeTrailingCommasOutsideStrings(input: string): string {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            out += ch;
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === "\"") {
                inString = false;
            }
            continue;
        }

        if (ch === "\"") {
            inString = true;
            out += ch;
            continue;
        }

        if (ch === ",") {
            let j = i + 1;
            while (j < input.length && /\s/.test(input[j])) j += 1;
            if (input[j] === "}" || input[j] === "]") {
                continue;
            }
        }

        out += ch;
    }

    return out;
}

/**
 * Applies multiple sanitization strategies to make a string parseable as JSON.
 */
export function sanitizeJsonCandidate(input: string): string {
    const withoutEllipsis = stripEllipsisOutsideStrings(input);
    return removeTrailingCommasOutsideStrings(withoutEllipsis);
}

/**
 * Extracts content from markdown code fences (```json ... ```).
 */
export function stripCodeFences(input: string): string {
    const fenceMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    return input;
}

/**
 * Locates the first balanced JSON object {...} in the string.
 */
export function findFirstJsonObject(input: string): string | null {
    let inString = false;
    let escaped = false;
    let depth = 0;
    let start = -1;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === "\"") {
                inString = false;
            }
            continue;
        }

        if (ch === "\"") {
            inString = true;
            continue;
        }

        if (ch === "{") {
            if (depth === 0) start = i;
            depth += 1;
            continue;
        }

        if (ch === "}") {
            if (depth > 0) depth -= 1;
            if (depth === 0 && start >= 0) {
                return input.slice(start, i + 1);
            }
        }
    }
    return null;
}

/**
 * Comprehensive JSON extraction that tries multiple strategies:
 * 1. Parse directly (after stripping code fences)
 * 2. Parse the substring from the first { to the last }
 * 3. Find the first balanced object
 * 4. Apply sanitization (trailing commas, ellipsis) and retry
 */
export function extractJsonObject(text: string): unknown {
    const trimmed = stripCodeFences(text.trim());
    const attempts: string[] = [trimmed];
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
        attempts.push(trimmed.slice(first, last + 1));
    }
    const balanced = findFirstJsonObject(trimmed);
    if (balanced) attempts.push(balanced);

    for (const attempt of attempts) {
        try {
            return JSON.parse(attempt);
        } catch {
            try {
                const sanitized = sanitizeJsonCandidate(attempt);
                return JSON.parse(sanitized);
            } catch {
                // Keep trying other candidates.
            }
        }
    }

    throw new Error("Could not parse JSON output from agent.");
}
