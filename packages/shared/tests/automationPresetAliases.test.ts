import { describe, expect, it } from "vitest";
import { AutomationConfigBuilder } from "../src/automationConfigBuilder";

describe("AutomationConfigBuilder legacy preset aliases", () => {
    it("maps SECURITY_DEEP_DIVE to CODE_SECURITY_WEBHOOK", () => {
        const resolved = AutomationConfigBuilder.buildAutomation("SECURITY_DEEP_DIVE");
        const canonical = AutomationConfigBuilder.PRESETS.CODE_SECURITY_WEBHOOK;
        expect(resolved.name).toBe(canonical.name);
        expect(resolved.stages?.map((s) => s.id)).toEqual(canonical.stages?.map((s) => s.id));
    });

    it("maps BUSINESS_ANALYSIS_FULL to BUSINESS_STRATEGY_PIPELINE", () => {
        const resolved = AutomationConfigBuilder.buildAutomation("BUSINESS_ANALYSIS_FULL");
        expect(resolved.name).toBe(AutomationConfigBuilder.PRESETS.BUSINESS_STRATEGY_PIPELINE.name);
    });

    it("getPresetMetadata resolves legacy keys to canonical durations", () => {
        const meta = AutomationConfigBuilder.getPresetMetadata("FEATURE_AUDIT");
        expect(meta).not.toBeNull();
        expect(meta?.stageCount).toBe(AutomationConfigBuilder.PRESETS.PRODUCT_AREA_DEEP_DIVE.stages?.length);
        expect(meta?.estimatedDuration).not.toBe("Unknown");
    });
});
