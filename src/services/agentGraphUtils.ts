export function renderUserPrompt(template: string, state: unknown) {
    const renderedState = JSON.stringify(state ?? {}, null, 2);
    return template.split("{{state}}").join(renderedState);
}

export function stripCodeFences(text: string) {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
        const withoutFirst = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n/, "");
        return withoutFirst.replace(/\n```\s*$/, "").trim();
    }
    return trimmed;
}

export function parseJsonOutput(raw: string) {
    const cleaned = stripCodeFences(raw);
    return JSON.parse(cleaned);
}

