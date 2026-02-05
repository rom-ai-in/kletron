import { describe, it, expect } from "vitest";

import { renderUserPrompt } from "@numezis/server/services/agentGraphUtils";

describe("agentGraphUtils.renderUserPrompt", () => {
    it("replaces {{state}} with JSON stringified state", () => {
        const template = "State:\n{{state}}\nDone.";
        const state = { a: 1, b: ["x"] };
        const rendered = renderUserPrompt(template, state);
        expect(rendered).toContain('"a": 1');
        expect(rendered).toContain('"b": [');
        expect(rendered.startsWith("State:\n")).toBe(true);
        expect(rendered.endsWith("\nDone.")).toBe(true);
    });

    it("replaces multiple occurrences", () => {
        const template = "{{state}}\n---\n{{state}}";
        const rendered = renderUserPrompt(template, { ok: true });
        expect(rendered.match(/"ok": true/g)?.length).toBe(2);
    });
});

