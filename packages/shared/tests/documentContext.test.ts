import { describe, expect, it } from "vitest";
import {
    formatDocumentContextPrompt,
    normalizeDocumentContext,
} from "../src/documentContext";

describe("documentContext", () => {
    it("normalizes tone, languages, frameworks, and hotspots", () => {
        const normalized = normalizeDocumentContext({
            mission: " Ship faster ",
            tone: " direct ",
            languages: [" French ", "", "English"],
            frameworks: [" Next.js ", "Stripe"],
            hotspots: [" Billing ", "Auth"],
        });

        expect(normalized).toEqual({
            mission: "Ship faster",
            tone: "direct",
            languages: ["French", "English"],
            frameworks: ["Next.js", "Stripe"],
            hotspots: ["Billing", "Auth"],
            documentType: undefined,
            primaryGoal: undefined,
            keyObjectives: undefined,
            nonGoals: undefined,
            timeHorizon: undefined,
            targetAudience: undefined,
            qualityLevel: undefined,
            constraints: undefined,
            startupPhase: undefined,
            targetUsers: undefined,
            riskTolerance: undefined,
        });
    });

    it("formats the extended persistent context fields into the prompt", () => {
        const prompt = formatDocumentContextPrompt({
            mission: "Reduce incident response time",
            primaryGoal: "Triage Sentry faster",
            tone: "calm and direct",
            languages: ["French"],
            frameworks: ["Next.js", "Sentry"],
            hotspots: ["incident triage"],
            nonGoals: ["full rewrite"],
            constraints: ["no new vendor"],
        });

        expect(prompt).toContain("Tone: calm and direct");
        expect(prompt).toContain("Languages: French");
        expect(prompt).toContain("Frameworks / stacks: Next.js, Sentry");
        expect(prompt).toContain("Hotspots: incident triage");
        expect(prompt).toContain("Keep non-goals explicitly out of scope");
    });
});
