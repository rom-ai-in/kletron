import { evaluateCondition, validateCondition } from "../services/agentGraphConditions";

describe("agentGraphConditions", () => {
    const state = {
        nextStep: "debug",
        count: 3,
        plan: { ready: true },
        flags: { done: false },
    };

    it("supports truthy state paths", () => {
        expect(evaluateCondition("state.plan", state)).toBe(true);
        expect(evaluateCondition("state.flags.done", state)).toBe(false);
    });

    it("supports exists() checks", () => {
        expect(evaluateCondition("exists(state.plan)", state)).toBe(true);
        expect(evaluateCondition("exists(state.missing)", state)).toBe(false);
    });

    it("supports comparisons", () => {
        expect(evaluateCondition("state.nextStep == \"debug\"", state)).toBe(true);
        expect(evaluateCondition("state.nextStep != \"debug\"", state)).toBe(false);
        expect(evaluateCondition("state.count == 3", state)).toBe(true);
    });

    it("supports negation", () => {
        expect(evaluateCondition("!state.flags.done", state)).toBe(true);
        expect(evaluateCondition("!exists(state.plan)", state)).toBe(false);
    });

    it("validates syntax", () => {
        expect(validateCondition("state.nextStep == \"debug\"").valid).toBe(true);
        expect(validateCondition("foo == bar").valid).toBe(false);
    });
});
