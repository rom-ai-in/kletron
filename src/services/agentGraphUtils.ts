/**
 * Resolves a nested property path from an object
 * e.g., getNestedValue(obj, 'nodes.client_research.summary') 
 */
function getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

export function renderUserPrompt(template: string, state: unknown) {
    const stateObj = (state && typeof state === 'object') ? state as Record<string, unknown> : {};
    const mission = typeof stateObj.mission === 'string' ? stateObj.mission : '';
    const userInput = typeof stateObj.userInput === 'string' ? stateObj.userInput : mission;
    const renderedState = JSON.stringify(state ?? {}, null, 2);

    // First, replace simple placeholders
    let result = template
        .split("{{state}}").join(renderedState)
        .split("{{userInput}}").join(userInput)
        .split("{{mission}}").join(mission)
        .split("{{input}}").join(userInput);

    // Then, replace nested state access patterns like {{state.nodes.xyz}} or {{state.content_generation}}
    result = result.replace(/\{\{state\.([^}]+)\}\}/g, (match, path) => {
        const value = getNestedValue(stateObj, path);
        if (value === undefined || value === null) {
            return `[No data available for state.${path}]`;
        }
        if (typeof value === 'string') {
            return value;
        }
        return JSON.stringify(value, null, 2);
    });

    return result;
}

export function stripCodeFences(text: string) {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
        const withoutFirst = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n/, "");
        return withoutFirst.replace(/\n```\s*$/, "").trim();
    }
    return trimmed;
}

export function parseJsonOutput(raw: string): unknown {
    const cleaned = stripCodeFences(raw);

    // Try to parse as JSON
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // If it's not valid JSON, try to extract JSON from the text
        // Sometimes the model wraps JSON in extra text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                // Fall through to error handling
            }
        }

        // If no JSON found, return a fallback structure
        // This allows the graph to continue with an error message instead of crashing
        return {
            _parseError: true,
            _errorMessage: `Agent returned text instead of JSON: ${cleaned.slice(0, 200)}...`,
            _rawContent: cleaned,
            summary: cleaned.slice(0, 500),
        };
    }
}

